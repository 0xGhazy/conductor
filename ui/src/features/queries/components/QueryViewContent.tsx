import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Avatar,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
  TextField,
  Tooltip,
  IconButton,
  Breadcrumbs,
  Link,
  Chip,
  InputAdornment,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TerminalIcon from "@mui/icons-material/Terminal";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import NumbersIcon from "@mui/icons-material/Numbers";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import DataObjectIcon from "@mui/icons-material/DataObject";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useWeaverNotification } from "@/components/common/notifications";
import { getErrorMessage } from "@/utils/error";
import {
  formatExactDateTime,
  formatTooltipDateTime,
  formatRelativeTime,
} from "@/utils/dateTime";
import { getUserName, getAvatarUrl, getInitials } from "@/utils/user";
import {
  createQuery,
  deleteQuery,
  executeQuery,
  updateQuery,
} from "@/features/queries/services/queriesApi";
import { datasourceKeys, fetchDatasources } from "@/features/databases";
import { queryDefinitionKeys } from "@/features/queries/hooks/queryKeys";
import { useQueryDefinition } from "@/features/queries/hooks/useQueryDefinitions";
import {
  buildEmptyQuery,
  buildParamStateFromParameters,
  buildTestPayload,
  extractQueryParams,
  normalizeDatasource,
  normalizeQuery,
  validateQueryForm,
} from "@/features/queries/services/queriesService";
import type { AuditFields, QueryExecutionResult } from "@/features/queries/types/queryTypes";
import QueryResultsView from "@/features/queries/components/QueryResultsView";
import "@/styles/definitionPages.css";

const PARAM_TYPE_OPTIONS = [
  { value: "STRING", label: "STRING", icon: <TextFieldsIcon sx={{ fontSize: 16 }} /> },
  { value: "INTEGER", label: "INTEGER", icon: <NumbersIcon sx={{ fontSize: 16 }} /> },
  { value: "LONG", label: "LONG", icon: <NumbersIcon sx={{ fontSize: 16 }} /> },
  { value: "DOUBLE", label: "DOUBLE", icon: <NumbersIcon sx={{ fontSize: 16 }} /> },
  { value: "FLOAT", label: "FLOAT", icon: <NumbersIcon sx={{ fontSize: 16 }} /> },
  { value: "DECIMAL", label: "DECIMAL", icon: <NumbersIcon sx={{ fontSize: 16 }} /> },
  { value: "BOOLEAN", label: "BOOLEAN", icon: <ToggleOnIcon sx={{ fontSize: 16 }} /> },
  { value: "UUID", label: "UUID", icon: <FingerprintIcon sx={{ fontSize: 16 }} /> },
  { value: "DATE", label: "DATE", icon: <CalendarTodayOutlinedIcon sx={{ fontSize: 16 }} /> },
  { value: "TIME", label: "TIME", icon: <AccessTimeOutlinedIcon sx={{ fontSize: 16 }} /> },
  { value: "DATETIME", label: "DATETIME", icon: <AccessTimeOutlinedIcon sx={{ fontSize: 16 }} /> },
  { value: "TIMESTAMP", label: "TIMESTAMP", icon: <AccessTimeOutlinedIcon sx={{ fontSize: 16 }} /> },
  { value: "JSON", label: "JSON", icon: <DataObjectIcon sx={{ fontSize: 16 }} /> },
  { value: "JSONB", label: "JSONB", icon: <DataObjectIcon sx={{ fontSize: 16 }} /> },
  { value: "LIST", label: "LIST", icon: <DataObjectIcon sx={{ fontSize: 16 }} /> },
  { value: "BINARY", label: "BINARY", icon: <FingerprintIcon sx={{ fontSize: 16 }} /> },
];

type DraftForm = Record<string, unknown> | null | undefined;

/** Safe property access on loosely-shaped API payloads. */
const getField = (value: unknown, key: string): unknown =>
  value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;

interface DraftSnapshot {
  name: string;
  description: string;
  sql: string;
  dataSource: string;
  timeoutMs: number;
  paramTypes: Record<string, string>;
}

const buildDraftParamTypes = (parameterKeys: string[], paramTypes: Record<string, string>) => {
  const safeKeys = Array.isArray(parameterKeys) ? parameterKeys : [];
  return safeKeys.reduce((acc: Record<string, string>, key) => {
    acc[key] = paramTypes?.[key] ?? "STRING";
    return acc;
  }, {});
};

/** Snapshot of the persisted draft, computed once at hydration/save (not per keystroke). */
const buildDraftSnapshot = (
  form: DraftForm,
  parameterKeys: string[],
  paramTypes: Record<string, string>
): DraftSnapshot => {
  const safeForm = form || {};
  return {
    name: String(safeForm?.name ?? ""),
    description: String(safeForm?.description ?? ""),
    sql: String(safeForm?.sql ?? ""),
    dataSource: String(safeForm?.dataSource ?? ""),
    timeoutMs: Number(safeForm?.timeoutMs ?? 3000),
    paramTypes: buildDraftParamTypes(parameterKeys, paramTypes),
  };
};

/** Cheap field-by-field comparison of the current form against a stored snapshot. */
const matchesDraftSnapshot = (
  snapshot: DraftSnapshot,
  form: DraftForm,
  parameterKeys: string[],
  paramTypes: Record<string, string>
) => {
  const safeForm = form || {};
  if (snapshot.name !== String(safeForm?.name ?? "")) return false;
  if (snapshot.description !== String(safeForm?.description ?? "")) return false;
  if (snapshot.dataSource !== String(safeForm?.dataSource ?? "")) return false;
  if (!Object.is(snapshot.timeoutMs, Number(safeForm?.timeoutMs ?? 3000))) return false;
  if (snapshot.sql !== String(safeForm?.sql ?? "")) return false;

  const currentParamTypes = buildDraftParamTypes(parameterKeys, paramTypes);
  const snapshotKeys = Object.keys(snapshot.paramTypes);
  const currentKeys = Object.keys(currentParamTypes);
  if (snapshotKeys.length !== currentKeys.length) return false;
  return currentKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(snapshot.paramTypes, key) &&
      snapshot.paramTypes[key] === currentParamTypes[key]
  );
};

const DATASOURCE_SELECT_PARAMS = { page: 0, size: 100, sort: "createdAt,DESC" };
const DATASOURCE_SELECT_STALE_TIME = 5 * 60 * 1000;

const getDatasourceStatusColor = (status: string) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ACTIVE") return "#16a34a";
  if (normalized === "INACTIVE" || normalized === "ERROR") return "#dc2626";
  return "var(--color-fg-muted, #6b7280)";
};

export interface QueryViewContentProps {
  isCreateMode?: boolean;
  onBack?: () => void;
}

export default function QueryViewContent({
  isCreateMode: propIsCreateMode,
  onBack: propOnBack,
}: QueryViewContentProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isCreateMode = propIsCreateMode ?? (!id || location.pathname === "/queries/new");
  const { error: showError, success: showSuccess } = useWeaverNotification();

  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);

  const [form, setForm] = useState(buildEmptyQuery());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [paramTypes, setParamTypes] = useState<Record<string, string>>({});

  // Inline execution result states
  const [resultError, setResultError] = useState("");
  const [resultValue, setResultValue] = useState<QueryExecutionResult | null>(null);

  // Editor UX
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Unsaved & Delete dialogs
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [unsavedActionLabel, setUnsavedActionLabel] = useState("continue");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [draftSnapshot, setDraftSnapshot] = useState<DraftSnapshot>(() =>
    buildDraftSnapshot(buildEmptyQuery(), [], {})
  );
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const unsavedResolverRef = useRef<((val: string) => void) | null>(null);

  const isEditMode = !isCreateMode && !!id;
  const queryDetail = useQueryDefinition(id, !isCreateMode);

  const datasourcesQuery = useQuery({
    queryKey: datasourceKeys.list(DATASOURCE_SELECT_PARAMS),
    queryFn: () => fetchDatasources(DATASOURCE_SELECT_PARAMS),
    staleTime: DATASOURCE_SELECT_STALE_TIME,
  });
  const datasourcesLoading = datasourcesQuery.isPending;

  const datasourceOptions = useMemo(() => {
    const response = datasourcesQuery.data;
    if (!response) return [];
    const body = getField(response, "data") ?? {};
    const data =
      getField(getField(body, "data"), "items") ?? getField(body, "data") ?? getField(body, "items") ?? body ?? [];
    const list = Array.isArray(data) ? data : [];
    return list.map(normalizeDatasource);
  }, [datasourcesQuery.data]);

  // Hydrate the form from the fetched record once per id (during render, so there is no
  // empty-form flash). Background refetches never clobber in-progress edits.
  if (!isCreateMode && id && queryDetail.data && hydratedFor !== id) {
    const response = queryDetail.data;
    const body = getField(response, "data") ?? {};
    const data = getField(body, "data") ?? body ?? {};
    const normalized = normalizeQuery(data);
    const { nextParamTypes, nextParamValues } = buildParamStateFromParameters(
      normalized?.parameters || {}
    );
    const normalizedKeysInfo = extractQueryParams(normalized?.sql || "");
    const normalizedKeys = [...normalizedKeysInfo.named, ...normalizedKeysInfo.positional];

    setHydratedFor(id);
    setForm(normalized);
    setParamTypes((prev) => ({ ...prev, ...nextParamTypes }));
    setTestParams((prev) => ({ ...prev, ...nextParamValues }));
    setResultError("");
    setResultValue(null);
    setFormErrors({});
    setDraftSnapshot(buildDraftSnapshot(normalized, normalizedKeys, nextParamTypes || {}));
  }

  const loading = isEditMode && queryDetail.isPending;

  const parameterInfo = useMemo(() => extractQueryParams(form?.sql || ""), [form?.sql]);
  const parameterKeys = useMemo(
    () => [...parameterInfo.named, ...parameterInfo.positional],
    [parameterInfo]
  );

  const hasUnsavedChanges = useMemo(
    () => !matchesDraftSnapshot(draftSnapshot, form, parameterKeys, paramTypes),
    [draftSnapshot, form, parameterKeys, paramTypes]
  );

  const datasourceSelectOptions = useMemo(() => {
    const options = Array.isArray(datasourceOptions) ? datasourceOptions : [];
    const currentDatasourceId = form?.dataSource ? String(form.dataSource) : "";
    const hasCurrentOption = options.some(
      (item) => String(item.id || "") === currentDatasourceId
    );

    if (!currentDatasourceId || hasCurrentOption) {
      return options;
    }

    return [
      {
        id: currentDatasourceId,
        name: form?.dataSourceName || currentDatasourceId,
        status: "",
      },
      ...options,
    ];
  }, [datasourceOptions, form?.dataSource, form?.dataSourceName]);

  const auditFields = useMemo<Partial<AuditFields>>(
    () => ({
      createdAt: form?.createdAt || "",
      createdBy: {
        name: getUserName(form?.createdBy, "Unknown creator"),
        avatarUrl: getAvatarUrl(form?.createdBy),
      },
      updatedAt: form?.updatedAt || "",
      updatedBy: {
        name: getUserName(form?.updatedBy, "Not modified"),
        avatarUrl: getAvatarUrl(form?.updatedBy),
      },
    }),
    [form?.createdAt, form?.createdBy, form?.updatedAt, form?.updatedBy]
  );

  useEffect(() => {
    setTestParams((prev) => {
      const next: Record<string, string> = {};
      parameterKeys.forEach((key) => {
        next[key] = Object.prototype.hasOwnProperty.call(prev || {}, key) ? prev[key] : "";
      });
      return next;
    });

    setParamTypes((prev) => {
      const next: Record<string, string> = {};
      parameterKeys.forEach((key) => {
        next[key] = Object.prototype.hasOwnProperty.call(prev || {}, key)
          ? prev[key]
          : "STRING";
      });
      return next;
    });
  }, [parameterKeys]);

  useEffect(() => {
    if (!datasourcesQuery.error) return;
    showError(getErrorMessage(datasourcesQuery.error, "Failed to load datasources."));
  }, [datasourcesQuery.error, showError]);

  useEffect(() => {
    if (!queryDetail.error) return;
    showError(getErrorMessage(queryDetail.error, "Failed to load query."));
  }, [queryDetail.error, showError]);

  // Create mode: reset to an empty (optionally pre-selected datasource) draft.
  useEffect(() => {
    if (!isCreateMode) return;
    const searchParams = new URLSearchParams(location.search);
    const preselectedId = searchParams.get("datasourceId") || (location.state as any)?.datasourceId || "";
    const preselectedName = searchParams.get("datasourceName") || (location.state as any)?.datasourceName || "";

    const empty = {
      ...buildEmptyQuery(),
      ...(preselectedId
        ? {
            dataSource: preselectedId,
            dataSourceName: preselectedName || preselectedId,
          }
        : {}),
    };
    setForm(empty);
    setResultError("");
    setResultValue(null);
    setFormErrors({});
    setDraftSnapshot(buildDraftSnapshot(empty, [], {}));
    setHydratedFor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isCreateMode]);

  useEffect(() => {
    const name = String(form?.name || "").trim();
    document.title = name ? `Query: ${name}` : isCreateMode ? "New Query" : "Query";
  }, [form?.name, isCreateMode]);

  // Header breadcrumb shows the saved query name (not the id, and not every keystroke).
  const savedName = useMemo(() => {
    const body = getField(queryDetail.data, "data") ?? {};
    const data = getField(body, "data") ?? body ?? {};
    return String(getField(data, "name") ?? "").trim();
  }, [queryDetail.data]);
  useEffect(() => {
    if (isCreateMode || !savedName) return;
    window.dispatchEvent(
      new CustomEvent("weaver:breadcrumb-title", {
        detail: { title: savedName, pathname: window.location.pathname },
      })
    );
  }, [savedName, isCreateMode]);

  const handleChange = (field: string, value: unknown) => {
    setForm((prev: any) => ({ ...(prev || {}), [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleDatasourceChange = (value: string) => {
    const selected = datasourceSelectOptions.find(
      (item) => String(item.id || "") === String(value || "")
    );

    setForm((prev: any) => ({
      ...(prev || {}),
      dataSource: value,
      dataSourceName: selected?.name ?? prev?.dataSourceName ?? "",
    }));
    setFormErrors((prev) => ({ ...prev, dataSource: "" }));
  };

  const handleSave = async () => {
    const { isValid, errors, payload } = validateQueryForm(
      form,
      parameterKeys,
      paramTypes,
      ({ message }: any) => showError(message)
    );
    setFormErrors(errors || {});
    if (!isValid) return false;

    setSubmitting(true);
    try {
      const response =
        isCreateMode || !form?.id
          ? await createQuery(payload)
          : await updateQuery(form.id || id, payload);

      const body = response?.data ?? {};
      const data = body?.data ?? body ?? payload;
      const normalized = normalizeQuery(data);
      setForm(normalized);

      const { nextParamTypes, nextParamValues } = buildParamStateFromParameters(
        normalized?.parameters || {}
      );
      setParamTypes((prev) => ({ ...prev, ...nextParamTypes }));
      setTestParams((prev) => ({ ...prev, ...nextParamValues }));

      const normalizedKeysInfo = extractQueryParams(normalized?.sql || "");
      const normalizedKeys = [...normalizedKeysInfo.named, ...normalizedKeysInfo.positional];
      setDraftSnapshot(buildDraftSnapshot(normalized, normalizedKeys, nextParamTypes || {}));

      // Refresh lists/details in the background. The form already reflects the saved record,
      // so we keep the current hydration (no refetch-driven form reset).
      void queryClient.invalidateQueries({ queryKey: queryDefinitionKeys.all });
      // The database page shows its queries inside the database response.
      void queryClient.invalidateQueries({ queryKey: datasourceKeys.details() });

      if (isCreateMode && normalized?.id) {
        navigate(`/queries/${encodeURIComponent(normalized.id)}`, { replace: true });
      }

      showSuccess(isCreateMode ? "Query created successfully." : "Query updated successfully.");
      return true;
    } catch (error) {
      showError(getErrorMessage(error, isCreateMode ? "Failed to create query." : "Failed to update query."));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const askUnsavedDecision = useCallback(
    (actionLabel: string) =>
      new Promise<string>((resolve) => {
        setUnsavedActionLabel(actionLabel);
        setUnsavedDialogOpen(true);
        unsavedResolverRef.current = resolve;
      }),
    []
  );

  const resolveUnsavedDecision = useCallback((decision: string) => {
    setUnsavedDialogOpen(false);
    const resolver = unsavedResolverRef.current;
    unsavedResolverRef.current = null;
    resolver?.(decision);
  }, []);

  const confirmDraftAction = useCallback(
    async (actionLabel: string) => {
      if (!hasUnsavedChanges) return true;

      const decision = await askUnsavedDecision(actionLabel);
      if (decision === "save") {
        return await handleSave();
      }
      if (decision === "discard") {
        return true;
      }
      return false;
    },
    [askUnsavedDecision, hasUnsavedChanges, handleSave]
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleDelete = () => {
    const queryId = String(form?.id || id || "").trim();
    if (!queryId) return;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const queryId = String(form?.id || id || "").trim();
    if (!queryId) return;
    setSubmitting(true);
    try {
      await deleteQuery(queryId);
      queryClient.removeQueries({ queryKey: queryDefinitionKeys.detail(queryId) });
      void queryClient.invalidateQueries({ queryKey: queryDefinitionKeys.all });
      // The database page shows its queries inside the database response.
      void queryClient.invalidateQueries({ queryKey: datasourceKeys.details() });
      showSuccess("Query deleted successfully.");
      if (propOnBack) {
        propOnBack();
      } else {
        navigate("/queries");
      }
    } catch (error) {
      showError(getErrorMessage(error, "Failed to delete query."));
    } finally {
      setSubmitting(false);
      setDeleteDialogOpen(false);
    }
  };

  const lastRunTimeRef = useRef(0);

  // Test execution via ad-hoc execution (works in both saved and ad-hoc modes)
  const handleTest = useCallback(async () => {
    if (testing) return;

    const now = Date.now();
    if (now - lastRunTimeRef.current < 400) {
      return;
    }
    lastRunTimeRef.current = now;

    if (!form?.sql?.trim()) {
      showError("SQL is required to run a test.");
      setFormErrors((prev) => ({ ...prev, sql: "SQL is required to run a test." }));
      return;
    }

    const resolvedDatasource =
      (typeof form?.dataSource === "object" && form?.dataSource !== null
        ? (form.dataSource as any).id
        : form?.dataSource) ||
      (typeof (form as any)?.datasource === "object" && (form as any)?.datasource !== null
        ? (form as any).datasource?.id
        : (form as any)?.datasource) ||
      "";

    if (!resolvedDatasource) {
      showError("Select a database to execute the query.");
      setFormErrors((prev) => ({ ...prev, dataSource: "Database is required to run a test." }));
      return;
    }

    setTesting(true);
    setResultError("");
    setResultValue(null);

    try {
      const payload = buildTestPayload(
        { ...form, dataSource: resolvedDatasource },
        parameterKeys,
        testParams,
        paramTypes
      );
      const response = await executeQuery(payload);
      const data = response?.data ?? null;
      setResultValue(data as QueryExecutionResult);
    } catch (error: any) {
      const errData = error?.response?.data ?? null;
      setResultError(getErrorMessage(error, "Query execution failed."));
      if (errData && typeof errData === "object") {
        setResultValue(errData.data ?? errData);
      }
    } finally {
      setTesting(false);
    }
  }, [form, parameterKeys, testParams, paramTypes, testing, showError]);

  const handleTestRef = useRef(handleTest);
  useEffect(() => {
    handleTestRef.current = handleTest;
  });

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    // Intercept Ctrl+Enter (Cmd+Enter on macOS) inside Monaco editor to trigger query execution
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleTestRef.current();
    });
  }, []);

  // Global window listener: Ctrl+Enter (Cmd+Enter) executes the query even if focused outside the editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleTestRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleCopySql = async () => {
    if (!form?.sql) return;
    try {
      await navigator.clipboard.writeText(form.sql);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleGoBack = useCallback(async () => {
    const proceed = await confirmDraftAction("going back to queries");
    if (!proceed) return;
    if (propOnBack) {
      propOnBack();
    } else {
      navigate("/queries");
    }
  }, [confirmDraftAction, propOnBack, navigate]);

  return (
    <div className="definitions-page">

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={unsavedDialogOpen}
        onClose={() => resolveUnsavedDecision("cancel")}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            You have unsaved changes in this query. Choose to save, discard, or cancel before {unsavedActionLabel}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => resolveUnsavedDecision("cancel")} variant="text" disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => resolveUnsavedDecision("discard")} variant="outlined" color="warning" disabled={submitting}>
            Discard
          </Button>
          <Button onClick={() => resolveUnsavedDecision("save")} variant="contained" startIcon={<SaveIcon />} disabled={submitting}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Query Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (submitting) return;
          setDeleteDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Query</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete <strong>{form?.name || "this query"}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} variant="text" disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} variant="contained" color="error" disabled={submitting}>
            {submitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <div className="definitions-content">
        {/* Navigation Breadcrumb Bar */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5, flexWrap: "wrap", gap: 1.5 }}>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
            <Link
              component={RouterLink}
              to="/queries"
              underline="hover"
              color="inherit"
              sx={{ display: "flex", alignItems: "center", gap: 0.5, fontWeight: 500 }}
              onClick={(e) => {
                e.preventDefault();
                handleGoBack();
              }}
            >
              <ArrowBackIcon fontSize="small" />
              Queries
            </Link>
            <Typography color="text.primary" sx={{ fontWeight: 600 }}>
              {isCreateMode ? "New Query" : (form?.name || "Query Details")}
            </Typography>
          </Breadcrumbs>

          {/* Action Header Buttons */}
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {!isCreateMode && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleDelete}
                disabled={submitting || loading}
              >
                Delete
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={submitting || loading}
            >
              {submitting ? (isCreateMode ? "Creating..." : "Saving...") : (isCreateMode ? "Create" : "Save Changes")}
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
            <CircularProgress size={36} />
          </Box>
        ) : (
          /* Two-Column Responsive Layout */
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "380px minmax(0, 1fr)" },
              gap: 2.5,
              alignItems: "start",
              width: "100%",
              maxWidth: "100%",
            }}
          >
            {/* Left Column: Query Configuration & Audit Details */}
            <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: 2.5,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  background: "var(--color-canvas-default, #ffffff)",
                })}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                  <InfoOutlinedIcon fontSize="small" sx={{ color: "primary.main" }} />
                  Configuration
                </Typography>

                <Box sx={{ display: "grid", gap: 2 }}>
                  <TextField
                    label="Query Name"
                    value={form?.name || ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                    fullWidth
                    size="small"
                    required
                    error={Boolean(formErrors.name)}
                    helperText={formErrors.name}
                    inputProps={{ maxLength: 200 }}
                  />

                  <Box>
                    <FormControl fullWidth size="small" error={Boolean(formErrors.dataSource)} disabled={datasourcesLoading}>
                      <InputLabel id="datasource-select-label">Database</InputLabel>
                      <Select
                        labelId="datasource-select-label"
                        value={form?.dataSource || ""}
                        label="Database"
                        onChange={(e) => handleDatasourceChange(e.target.value)}
                        renderValue={(value) => {
                          const selected = datasourceSelectOptions.find(
                            (item) => String(item.id || "") === String(value || "")
                          );
                          if (!selected) return value || "";
                          const color = getDatasourceStatusColor(selected.status);
                          return (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <FiberManualRecordIcon sx={{ fontSize: 10, color }} />
                              <span>{selected.name}</span>
                            </span>
                          );
                        }}
                      >
                        {datasourceSelectOptions.map((datasource) => (
                          <MenuItem key={datasource.id || datasource.name} value={datasource.id || ""}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <FiberManualRecordIcon
                                sx={{
                                  fontSize: 10,
                                  color: getDatasourceStatusColor(datasource.status),
                                }}
                              />
                              <span>{datasource.name}</span>
                            </span>
                          </MenuItem>
                        ))}
                      </Select>
                      {formErrors.dataSource && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                          {formErrors.dataSource}
                        </Typography>
                      )}
                    </FormControl>
                  </Box>

                  <TextField
                    label="Timeout (ms)"
                    type="number"
                    value={form?.timeoutMs ?? 3000}
                    onChange={(e) => handleChange("timeoutMs", e.target.value)}
                    fullWidth
                    size="small"
                    error={Boolean(formErrors.timeoutMs)}
                    helperText={formErrors.timeoutMs}
                    inputProps={{ min: 100, max: 60000 }}
                  />

                  <TextField
                    label="Description"
                    value={form?.description || ""}
                    onChange={(e) => handleChange("description", e.target.value)}
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    placeholder="Describe the business purpose or expected output of this query..."
                  />
                </Box>
              </Paper>

              {/* Audit Details (Visible only in Edit Mode) */}
              {!isCreateMode && (
                <Paper
                  elevation={0}
                  sx={(theme) => ({
                    p: 2,
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    background: "var(--color-canvas-default, #ffffff)",
                  })}
                >
                  <Typography variant="caption" sx={{ textTransform: "uppercase", fontWeight: 700, color: "text.secondary", letterSpacing: 0.8 }}>
                    Audit History
                  </Typography>

                  <Box sx={{ display: "grid", gap: 1.5, mt: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar
                        src={auditFields.createdBy?.avatarUrl}
                        sx={{ width: 28, height: 28, fontSize: 11, bgcolor: "primary.main" }}
                      >
                        {getInitials(auditFields.createdBy?.name || "")}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 11 }}>
                          Created by <strong>{auditFields.createdBy?.name || "Unknown"}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                          {formatExactDateTime(auditFields.createdAt)}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar
                        src={auditFields.updatedBy?.avatarUrl}
                        sx={{ width: 28, height: 28, fontSize: 11, bgcolor: "secondary.main" }}
                      >
                        {getInitials(auditFields.updatedBy?.name || "")}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 11 }}>
                          Modified by <strong>{auditFields.updatedBy?.name || "Not modified"}</strong>
                        </Typography>
                        <Tooltip title={formatTooltipDateTime(auditFields.updatedAt)} arrow>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, cursor: "pointer" }}>
                            {formatRelativeTime(auditFields.updatedAt)}
                          </Typography>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}
            </Box>

            {/* Right Column: Merged SQL Editor & Parameters Section, and Execution Results */}
            <Box sx={{ display: "grid", gap: 2.5, minWidth: 0, width: "100%", maxWidth: "100%" }}>
              {/* Unified SQL Query & Parameters Card */}
              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: 2.5,
                  borderRadius: 2,
                  border: `1px solid ${formErrors.sql ? theme.palette.error.main : theme.palette.divider}`,
                  background: "var(--color-canvas-default, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                })}
              >
                {/* Editor Header Toolbar */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TerminalIcon fontSize="small" sx={{ color: "primary.main" }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      SQL Query Statement
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Tooltip title={sqlCopied ? "Copied!" : "Copy SQL"}>
                      <IconButton size="small" onClick={handleCopySql}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={editorExpanded ? "Collapse Editor" : "Expand Editor"}>
                      <IconButton size="small" onClick={() => setEditorExpanded((prev) => !prev)}>
                        {editorExpanded ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>

                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={handleTest}
                      disabled={testing}
                      sx={{ ml: 0.5, fontWeight: 700 }}
                    >
                      {testing ? "Running..." : "Run (Ctrl+Enter)"}
                    </Button>
                  </Box>
                </Box>

                {/* Monaco Editor Container */}
                <Box
                  sx={{
                    borderRadius: 1.5,
                    overflow: "hidden",
                    border: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
                  }}
                >
                  <WeaverCodeEditor
                    height={editorExpanded ? "520px" : "320px"}
                    language="sql"
                    value={form?.sql || ""}
                    onChange={(value) => handleChange("sql", value ?? "")}
                    onMount={handleEditorMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: "on",
                    }}
                  />
                </Box>

                {formErrors.sql && (
                  <Typography variant="caption" color="error" sx={{ mt: -0.5, display: "block" }}>
                    {formErrors.sql}
                  </Typography>
                )}

                <Divider sx={{ my: 0.5, borderColor: "var(--color-border-muted, rgba(127,127,127,0.15))" }} />

                {/* Parameters Sub-section */}
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TuneOutlinedIcon fontSize="small" sx={{ color: "primary.main" }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Parameters
                      </Typography>
                      <Chip
                        label={`${parameterKeys.length} detected`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
                      />
                    </Box>
                  </Box>

                  {parameterKeys.length > 0 ? (
                    <Box sx={{ display: "grid", gap: 1.25 }}>
                      {parameterKeys.map((key) => (
                        <Box
                          key={key}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "140px 180px 1fr" },
                            gap: 1.25,
                            alignItems: "center",
                            p: 1.25,
                            borderRadius: 1.5,
                            bgcolor: "var(--color-canvas-subtle, rgba(127,127,127,0.05))",
                            border: "1px solid var(--color-border-default, rgba(255,255,255,0.06))",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              label={`:${key}`}
                              size="small"
                              sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}
                            />
                          </Box>

                          <FormControl size="small" fullWidth>
                            <InputLabel id={`param-type-${key}`}>Type</InputLabel>
                            <Select
                              labelId={`param-type-${key}`}
                              value={paramTypes[key] ?? "STRING"}
                              label="Type"
                              onChange={(e) =>
                                setParamTypes((prev) => ({
                                  ...(prev || {}),
                                  [key]: e.target.value,
                                }))
                              }
                            >
                              {PARAM_TYPE_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    {opt.icon}
                                    <span>{opt.label}</span>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <TextField
                            placeholder="Enter runtime test value..."
                            value={testParams[key] ?? ""}
                            onChange={(e) =>
                              setTestParams((prev) => ({
                                ...(prev || {}),
                                [key]: e.target.value,
                              }))
                            }
                            fullWidth
                            size="small"
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 11 }}>
                                    Test:
                                  </Typography>
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", py: 0.5 }}>
                      No named parameters detected in SQL query. Use <code>:parameterName</code> syntax to declare parameters.
                    </Typography>
                  )}
                </Box>
              </Paper>

              {/* Inline Execution Results Panel */}
              {(resultValue != null || Boolean(resultError)) && (
                <QueryResultsView
                  result={resultValue}
                  resultError={resultError}
                  onClose={() => {
                    setResultValue(null);
                    setResultError("");
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </div>
    </div>
  );
}
