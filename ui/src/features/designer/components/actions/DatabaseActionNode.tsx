import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WeaverTextField } from "@/components/common/fields";
import {
  Braces as BracesIcon,
  Database as DatabaseIcon,
  Play as PlayIcon,
  RefreshCcw,
} from "lucide-react";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import NumbersOutlinedIcon from "@mui/icons-material/NumbersOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Menu from "@mui/material/Menu";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Modal from "@mui/material/Modal";
import Typography from "@mui/material/Typography";
import { Stack, IconButton, MenuItem } from "@mui/material";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import { config } from "@/config/appConfig";
import CircularProgress from "@mui/material/CircularProgress";
import { logDebug, logError, logInfo } from "@/utils/logger";
import { modalStyle } from "@/utils/modalStyle";
import { WeaverCodeEditor, toWeaverSuggestions } from "@/components/common/editors";
import { useWeaverNotification } from "@/components/common/notifications";
import { isValidJavaVariableName } from "@/utils/validation";
import { TASK_NODE_COLORS, WeaverTaskNode } from "@/features/designer/nodes/WeaverTaskNode";
import { ActionConfigModal } from "@/features/designer/nodes/ActionConfigModal";
import { useScopedParameterOptions } from "@/features/designer/hooks/useScopedSuggestions";
import { fetchDatasources as fetchDatabaseDatasources } from "@/features/databases";
import { executeQuery as executeDatabaseQuery, fetchQueriesByDatasourceId } from "@/features/queries";

const QUERIES_CACHE_TTL_MS = config.queriesTtlMs;
const isUuid = (value) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );

const parseParameterDefinitions = (rawParameters) => {
  if (!rawParameters) return {};
  let parsed = rawParameters;
  if (typeof rawParameters === "string") {
    try {
      parsed = JSON.parse(rawParameters);
    } catch {
      return {};
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.reduce((definitions, item) => {
      const name =
        typeof item === "string"
          ? item
          : item?.name ?? item?.key ?? item?.parameterName ?? item?.paramName;
      const normalizedName = String(name ?? "").trim();
      if (!normalizedName) return definitions;
      const type =
        typeof item === "object" && item !== null
          ? item.type ?? item.dataType ?? item.parameterType ?? item.valueType
          : "STRING";
      definitions[normalizedName] = String(type ?? "STRING").trim() || "STRING";
      return definitions;
    }, {});
  }
  if (!parsed || typeof parsed !== "object") return {};

  return Object.entries(parsed).reduce((definitions, [rawName, rawType]) => {
    const name = String(rawName ?? "").trim();
    if (!name) return definitions;
    const type =
      rawType && typeof rawType === "object" && !Array.isArray(rawType)
        ? rawType.type ?? rawType.dataType ?? rawType.parameterType ?? rawType.valueType
        : rawType;
    definitions[name] = String(type ?? "STRING").trim() || "STRING";
    return definitions;
  }, {});
};

const parseSqlParameterDefinitions = (sql = "") => {
  const text = String(sql || "");
  if (!text.trim()) return {};
  const definitions = {};
  const pattern = /(^|[^:]):([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match = pattern.exec(text);
  while (match) {
    const name = String(match[2] || "").trim();
    if (name) definitions[name] = "STRING";
    match = pattern.exec(text);
  }
  return definitions;
};

const resolveQueryParameterDefinitions = (query = {}) => {
  const explicitDefinitions = parseParameterDefinitions(
    query?.parameters ?? query?.params ?? query?.parameterDefinitions
  );
  if (Object.keys(explicitDefinitions).length > 0) return explicitDefinitions;
  return parseSqlParameterDefinitions(query?.sql ?? query?.queryText ?? query?.statement);
};

const buildQueryParamsFromDefinitions = (
  parameterDefinitions = {},
  existingParams = {},
  preserveExistingValues = false
) =>
  Object.keys(parameterDefinitions).reduce((acc, key) => {
    acc[key] = preserveExistingValues ? (existingParams[key] ?? "") : "";
    return acc;
  }, {});

const generateDatabaseReferenceName = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `database_query_${suffix}`;
};

export function exportDatabaseActionData(data, id, position = {}) {
  const cfg = data?.config || {};
  const refName =
    cfg.name ||
    cfg.referenceName ||
    cfg.taskReferenceName ||
    (data?.name && data.name !== "Database Query" && data.name !== "DATABASE" ? data.name : null) ||
    `query_${id || "ref"}`;

  const queryId = isUuid(cfg.queryId) ? cfg.queryId : (cfg.queryId || "");
  const datasourceId = cfg.datasourceId || cfg.dataSourceId || "";
  const params = cfg.params && typeof cfg.params === "object" ? cfg.params : {};

  const inputParameters = {
    queryId,
    datasourceId,
    params,
  };

  return {
    name: "DatabaseWorker",
    taskReferenceName: refName,
    inputParameters,
    type: "SIMPLE",
  };
}

const buildDatabaseTaskCode = (nodeData, nodeId) => {
  const cfg = nodeData?.config ?? {};
  const parameters =
    cfg.params && typeof cfg.params === "object" && !Array.isArray(cfg.params)
      ? cfg.params
      : {};

  return {
    name: "DatabaseWorker",
    taskReferenceName: cfg.name ?? "",
    inputParameters: {
      nodeId: nodeId ?? "",
      timeoutMs: cfg.timeoutMS ?? "",
      name: nodeData?.name ?? "",
      queryId: cfg.queryId ?? "",
      queryName: cfg.queryName ?? "",
      datasourceName: cfg.dataSourceName ?? "",
      datasourceId: cfg.dataSourceId ?? "",
      parameters,
    },
    type: "SIMPLE",
    startDelay: 0,
  };
};

export function DatabaseActionProps({
  data,
  onChange,
  validationErrors = {},
  parameterOptions = [],
}) {
  const { error: showError } = useWeaverNotification();
  const cfg = data?.config || {};
  const actionName = data?.name || "";

  const [queries, setQueries] = useState([]);
  const queriesCacheRef = React.useRef(new Map());
  const [dataSources, setDataSources] = useState([]);
  const [loadingDataSources, setLoadingDataSources] = useState(false);
  const [dataSourcesError, setDataSourcesError] = useState("");
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [queriesError, setQueriesError] = useState("");
  const dataSourceFieldAnchorRef = React.useRef(null);
  const queryFieldAnchorRef = React.useRef(null);
  const [dataSourceMenuOpen, setDataSourceMenuOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const fetchQueries = useCallback(
    async (signal, datasourceId, { forceReload = false } = {}) => {
      const resolvedDatasourceId = String(datasourceId ?? "").trim();
      if (!resolvedDatasourceId) {
        setQueries([]);
        setQueriesError("Please select Data Source first.");
        setLoadingQueries(false);
        return;
      }
      const now = Date.now();
      const cached = queriesCacheRef.current.get(resolvedDatasourceId);
      const isCacheValid =
        !forceReload &&
        cached &&
        Array.isArray(cached.data) &&
        now - cached.timestamp < QUERIES_CACHE_TTL_MS;

      if (isCacheValid) {
        logInfo(
          `Database queries: using cached data (age=${Math.round(
            (now - cached.timestamp) / 1000
          )}s)`
        );
        setQueries(cached.data);
        setQueriesError("");
        setLoadingQueries(false);
        return;
      }

      logInfo(`Database queries: fetch started for datasource=${resolvedDatasourceId}`);
      logDebug(
        `Database queries URL=/api/database/queries?datasource=${resolvedDatasourceId}&includeQuery=true`
      );

      setLoadingQueries(true);
      setQueriesError("");

      try {
        const body = await fetchQueriesByDatasourceId(resolvedDatasourceId, {
          includeQuery: true,
          size: 100,
        });
        if (signal?.aborted) return;

        const rawQueries = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.data?.content)
            ? body.data.content
          : Array.isArray(body?.data?.items)
            ? body.data.items
            : Array.isArray(body?.data?.records)
              ? body.data.records
            : Array.isArray(body)
              ? body
              : Array.isArray(body?.data?.queries)
                ? body.data.queries
                : Array.isArray(body?.queries)
                  ? body.queries
                  : Array.isArray(body?.results)
                    ? body.results
                    : [];

        const normalized = rawQueries
          .map((query, idx) => {
            if (typeof query === "string") {
              return {
                id: query,
                name: query,
                sql: "",
                timeoutSeconds: 30,
                dataSource: "default",
                queryType: "SQL",
                parameters: null,
                createdAt: null,
                updatedAt: null,
              };
            }

            const id =
              query?.id ??
              query?.queryId ??
              query?.name ??
              query?.queryName ??
              `query-${idx + 1}`;

            const name = query?.queryName ?? query?.name ?? `Query ${idx + 1}`;
            const sql =
              query?.sqlQuery ??
              query?.sql ??
              query?.query ??
              query?.statement ??
              "";
            const parameterDefinitions = resolveQueryParameterDefinitions({
              ...query,
              sql,
            });

            return {
              id,
              name,
              sql,
              timeoutSeconds: query?.timeoutSeconds ?? 30,
              timeoutMS:
                typeof query?.timeout === "number"
                  ? query.timeout
                  : typeof query?.timeoutMS === "number"
                    ? query.timeoutMS
                    : typeof query?.timeoutSeconds === "number"
                      ? query.timeoutSeconds * 1000
                      : 30000,
              dataSourceId:
                query?.datasource?.id ??
                query?.datasourceId ??
                query?.dataSourceId ??
                query?.dataSource?.id ??
                query?.connectionId ??
                resolvedDatasourceId ??
                "",
              dataSourceName:
                query?.datasource?.name ??
                query?.datasource ??
                query?.dataSourceName ??
                query?.dataSource?.name ??
                query?.dataSource ??
                "default",
              queryType: query?.queryType ?? query?.type ?? "SQL",
              parameters: parameterDefinitions,
              parameterDefinitions,
              defaultParams: buildQueryParamsFromDefinitions(parameterDefinitions),
              createdAt: query?.createdAt ?? null,
              updatedAt: query?.updatedAt ?? null,
            };
          })
          .filter((query) => Boolean(query.id));

        setQueries(normalized);
        queriesCacheRef.current.set(resolvedDatasourceId, {
          data: normalized,
          timestamp: Date.now(),
        });

        logInfo(
          `Database queries fetched successfully. total=${normalized.length}`
        );
      } catch (error) {
        if (error?.name === "AbortError") {
          logInfo("Database queries fetch aborted by caller.");
          return;
        }

        const msg =
          error?.message ||
          `GET ${config.apiBaseUrl}/api/database/queries failed`;
        logError(`Database queries fetch error: ${msg}`);
        setQueriesError(msg);
      } finally {
        setLoadingQueries(false);
      }
    },
    []
  );

  const handleReloadQueries = () => {
    const selectedDatasourceId = String(cfg?.dataSourceId || "").trim();
    if (!selectedDatasourceId) {
      showError("Please select Data Source first.");
      return;
    }
    const ctrl = new AbortController();
    fetchQueries(ctrl.signal, selectedDatasourceId, { forceReload: true });
  };

  const fetchDataSources = useCallback(async () => {
    logInfo("Database data sources: fetch started");
    setLoadingDataSources(true);
    setDataSourcesError("");
    try {
      const body = await fetchDatabaseDatasources({ minimal: true, size: 100 });
      const rawList = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.data?.content)
          ? body.data.content
          : Array.isArray(body?.data?.items)
            ? body.data.items
            : Array.isArray(body?.data?.records)
              ? body.data.records
        : Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body)
            ? body
            : [];
      const normalized = rawList
        .map((item) => {
          const name = String(item?.name ?? "").trim();
          const id = String(item?.id ?? item?.datasourceId ?? "").trim();
          return {
            id,
            name,
            type: String(item?.type ?? ""),
            status: String(item?.status ?? ""),
          };
        })
        .filter((item) => Boolean(item.id) && Boolean(item.name));
      setDataSources(normalized);
      logInfo(`Database data sources fetched successfully. total=${normalized.length}`);
    } catch (error) {
      const msg = error?.message || "Failed to fetch data sources.";
      logError(`Database data sources fetch error: ${msg}`);
      setDataSourcesError(msg);
    } finally {
      setLoadingDataSources(false);
    }
  }, []);

  const handleReloadDataSources = () => {
    fetchDataSources();
  };

  const openDataSourceMenu = () => {
    setDataSourceMenuOpen(true);
    fetchDataSources();
  };
  const closeDataSourceMenu = () => setDataSourceMenuOpen(false);

  const openMenu = () => {
    const selectedDatasourceId = String(cfg?.dataSourceId || "").trim();
    if (!selectedDatasourceId) {
      showError("Please select Data Source first.");
      return;
    }
    setMenuOpen(true);
    const ctrl = new AbortController();
    fetchQueries(ctrl.signal, selectedDatasourceId);
  };
  const closeMenu = () => setMenuOpen(false);

  const updateConfig = (patch) => {
    if (typeof onChange !== "function") return;
    onChange({
      config: {
        ...cfg,
        ...patch,
      },
    });
  };

  const handleActionNameChange = (value: string) => {
    if (typeof onChange !== "function") return;
    onChange({
      name: value,
      config: {
        ...cfg,
        queryName: cfg.queryId ? (cfg.queryName ?? value) : value,
        queryId: isUuid(cfg.queryId) ? cfg.queryId : "",
        isAdHoc: cfg.queryId ? cfg.isAdHoc : true,
      },
    });
  };

  const handleQueryNameChange = (value: string) => {
    if (typeof onChange !== "function") return;
    onChange({
      name: actionName || value,
      config: {
        ...cfg,
        queryName: value,
        queryId: "",
        parameterDefinitions: {},
        params: {},
        isAdHoc: true,
      },
    });
  };

  const handleQuerySelect = (query) => {
    if (typeof onChange !== "function") return;
    const parameterDefinitions =
      query?.parameterDefinitions && typeof query.parameterDefinitions === "object"
        ? query.parameterDefinitions
        : resolveQueryParameterDefinitions(query);
    const existingParams =
      cfg?.params && typeof cfg.params === "object" && !Array.isArray(cfg.params)
        ? cfg.params
        : {};
    const isSameQuery = String(cfg?.queryId ?? "") === String(query?.id ?? "");
    const nextParams = buildQueryParamsFromDefinitions(
      parameterDefinitions,
      existingParams,
      isSameQuery
    );

    onChange({
      name: actionName || query.name,
      config: {
        ...cfg,
        queryId: query.id ?? "",
        queryName: query.name ?? query.queryName ?? "",
        queryText: query.sql ?? "",
        timeoutMS:
          typeof query?.timeout === "number"
            ? query.timeout
            : typeof query?.timeoutMS === "number"
              ? query.timeoutMS
              : typeof query?.timeoutSeconds === "number"
                ? query.timeoutSeconds * 1000
                : cfg?.timeoutMS ?? 30000,
        parameterDefinitions,
        params: nextParams,
        isAdHoc: false,
      },
    });
    closeMenu();
  };

  const selectedDataSourceKey = String(cfg?.dataSourceId || "").trim();
  const selectedDataSourceLabel = useMemo(() => {
    const selected = dataSources.find((item) => String(item.id) === selectedDataSourceKey);
    return selected?.name || cfg?.dataSourceName || "";
  }, [dataSources, selectedDataSourceKey, cfg?.dataSourceName]);
  const filteredQueries = useMemo(() => queries, [queries]);

  const handleDataSourceSelect = (source) => {
    const selectedId = String(source?.id ?? "").trim();
    const selectedName = String(source?.name ?? "").trim();
    updateConfig({
      dataSourceId: selectedId,
      dataSourceName: selectedName,
      queryId: "",
      queryName: "",
      queryText: "",
      parameterDefinitions: {},
      params: {},
      timeoutMS: cfg?.timeoutMS ?? "",
      isAdHoc: false,
    });
    closeDataSourceMenu();
  };

  const parameterDefinitions =
    cfg?.parameterDefinitions &&
      typeof cfg.parameterDefinitions === "object" &&
      !Array.isArray(cfg.parameterDefinitions)
      ? cfg.parameterDefinitions
      : {};
  const params =
    cfg?.params && typeof cfg.params === "object" && !Array.isArray(cfg.params)
      ? cfg.params
      : {};
  const parameterDefinitionKeys = useMemo(
    () => Object.keys(parameterDefinitions),
    [parameterDefinitions]
  );

  useEffect(() => {
    if (parameterDefinitionKeys.length === 0) return;
    const missingKeys = parameterDefinitionKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(params, key)
    );
    if (missingKeys.length === 0) return;

    updateConfig({
      params: {
        ...buildQueryParamsFromDefinitions(parameterDefinitions),
        ...params,
      },
    });
  }, [parameterDefinitionKeys.join("|"), parameterDefinitions, params]);

  const paramsJsonValue = useMemo(() => JSON.stringify(params, null, 2), [params]);
  const [paramsJsonText, setParamsJsonText] = useState(paramsJsonValue);
  const [paramsJsonError, setParamsJsonError] = useState("");

  useEffect(() => {
    setParamsJsonText(paramsJsonValue);
    setParamsJsonError("");
  }, [paramsJsonValue]);

  const handleParamsJsonChange = (value) => {
    const nextValue = value ?? "";
    setParamsJsonText(nextValue);
    try {
      const parsed = nextValue.trim() ? JSON.parse(nextValue) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setParamsJsonError("Parameters JSON must be an object.");
        return;
      }
      setParamsJsonError("");
      updateConfig({ params: parsed });
    } catch {
      setParamsJsonError("Parameters JSON must be valid JSON.");
    }
  };

  const handleTimeoutChange = (raw: string) => {
    if (raw === "") {
      updateConfig({ timeoutMS: "" });
      return;
    }
    const parsed = Number(raw);
    updateConfig({ timeoutMS: Number.isFinite(parsed) ? parsed : raw });
  };

  return (
    <Box>
      <Box className="database-config-grid">
        <Box>
          <WeaverTextField
            label="Node Name *"
            value={actionName}
            onChange={handleActionNameChange}
            disabled={false}
            helperText={""}
            placeholder={"Query"}
          />
        </Box>
        <Box>
          <WeaverTextField
            label="Reference Name"
            value={cfg.name || ""}
            onChange={(value) => updateConfig({ name: value })}
            disabled={false}
            errorMessage={validationErrors.referenceName || undefined}
            placeholder={"database_query_xxxxxxxx"}
          />
        </Box>
        <Box ref={dataSourceFieldAnchorRef} sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
          <WeaverTextField
            label="Data Source"
            value={selectedDataSourceLabel}
            placeholder=""
            helperText={!selectedDataSourceKey ? "Select data source first." : ""}
            readOnly
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Reload data sources">
                      <span>
                        <IconButton
                          edge="end"
                          size="large"
                          onClick={handleReloadDataSources}
                          disabled={loadingDataSources}
                          sx={{ color: "var(--color-fg-default, #111827)" }}
                        >
                          {loadingDataSources ? (
                            <CircularProgress size={16} />
                          ) : (
                            <RefreshCcw size={16} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Select data source">
                      <IconButton
                        edge="end"
                        size="large"
                        onClick={openDataSourceMenu}
                        disableRipple={false}
                        sx={{ color: "var(--color-fg-default, #111827)" }}
                      >
                        <BracesIcon size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        {selectedDataSourceKey ? (
          <>
            <Box ref={queryFieldAnchorRef}>
              <WeaverTextField
                label="Query Id"
                value={cfg.queryName || ""}
                onChange={handleQueryNameChange}
                placeholder=""
                errorMessage={validationErrors.queryId || undefined}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Reload queries">
                          <span>
                            <IconButton
                              edge="end"
                              size="large"
                              onClick={handleReloadQueries}
                              disabled={loadingQueries}
                              sx={{ color: "var(--color-fg-default, #111827)" }}
                            >
                              {loadingQueries ? (
                                <CircularProgress size={16} />
                              ) : (
                                <RefreshCcw size={16} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Load query from templates">
                          <IconButton
                            edge="end"
                            size="large"
                            onClick={openMenu}
                            disableRipple={false}
                            sx={{ color: "var(--color-fg-default, #111827)" }}
                          >
                            <BracesIcon size={16} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box>
              <WeaverTextField
                label="Timeout (ms)"
                value={cfg.timeoutMS ?? ""}
                onChange={handleTimeoutChange}
                type="number"
                helperText=""
                placeholder="3000"
              />
            </Box>
          </>
        ) : null}
        <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Parameters
          </Typography>
          {Object.keys(parameterDefinitions).length === 0 ? (
            <Typography variant="caption" sx={{ color: "var(--color-fg-muted)", display: "block", mb: 1 }}>
              No parameters for selected query.
            </Typography>
          ) : null}
          <WeaverCodeEditor
            className="start-config-json-editor"
            language="json"
            value={paramsJsonText}
            onChange={handleParamsJsonChange}
            suggestions={toWeaverSuggestions(parameterOptions)}
            height="180px"
            options={{
              readOnly: false,
              lineNumbers: "on",
              renderLineHighlight: "none",
            }}
          />
          {paramsJsonError ? (
            <Typography variant="caption" color="error" sx={{ mt: 0.75, display: "block" }}>
              {paramsJsonError}
            </Typography>
          ) : null}
        </Box>
      </Box>

      {queriesError && (
        <Typography variant="caption" color="error">
          {queriesError}
        </Typography>
      )}

      <Menu
        id="database-datasource-menu"
        anchorEl={dataSourceFieldAnchorRef.current}
        open={dataSourceMenuOpen}
        onClose={closeDataSourceMenu}
        PaperProps={{
          sx: {
            width: dataSourceFieldAnchorRef.current
              ? dataSourceFieldAnchorRef.current.offsetWidth
              : undefined,
          },
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {loadingDataSources && (
          <MenuItem disabled>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={16} />
              <span>Loading data sources...</span>
            </Stack>
          </MenuItem>
        )}
        {!loadingDataSources && dataSourcesError && (
          <MenuItem disabled>Failed to load data sources.</MenuItem>
        )}
        {!loadingDataSources && !dataSourcesError && dataSources.length === 0 && (
          <MenuItem disabled>No data sources available</MenuItem>
        )}
        {dataSources.map((source) => (
          <MenuItem key={source.id} onClick={() => handleDataSourceSelect(source)}>
            {source.name}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        id="database-query-menu"
        anchorEl={queryFieldAnchorRef.current}
        open={menuOpen}
        onClose={closeMenu}
        PaperProps={{
          sx: {
            width: queryFieldAnchorRef.current
              ? queryFieldAnchorRef.current.offsetWidth
              : undefined,
          },
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {loadingQueries && (
          <MenuItem disabled>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="center"
            >
              <CircularProgress size={16} />
              <span>Loading queries...</span>
            </Stack>
          </MenuItem>
        )}
        {!loadingQueries && queriesError && (
          <MenuItem disabled>Failed to load queries.</MenuItem>
        )}
        {!loadingQueries && !queriesError && filteredQueries.length === 0 && (
          <MenuItem disabled>No queries available</MenuItem>
        )}
        {filteredQueries.map((q) => (
          <MenuItem key={q.id} onClick={() => handleQuerySelect(q)}>
            {q.name}
          </MenuItem>
        ))}
      </Menu>

    </Box>
  );
}

const ORIGIN_POSITION = { x: 0, y: 0 };

function DatabaseActionNodeBase({
  id,
  data,
  onRun,
  parameterOptions: parameterOptionsProp = undefined,
}) {
  const { setNodes, deleteElements, getNode } = useReactFlow();
  const { success: showSuccess, error: showError, warning: showWarning } = useWeaverNotification();
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = useState("configurations");
  const [runResultText, setRunResultText] = useState("");
  const [runLogs, setRunLogs] = useState([]);
  const [runStatus, setRunStatus] = useState("N/A");
  const [runTimeMs, setRunTimeMs] = useState(null);
  const [runResultSetSize, setRunResultSetSize] = useState(null);
  const [runAffectedRowsCount, setRunAffectedRowsCount] = useState(null);
  const [runErrorCode, setRunErrorCode] = useState("");
  const [runRequestId, setRunRequestId] = useState("");
  const [draftData, setDraftData] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [contextMenu, setContextMenu] = useState(null);

  // Suggestions are only needed (and computed) while the config modal is open.
  const lazyParameterOptions = useScopedParameterOptions(open && parameterOptionsProp === undefined);
  const parameterOptions = parameterOptionsProp ?? lazyParameterOptions;

  const currentNode = getNode ? getNode(id) : null;
  const nodePosition = currentNode?.position || ORIGIN_POSITION;

  const jsonRepresentation = useMemo(() => {
    if (!open) return null;
    return exportDatabaseActionData(draftData ?? data, id, nodePosition);
  }, [open, draftData, data, id, nodePosition]);

  const referenceName = data?.config?.name || data?.config?.queryName || "";
  const hasUnsavedChanges = useMemo(() => {
    if (!draftData) return false;
    try {
      return JSON.stringify(draftData) !== JSON.stringify(data ?? {});
    } catch {
      return true;
    }
  }, [draftData, data]);
  const taskCode = useMemo(
    () => (open ? JSON.stringify(buildDatabaseTaskCode(draftData ?? data, id), null, 2) : ""),
    [open, draftData, data, id]
  );

  const handleOpen = (e) => {
    e.stopPropagation();
    const existingRefName = String(data?.config?.name ?? "").trim();
    const cloned = {
      ...(data ?? {}),
      config: {
        ...(data?.config ?? {}),
        name: existingRefName || generateDatabaseReferenceName(),
      },
    };
    setDraftData(cloned);
    setActiveTab("configurations");
    setValidationErrors({});
    setOpen(true);
  };
  const closeAndResetModal = useCallback(() => {
    setOpen(false);
    setDraftData(null);
    setActiveTab("configurations");
    setValidationErrors({});
  }, []);

  const handleClose = (_event, _reason) => {
    if (hasUnsavedChanges) {
      const nodeDisplayName = String(draftData?.name || data?.name || "Database Node");
      showWarning(`${nodeDisplayName} has unsaved changes. Please click Save first.`);
      return;
    }
    closeAndResetModal();
  };

  const handleCancel = (event) => {
    event?.stopPropagation?.();
    closeAndResetModal();
  };

  const toJson = (v, fallback) => {
    if (v == null || v === "") return fallback;
    if (typeof v === "object") return v;
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  };

  const handleRun = async (e) => {
    e.stopPropagation();
    const startedAt = Date.now();
    setActiveTab("result");

    const sourceData = draftData ?? data;
    const cfg = sourceData?.config ?? {};
    // The SQL comes from the node config (set when the query was picked); nothing is loaded by query id.
    const resolvedSql = String(cfg.queryText ?? "").trim();
    const resolvedDatasourceId = String(cfg.datasourceId || cfg.dataSourceId || "").trim();
    if (!resolvedSql || !resolvedDatasourceId) {
      const reason = !resolvedDatasourceId
        ? "A datasource is required before running the Database node."
        : "A query is required before running the Database node.";
      showError(reason);
      setRunLogs((prev) => [...prev, `[${new Date().toISOString()}] Error: ${reason}`]);
      return;
    }
    const params = toJson(cfg.params, {});
    const timeoutMsRaw = cfg.timeoutMS;
    const timeoutMsNumber =
      timeoutMsRaw === "" || timeoutMsRaw == null ? null : Number(timeoutMsRaw);
    const payload = {
      datasource: resolvedDatasourceId,
      sql: resolvedSql,
      parameters: params,
      ...(Number.isFinite(timeoutMsNumber) && timeoutMsNumber > 0
        ? { timeout: timeoutMsNumber }
        : {}),
    };

    try {
      const dataOut = await executeDatabaseQuery(payload);

      const responseEnvelope =
        dataOut && typeof dataOut === "object" ? dataOut : {};
      const queryResult =
        responseEnvelope?.data && typeof responseEnvelope.data === "object"
          ? responseEnvelope.data
          : responseEnvelope;
      const resultSet = Array.isArray(queryResult?.resultSet)
        ? queryResult.resultSet
        : [];
      const mappedStatus = String(queryResult?.status ?? responseEnvelope?.status ?? "N/A");
      const mappedSize =
        typeof queryResult?.size === "number" ? queryResult.size : resultSet.length;
      const mappedAffectedRows =
        typeof queryResult?.affectedRows === "number"
          ? queryResult.affectedRows
          : typeof queryResult?.affectedRowsCount === "number"
            ? queryResult.affectedRowsCount
            : null;
      const mappedRequestId =
        responseEnvelope?.requestId != null ? String(responseEnvelope.requestId) : "";
      const mappedErrorCode =
        queryResult?.errorCode != null ? String(queryResult.errorCode) : "";
      const mappedExecutionTime =
        typeof queryResult?.duration === "number"
          ? queryResult.duration
          : typeof queryResult?.executionTime === "number"
            ? queryResult.executionTime
            : Date.now() - startedAt;
      const prettyResult =
        typeof dataOut === "string"
          ? dataOut
          : JSON.stringify(
            resultSet.length ? resultSet : queryResult ?? responseEnvelope ?? {},
            null,
            2
          );

      setRunResultText(prettyResult || "{}");
      setRunStatus(mappedStatus);
      setRunTimeMs(mappedExecutionTime);
      setRunResultSetSize(mappedSize);
      setRunAffectedRowsCount(mappedAffectedRows);
      setRunErrorCode(mappedErrorCode);
      setRunRequestId(mappedRequestId);

      setRunLogs((prev) => [
        ...prev,
        `[${new Date().toISOString()}] Success: query executed`,
      ]);
    } catch (err) {
      logError("Database execute error", err);
      showError(`Database node "${data?.name || "Query"}" error: ${err?.message || String(err)}`);
      setRunLogs((prev) => [
        ...prev,
        `[${new Date().toISOString()}] Error: ${err?.message || String(err)}`,
      ]);
      setRunStatus("FAILED");
      setRunTimeMs(Date.now() - startedAt);
      setRunResultSetSize(null);
      setRunAffectedRowsCount(null);
      setRunErrorCode("");
      setRunRequestId("");
      setRunResultText("{}");
    }

    if (typeof onRun === "function") onRun(sourceData);
  };

  const handleConfigChange = (nextData) => {
    const hasConfigPatch = Boolean(nextData?.config);
    const shouldClearReferenceError =
      hasConfigPatch && Object.prototype.hasOwnProperty.call(nextData.config, "name");
    const shouldClearQueryError = Boolean(
      String(nextData?.config?.queryId ?? "").trim()
    );
    if (shouldClearReferenceError || shouldClearQueryError) {
      setValidationErrors((prev) => {
        if (!prev.referenceName && !prev.queryId) return prev;
        const next = { ...prev };
        if (shouldClearReferenceError) delete next.referenceName;
        if (shouldClearQueryError) delete next.queryId;
        return next;
      });
    }
    setDraftData((prev) => {
      const prevData = prev ?? data ?? {};
      const prevConfig = prevData.config ?? {};
      const nextConfig = nextData?.config ?? {};
      return {
        ...prevData,
        ...nextData,
        config: {
          ...prevConfig,
          ...nextConfig,
        },
      };
    });
  };

  const handleSave = () => {
    const sourceData = draftData ?? data;
    const cfg = sourceData?.config ?? {};
    const referenceNameValue = String(cfg.name ?? "").trim();
    const queryIdValue = String(cfg.queryId ?? "").trim();
    const nextErrors = {};

    if (!referenceNameValue) {
      nextErrors.referenceName = "Reference Name is required.";
    } else if (!isValidJavaVariableName(referenceNameValue)) {
      nextErrors.referenceName =
        "Reference Name must be a valid Java variable name.";
    }

    if (!queryIdValue) {
      nextErrors.queryId = "Select a query before saving.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      showError("Please fix validation errors before saving.");
      return;
    }

    setValidationErrors({});
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          data: sourceData,
        };
      })
    );
    closeAndResetModal();
  };

  const customTabs = useMemo(
    () => [
      { id: "result", label: "Result", icon: <QueryStatsIcon fontSize="small" /> },
      { id: "logs", label: "Logs", icon: <ReceiptLongIcon fontSize="small" /> },
    ],
    []
  );

  const resultTabContent = (
    <Box>
      <Box className="database-result-cards">
        <Box className="http-result-card database-result-card database-result-card-status">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <CheckCircleOutlineOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Status</Typography>
          </Box>
          <Typography className="http-result-card-value">{runStatus}</Typography>
        </Box>
        <Box className="http-result-card database-result-card database-result-card-time">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <AccessTimeOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Time (ms)</Typography>
          </Box>
          <Typography className="http-result-card-value">
            {runTimeMs == null ? "N/A" : String(runTimeMs)}
          </Typography>
        </Box>
        <Box className="http-result-card database-result-card database-result-card-size">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <NumbersOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Result Set Size</Typography>
          </Box>
          <Typography className="http-result-card-value">
            {runResultSetSize == null ? "N/A" : String(runResultSetSize)}
          </Typography>
        </Box>
        <Box className="http-result-card database-result-card database-result-card-affected">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <NumbersOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Affected rows count</Typography>
          </Box>
          <Typography className="http-result-card-value">
            {runAffectedRowsCount == null ? "N/A" : String(runAffectedRowsCount)}
          </Typography>
        </Box>
        <Box className="http-result-card database-result-card database-result-card-errorcode">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <NumbersOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Error code</Typography>
          </Box>
          <Typography className="http-result-card-value">
            {runErrorCode || "N/A"}
          </Typography>
        </Box>
        <Box className="http-result-card database-result-card database-result-card-requestid">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <FingerprintOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Request Id</Typography>
          </Box>
          <Typography className="http-result-card-value">
            {runRequestId || "N/A"}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ mt: 1.5, mb: 0.75 }} className="http-result-subtitle">
        Data
      </Typography>
      <WeaverCodeEditor
        className="start-config-json-editor"
        language="json"
        value={runResultText || "{}"}
        height="45vh"
        options={{
          readOnly: true,
          lineNumbers: "on",
          renderLineHighlight: "none",
        }}
      />
    </Box>
  );

  const logsTabContent = (
    <WeaverCodeEditor
      className="start-config-json-editor"
      language="plaintext"
      value={runLogs.length ? runLogs.join("\n") : "No logs yet."}
      height="55vh"
      options={{
        readOnly: true,
        lineNumbers: "off",
        renderLineHighlight: "none",
        wordWrap: "on",
      }}
    />
  );

  return (
    <>
      <WeaverTaskNode
        id={id}
        title={data?.name || "Query"}
        taskReferenceName={referenceName}
        description={data?.config?.description || data?.description || "Run a DB query or command"}
        icon={DatabaseIcon}
        color={TASK_NODE_COLORS.database}
        className="database-node-card"
        targetHandleId="query-input"
        sourceHandleId="query-output"
        onDoubleClick={handleOpen}
        contextMenuItems={[
          {
            label: "Run",
            icon: <PlayArrowIcon fontSize="small" />,
            onClick: () => handleRun(),
          },
        ]}
      />

      <ActionConfigModal
        open={open}
        title="Database Node"
        nodeDisplayName={draftData?.name || data?.name || "Database Node"}
        initialData={data}
        draftData={draftData}
        modalWidth={1200}
        onClose={closeAndResetModal}
        onSave={handleSave}
        onRun={handleRun}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        customTabs={customTabs}
        customTabContent={{ result: resultTabContent, logs: logsTabContent }}
        jsonRepresentation={jsonRepresentation}
        jsonReadOnly={true}
        parameterOptions={parameterOptions}
        className="database-config-modal"
      >
        <DatabaseActionProps
          data={draftData ?? data}
          onChange={handleConfigChange}
          validationErrors={validationErrors}
          parameterOptions={parameterOptions}
        />
      </ActionConfigModal>
    </>
  );
}

export const DatabaseActionNode = React.memo(DatabaseActionNodeBase);

export default DatabaseActionNode;
