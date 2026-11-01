import React, { useEffect, useState, useMemo, useRef } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import {
  WeaverSelectField,
  WeaverTextField,
} from "@/components/common/fields";
import { WeaverCodeEditor } from "@/components/common/editors";
import type { WeaverEditorSuggestion } from "@/components/common/editors/WeaverCodeEditor/WeaverCodeEditor.types";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import { NodeIdentityFields } from "../../common/NodeIdentityFields";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { fetchDatasources } from "@/features/databases";
import { fetchQueriesByDatasourceId, fetchQueryById } from "@/features/queries";
import { formatSql } from "@/utils/sqlFormat";
import {
  buildScopedSuggestions,
} from "@/features/designer/utils/contextMap";

/**
 * Parses raw parameters into a normalized { [paramName]: dataType } map.
 */
const parseParameterDefinitions = (rawParameters: any): Record<string, string> => {
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
    return parsed.reduce((definitions: Record<string, string>, item: any) => {
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

  return Object.entries(parsed).reduce(
    (definitions: Record<string, string>, [rawName, rawType]: [string, any]) => {
      const name = String(rawName ?? "").trim();
      if (!name) return definitions;
      const type =
        rawType && typeof rawType === "object" && !Array.isArray(rawType)
          ? rawType.type ?? rawType.dataType ?? rawType.parameterType ?? rawType.valueType
          : rawType;
      definitions[name] = String(type ?? "STRING").trim() || "STRING";
      return definitions;
    },
    {}
  );
};

/**
 * Parses SQL text for ':parameterName' tokens.
 */
const parseSqlParameterDefinitions = (sql = ""): Record<string, string> => {
  const text = String(sql || "");
  if (!text.trim()) return {};
  const definitions: Record<string, string> = {};
  const pattern = /(^|[^:]):([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match = pattern.exec(text);
  while (match) {
    const name = String(match[2] || "").trim();
    if (name) definitions[name] = "STRING";
    match = pattern.exec(text);
  }
  return definitions;
};

/**
 * Resolves parameter definitions from explicit query definitions or by parsing SQL code.
 */
const resolveQueryParameterDefinitions = (query: any = {}): Record<string, string> => {
  const explicitDefinitions = parseParameterDefinitions(
    query?.parameters ?? query?.params ?? query?.parameterDefinitions
  );
  if (Object.keys(explicitDefinitions).length > 0) return explicitDefinitions;
  return parseSqlParameterDefinitions(
    query?.sql ?? query?.sqlQuery ?? query?.query ?? query?.queryText ?? query?.statement
  );
};

export const DatabaseNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}) => {
  const cfg = value || {};

  // Designer store context for workflow variables & inputs
  const nodes = useDesignerStore((state) => state.nodes);
  const edges = useDesignerStore((state) => state.edges);
  const workflowName = useDesignerStore((state) => state.workflowName);
  const workflowVersion = useDesignerStore((state) => state.workflowVersion);
  const workflowVariables = useDesignerStore((state) => state.workflowVariables);

  // Datasources state
  const [datasources, setDatasources] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingDs, setLoadingDs] = useState(false);

  // Queries state
  const [queries, setQueries] = useState<any[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(false);

  // Fetch datasources on mount
  useEffect(() => {
    let active = true;
    setLoadingDs(true);
    fetchDatasources()
      .then((res: any) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const mapped = list.map((ds: any) => ({
          value: String(ds.id || ds.name),
          label: String(ds.name || ds.id),
        }));
        setDatasources(mapped);
      })
      .catch((err) => {
        console.error("Failed to fetch datasources:", err);
      })
      .finally(() => {
        if (active) setLoadingDs(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedDatasourceId = String(
    cfg.datasourceId || cfg.dataSourceId || cfg.datasourceName || ""
  );
  const selectedQueryId = String(cfg.queryId || cfg.queryName || "");

  // Fetch queries when selected datasource changes
  useEffect(() => {
    if (!selectedDatasourceId) {
      setQueries([]);
      setLoadingQueries(false);
      return;
    }

    let active = true;
    setLoadingQueries(true);
    fetchQueriesByDatasourceId(selectedDatasourceId, { size: 100 } as any)
      .then((res: any) => {
        if (!active) return;
        const body = res?.data ?? res ?? {};
        const list = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.data?.content)
            ? body.data.content
            : Array.isArray(body?.data?.items)
              ? body.data.items
              : Array.isArray(body?.items)
                ? body.items
                : Array.isArray(body)
                  ? body
                  : Array.isArray(res)
                    ? res
                    : [];
        setQueries(list);
      })
      .catch((err) => {
        console.error("Failed to fetch queries for datasource:", err);
        if (active) setQueries([]);
      })
      .finally(() => {
        if (active) setLoadingQueries(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDatasourceId]);

  // Map queries into options, preserving any existing selection
  const queryOptions = useMemo(() => {
    const mapped = queries.map((q: any) => ({
      value: String(q.id || q.queryId || q.name),
      label: String(q.name || q.queryName || q.id),
      raw: q,
    }));

    if (cfg.queryId && !mapped.some((o) => o.value === String(cfg.queryId))) {
      mapped.unshift({
        value: String(cfg.queryId),
        label: String(cfg.queryName || cfg.queryId),
        raw: null,
      });
    }

    return mapped;
  }, [queries, cfg.queryId, cfg.queryName]);

  const handleDatasourceChange = (v: string) => {
    const selected = datasources.find((d) => d.value === v);
    onChange({
      datasourceId: v,
      datasourceName: selected?.label || v,
      dataSourceId: v,
      dataSourceName: selected?.label || v,
      queryId: "",
      queryName: "",
      query: "",
      sql: "",
      queryText: "",
      parameters: {},
      params: {},
    });
  };

  const handleQueryChange = (v: string) => {
    const queryId = String(v || "");
    if (!queryId) {
      onChange({
        queryId: "",
        queryName: "",
        query: "",
        sql: "",
        queryText: "",
        parameters: {},
        params: {},
      });
      return;
    }

    const foundOption = queryOptions.find((opt) => opt.value === queryId);
    const selectedQuery =
      foundOption?.raw ||
      queries.find((q: any) => String(q.id || q.queryId || q.name) === queryId);

    const queryName =
      selectedQuery?.name ||
      selectedQuery?.queryName ||
      foundOption?.label ||
      queryId;

    // Extract SQL code (stored minified by the backend; formatted for the editor)
    const sqlCode = formatSql(String(
      selectedQuery?.sql ??
      selectedQuery?.sqlQuery ??
      selectedQuery?.query ??
      selectedQuery?.statement ??
      selectedQuery?.queryText ??
      ""
    ));

    // Extract parameters
    const paramDefs = resolveQueryParameterDefinitions(selectedQuery || { sql: sqlCode });
    const nextParams: Record<string, string> = {};
    for (const key of Object.keys(paramDefs)) {
      nextParams[key] = "";
    }

    // Extract timeout, default to 5000 if not provided
    const queryTimeout =
      typeof selectedQuery?.timeout === "number" && !isNaN(selectedQuery.timeout)
        ? selectedQuery.timeout
        : typeof selectedQuery?.timeoutMs === "number" && !isNaN(selectedQuery.timeoutMs)
          ? selectedQuery.timeoutMs
          : typeof selectedQuery?.timeoutMS === "number" && !isNaN(selectedQuery.timeoutMS)
            ? selectedQuery.timeoutMS
            : typeof selectedQuery?.timeoutSeconds === "number" && !isNaN(selectedQuery.timeoutSeconds)
              ? selectedQuery.timeoutSeconds * 1000
              : 5000;

    onChange({
      queryId,
      queryName,
      query: sqlCode,
      sql: sqlCode,
      queryText: sqlCode,
      parameters: nextParams,
      params: nextParams,
      parameterDefinitions: paramDefs,
      timeout: queryTimeout,
      timeoutMs: queryTimeout,
      timeoutMS: queryTimeout,
    });

    // If query has no SQL in summary list, fetch full query definition
    if (!sqlCode && queryId) {
      fetchQueryById(queryId, true)
        .then((res: any) => {
          const fullQuery = res?.data || res;
          if (fullQuery) {
            const fullSql = formatSql(String(
              fullQuery.sql ||
              fullQuery.sqlQuery ||
              fullQuery.query ||
              fullQuery.statement ||
              fullQuery.queryText ||
              ""
            ));
            const fullParamDefs = resolveQueryParameterDefinitions(fullQuery);
            const p: Record<string, string> = {};
            for (const k of Object.keys(fullParamDefs)) {
              p[k] = "";
            }
            const fullTimeout =
              typeof fullQuery.timeout === "number" && !isNaN(fullQuery.timeout)
                ? fullQuery.timeout
                : typeof fullQuery.timeoutMs === "number" && !isNaN(fullQuery.timeoutMs)
                  ? fullQuery.timeoutMs
                  : typeof fullQuery.timeoutMS === "number" && !isNaN(fullQuery.timeoutMS)
                    ? fullQuery.timeoutMS
                    : typeof fullQuery.timeoutSeconds === "number" && !isNaN(fullQuery.timeoutSeconds)
                      ? fullQuery.timeoutSeconds * 1000
                      : 5000;

            onChange({
              query: fullSql,
              sql: fullSql,
              queryText: fullSql,
              parameters: p,
              params: p,
              parameterDefinitions: fullParamDefs,
              timeout: fullTimeout,
              timeoutMs: fullTimeout,
              timeoutMS: fullTimeout,
            });
          }
        })
        .catch(() => {
          // Keep current state if fetch fails
        });
    }
  };

  const handleFieldChange = (field: string, val: any) => {
    onChange({ [field]: val });
  };

  const formatParams = (val: any) => {
    if (val === undefined || val === null) return "{}";
    if (typeof val === "string") return val;
    try {
      return JSON.stringify(val || {}, null, 2);
    } catch {
      return "{}";
    }
  };

  const handleParamsChange = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      onChange({ parameters: parsed, params: parsed });
    } catch {
      onChange({ parameters: text, params: text });
    }
  };

  // Build suggestion tokens strictly from workflow inputs, variables, and upstream node outputs
  const suggestionTokens = useMemo(() => {
    const scoped = buildScopedSuggestions({
      nodes,
      edges,
      selectedNodeId: node?.id || "",
      workflowName: workflowName || "",
      workflowVersion: Number(workflowVersion) || 1,
      workflowVariables: workflowVariables ?? {},
    });

    return scoped.suggestions || [];
  }, [nodes, edges, node?.id, workflowName, workflowVersion, workflowVariables]);

  // Monaco editor suggestions for SQL and Parameters
  const editorSuggestions: WeaverEditorSuggestion[] = useMemo(() => {
    return suggestionTokens.map((token, index) => {
      let detail = "Suggestion";
      let doc = token;

      if (token.includes("workflow.input.")) {
        const param = token.replace("${workflow.input.", "").replace("}", "");
        detail = "Workflow Input";
        doc = `Workflow input parameter: "${param}"`;
      } else if (token.includes("workflow.variables.")) {
        const v = token.replace("${workflow.variables.", "").replace("}", "");
        detail = "Workflow Variable";
        doc = `Defined workflow variable: "${v}"`;
      } else if (token.includes(".output.")) {
        const parts = token.replace("${", "").replace("}", "").split(".output.");
        const nodeRef = parts[0];
        const path = parts[1] ? `output.${parts[1]}` : "output";
        detail = `Node Output (${nodeRef})`;
        doc = `Output property from upstream node "${nodeRef}": ${path}`;
      }

      return {
        label: token,
        insertText: token,
        detail,
        documentation: doc,
        sortText: `${token.includes("workflow.input")
          ? "0"
          : token.includes("workflow.variables")
            ? "1"
            : "2"
          }_${String(index).padStart(5, "0")}`,
        filterText: `${token} ${token.replace(/[${}]/g, "")}`,
        insertAsSnippet: false,
      };
    });
  }, [suggestionTokens]);

  // Timeout handling (number or workflow expression)
  const timeoutValue =
    cfg.timeout !== undefined
      ? String(cfg.timeout)
      : cfg.timeoutMs !== undefined
        ? String(cfg.timeoutMs)
        : cfg.timeoutMS !== undefined
          ? String(cfg.timeoutMS)
          : "5000";

  const [timeoutSuggestionsOpen, setTimeoutSuggestionsOpen] = useState(false);
  const timeoutInputRef = useRef<HTMLInputElement | null>(null);
  const timeoutCursorPositionRef = useRef<number | null>(null);

  const handleTimeoutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      (e.code === "Space" || e.key === " ");

    if (isCtrlSpace) {
      e.preventDefault();
      e.stopPropagation();
      timeoutCursorPositionRef.current =
        e.currentTarget.selectionStart ?? timeoutValue.length;
      setTimeoutSuggestionsOpen((prev) => !prev);
    }
  };

  const handleTimeoutSelectToken = (token: string) => {
    const currentVal = timeoutValue;
    const cursor =
      timeoutCursorPositionRef.current ??
      timeoutInputRef.current?.selectionStart ??
      currentVal.length;

    const before = currentVal.slice(0, cursor);
    const after = currentVal.slice(cursor);

    const lastOpenBrace = before.lastIndexOf("${");
    if (lastOpenBrace !== -1 && !before.slice(lastOpenBrace).includes("}")) {
      const cleanBefore = before.slice(0, lastOpenBrace);
      const nextVal = `${cleanBefore}${token}${after}`;
      onChange({ timeout: nextVal, timeoutMs: nextVal, timeoutMS: nextVal });
      return;
    }

    if (!currentVal.trim() || !isNaN(Number(currentVal))) {
      onChange({ timeout: token, timeoutMs: token, timeoutMS: token });
      return;
    }

    const nextVal = `${before}${token}${after}`;
    onChange({ timeout: nextVal, timeoutMs: nextVal, timeoutMS: nextVal });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General" defaultExpanded={true}>
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          defaultNodeName="Query"
          readOnly={readOnly}
          disabled={disabled}
        />

        <WeaverSelectField
          label="Datasource"
          value={selectedDatasourceId}
          options={datasources}
          onChange={handleDatasourceChange}
          readOnly={readOnly}
          disabled={disabled || loadingDs}
        />

        <WeaverSelectField
          label="Query"
          value={selectedQueryId}
          options={queryOptions}
          onChange={handleQueryChange}
          readOnly={readOnly}
          disabled={disabled || loadingQueries || !selectedDatasourceId}
        />
      </NodeConfigSection>

      <NodeConfigSection title="SQL Query" defaultExpanded={true}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="sql"
            value={cfg.query !== undefined ? cfg.query : cfg.sql || ""}
            onChange={(v) => handleFieldChange("query", v)}
            suggestions={editorSuggestions}
            readOnly={readOnly}
            height="100%"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
            }}
          />
        </div>
      </NodeConfigSection>

      <NodeConfigSection title="Parameters" defaultExpanded={true}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="json"
            value={formatParams(cfg.parameters !== undefined ? cfg.parameters : cfg.params || {})}
            onChange={handleParamsChange}
            suggestions={editorSuggestions}
            readOnly={readOnly}
            height="100%"
            options={{ minimap: { enabled: false }, fontSize: 12 }}
          />
        </div>
      </NodeConfigSection>

      <NodeConfigSection title="Advanced" defaultExpanded={true}>
        <Autocomplete
          freeSolo
          forcePopupIcon={false}
          options={suggestionTokens}
          open={timeoutSuggestionsOpen && suggestionTokens.length > 0}
          onClose={() => setTimeoutSuggestionsOpen(false)}
          value={timeoutValue}
          inputValue={timeoutValue}
          onInputChange={(_event, nextInputValue, reason) => {
            if (reason === "input" || reason === "clear") {
              const val = nextInputValue ?? "";
              if (val.includes("${")) {
                setTimeoutSuggestionsOpen(true);
              }
              const num = Number(val);
              if (val !== "" && !isNaN(num) && Number.isFinite(num)) {
                onChange({ timeout: num, timeoutMs: num, timeoutMS: num });
              } else {
                onChange({ timeout: val, timeoutMs: val, timeoutMS: val });
              }
            }
          }}
          onChange={(_event, nextValue) => {
            if (nextValue) {
              handleTimeoutSelectToken(String(nextValue));
            }
            setTimeoutSuggestionsOpen(false);
          }}
          filterOptions={(options, state) => {
            const input = state.inputValue || "";
            const lastBrace = input.lastIndexOf("${");
            if (lastBrace === -1) {
              return options;
            }
            const query = input.slice(lastBrace).toLowerCase().trim();
            const cleanQuery = query.replace(/[${}]/g, "");
            if (!cleanQuery) return options;
            return options.filter((opt) => opt.toLowerCase().includes(cleanQuery));
          }}
          renderOption={(props, option) => {
            const isInput = option.includes("workflow.input");
            const isVar = option.includes("workflow.variables");
            const category = isInput ? "Input" : isVar ? "Variable" : "Node Output";
            const badgeColor = isInput ? "#0969da" : isVar ? "#1a7f37" : "#8250df";

            return (
              <li
                {...props}
                key={option}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 12px",
                  fontSize: 13,
                }}
              >
                <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{option}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                    backgroundColor: `color-mix(in srgb, ${badgeColor} 15%, transparent)`,
                    color: badgeColor,
                    fontWeight: 600,
                    marginLeft: 8,
                  }}
                >
                  {category}
                </span>
              </li>
            );
          }}
          renderInput={(params) => (
            <WeaverTextField
              {...params}
              ref={timeoutInputRef}
              label="Query Timeout (ms)"
              value={timeoutValue}
              onChange={(v) => {
                const num = Number(v);
                if (v !== "" && !isNaN(num) && Number.isFinite(num)) {
                  onChange({ timeout: num, timeoutMs: num, timeoutMS: num });
                } else {
                  onChange({ timeout: v, timeoutMs: v, timeoutMS: v });
                }
              }}
              readOnly={readOnly}
              disabled={disabled}
              placeholder="5000"
              onKeyDown={handleTimeoutKeyDown}
            />
          )}
        />
      </NodeConfigSection>
    </div>
  );
};
