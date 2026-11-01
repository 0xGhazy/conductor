import React, { useState, useEffect, useMemo, useRef } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import {
  WeaverTextField,
  WeaverSelectField,
  WeaverNumberField,
} from "@/components/common/fields";
import { WeaverCodeEditor } from "@/components/common/editors";
import type { WeaverEditorSuggestion } from "@/components/common/editors/WeaverCodeEditor/WeaverCodeEditor.types";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import { NodeIdentityFields } from "../../common/NodeIdentityFields";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { fetchConnections } from "@/features/connections";
import { fetchCollections as fetchApiCollections, fetchCollectionEndpoints } from "@/features/collections";
import type { ApiCollection, CollectionEndpoint } from "@/features/collections";
import {
  buildScopedSuggestions,
  buildSimpleContextMap,
  flattenContextMapSuggestions,
} from "@/features/designer/utils/contextMap";

import {
  HTTP_METHOD_OPTIONS,
  DEFAULT_HTTP_HEADERS as DEFAULT_HEADERS_OBJ,
  DEFAULT_HTTP_HEADERS_STR,
  DEFAULT_HTTP_TIMEOUT,
} from "@/features/designer/utils/httpConstants";

export const HttpNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}) => {
  const cfg = value || {};

  // Access designer store for workflow context
  const nodes = useDesignerStore((state) => state.nodes);
  const edges = useDesignerStore((state) => state.edges);
  const workflowName = useDesignerStore((state) => state.workflowName);
  const workflowVersion = useDesignerStore((state) => state.workflowVersion);
  const workflowVariables = useDesignerStore((state) => state.workflowVariables);

  // Connection options state
  const [connectionOptions, setConnectionOptions] = useState<
    Array<{ value: string; label: string }>
  >([{ value: "--NONE--", label: "--NONE--" }]);

  // Fetch available connections on mount
  useEffect(() => {
    let isCancelled = false;
    fetchConnections({ page: 0, size: 200 })
      .then((res: any) => {
        if (isCancelled) return;
        const body = res?.data ?? res ?? {};
        const items =
          body?.data?.items ?? body?.items ?? (Array.isArray(body) ? body : []);
        const names: string[] = (Array.isArray(items) ? items : [])
          .map((item: any) => item?.name?.trim())
          .filter(Boolean);

        const uniqueNames = Array.from(new Set(names));
        const opts = [
          { value: "--NONE--", label: "--NONE--" },
          ...uniqueNames.map((name) => ({ value: name, label: name })),
        ];

        // Preserve current configured connection if not already in options
        if (
          cfg.connection &&
          cfg.connection !== "--NONE--" &&
          !uniqueNames.includes(cfg.connection)
        ) {
          opts.push({ value: cfg.connection, label: cfg.connection });
        }

        setConnectionOptions(opts);
      })
      .catch((err) => {
        console.error("Failed to fetch connections for HttpNodeConfig:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [cfg.connection]);

  // Collections and Endpoints state
  const [collections, setCollections] = useState<ApiCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [endpoints, setEndpoints] = useState<CollectionEndpoint[]>([]);
  const [endpointsLoading, setEndpointsLoading] = useState(false);

  const selectedCollectionId = String(cfg.collection || cfg.collectionId || "");
  const selectedEndpointId = String(cfg.endpoint || cfg.endpointId || "");

  // Fetch collections on mount
  useEffect(() => {
    let isCancelled = false;
    setCollectionsLoading(true);
    fetchApiCollections({ page: 0, size: 200, sort: "createdAt,DESC" })
      .then((res: any) => {
        if (isCancelled) return;
        const body = res?.data ?? res ?? {};
        const data =
          body?.data?.items ??
          body?.data ??
          body?.items ??
          (Array.isArray(body) ? body : []);
        setCollections(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load collections for HttpNodeConfig:", err);
      })
      .finally(() => {
        if (!isCancelled) setCollectionsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch endpoints whenever selectedCollectionId changes
  useEffect(() => {
    if (!selectedCollectionId) {
      setEndpoints([]);
      return;
    }

    let isCancelled = false;
    setEndpointsLoading(true);
    fetchCollectionEndpoints(selectedCollectionId, { page: 0, size: 500 })
      .then((res: any) => {
        if (isCancelled) return;
        const body = res?.data ?? res ?? {};
        const data =
          body?.data?.items ??
          body?.data ??
          body?.items ??
          (Array.isArray(body) ? body : []);
        setEndpoints(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load collection endpoints for HttpNodeConfig:", err);
      })
      .finally(() => {
        if (!isCancelled) setEndpointsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedCollectionId]);

  const collectionOptions = useMemo(() => {
    const base = [{ value: "", label: "-- None / Custom --" }];
    const items = collections.map((c) => ({
      value: String(c.id),
      label: c.name || String(c.id),
    }));
    if (
      selectedCollectionId &&
      !items.some((i) => i.value === selectedCollectionId)
    ) {
      items.unshift({
        value: selectedCollectionId,
        label: selectedCollectionId,
      });
    }
    return [...base, ...items];
  }, [collections, selectedCollectionId]);

  const endpointOptions = useMemo(() => {
    const base = [{ value: "", label: "-- Select Endpoint --" }];
    const items = endpoints.map((ep) => {
      const epId = String(ep.id || ep.endpointId || "");
      const method = ep.config?.method ? `[${String(ep.config.method).toUpperCase()}] ` : "";
      return {
        value: epId,
        label: `${method}${ep.name || epId}`,
      };
    });
    if (
      selectedEndpointId &&
      !items.some((i) => i.value === selectedEndpointId)
    ) {
      items.unshift({
        value: selectedEndpointId,
        label: selectedEndpointId,
      });
    }
    return [...base, ...items];
  }, [endpoints, selectedEndpointId]);

  const handleCollectionChange = (val: string) => {
    onChange({
      collection: val,
      collectionId: val,
      endpoint: "",
      endpointId: "",
    });
  };

  const handleEndpointChange = (val: string) => {
    const endpointId = String(val || "");
    if (!endpointId) {
      onChange({
        endpoint: "",
        endpointId: "",
      });
      return;
    }

    const endpoint = endpoints.find(
      (ep) => String(ep.id || ep.endpointId || "") === endpointId
    );

    if (!endpoint) {
      onChange({
        endpoint: endpointId,
        endpointId,
      });
      return;
    }

    const rawConfig = endpoint.config ?? {};
    const cfgFromEndpoint =
      typeof rawConfig === "string"
        ? (() => {
            try {
              return JSON.parse(rawConfig);
            } catch {
              return {};
            }
          })()
        : rawConfig;

    const patch: Record<string, any> = {
      endpoint: endpointId,
      endpointId,
    };

    if (cfgFromEndpoint.method) {
      patch.method = String(cfgFromEndpoint.method).toUpperCase();
    }
    if (cfgFromEndpoint.url) {
      patch.url = String(cfgFromEndpoint.url);
    }
    if (cfgFromEndpoint.headers && typeof cfgFromEndpoint.headers === "object") {
      patch.headers = cfgFromEndpoint.headers;
    }
    if (cfgFromEndpoint.body !== undefined) {
      patch.body = cfgFromEndpoint.body;
    }
    if (endpoint.connection) {
      patch.connection = endpoint.connection;
    }

    onChange(patch);
  };

  // Seed default headers if not provided or empty
  useEffect(() => {
    if (
      !cfg.headers ||
      cfg.headers === "{}" ||
      (typeof cfg.headers === "object" && Object.keys(cfg.headers).length === 0)
    ) {
      onChange({ headers: DEFAULT_HEADERS_OBJ });
    }
  }, []);

  const handleFieldChange = (field: string, val: any) => {
    onChange({ [field]: val });
  };

  const handleJsonFieldChange = (field: string, text: string) => {
    handleFieldChange(field, text);
  };

  const formatHeadersJson = (val: any) => {
    if (!val) return DEFAULT_HTTP_HEADERS_STR;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed || trimmed === "{}") return DEFAULT_HTTP_HEADERS_STR;
      try {
        const parsed = JSON.parse(val);
        if (
          parsed &&
          typeof parsed === "object" &&
          Object.keys(parsed).length === 0
        ) {
          return DEFAULT_HTTP_HEADERS_STR;
        }
        return JSON.stringify(parsed, null, 2);
      } catch {
        return val;
      }
    }
    if (typeof val === "object") {
      if (Object.keys(val).length === 0) return DEFAULT_HTTP_HEADERS_STR;
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return DEFAULT_HTTP_HEADERS_STR;
      }
    }
    return DEFAULT_HTTP_HEADERS_STR;
  };

  const formatJson = (val: any) => {
    if (typeof val === "string") return val;
    try {
      return JSON.stringify(val || {}, null, 2);
    } catch {
      return "{}";
    }
  };

  // Build suggestions for defined variables, workflow inputs, and upstream nodes output
  const suggestionTokens = useMemo(() => {
    // Scoped suggestions strictly from workflow inputs, variables, and upstream ancestor nodes
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

  // Monaco editor suggestions for Headers and Request Body
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
        sortText: `${token.includes("workflow.input") ? "0" : token.includes("workflow.variables") ? "1" : "2"}_${String(index).padStart(5, "0")}`,
        filterText: `${token} ${token.replace(/[${}]/g, "")}`,
        insertAsSnippet: false,
      };
    });
  }, [suggestionTokens]);

  // URL Autocomplete & Ctrl+Space handling
  const [urlSuggestionsOpen, setUrlSuggestionsOpen] = useState(false);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const cursorPositionRef = useRef<number | null>(null);

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      (e.code === "Space" || e.key === " ");

    if (isCtrlSpace) {
      e.preventDefault();
      e.stopPropagation();
      cursorPositionRef.current = e.currentTarget.selectionStart ?? (cfg.url || "").length;
      setUrlSuggestionsOpen((prev) => !prev);
    }
  };

  const handleUrlSelectToken = (token: string) => {
    const currentUrl = cfg.url || "";
    const cursor = cursorPositionRef.current ?? urlInputRef.current?.selectionStart ?? currentUrl.length;

    const before = currentUrl.slice(0, cursor);
    const after = currentUrl.slice(cursor);

    // If before ends with an unclosed '${...', replace the partial token
    const lastOpenBrace = before.lastIndexOf("${");
    if (lastOpenBrace !== -1 && !before.slice(lastOpenBrace).includes("}")) {
      const cleanBefore = before.slice(0, lastOpenBrace);
      const nextUrl = `${cleanBefore}${token}${after}`;
      handleFieldChange("url", nextUrl);
      return;
    }

    if (!currentUrl.trim()) {
      handleFieldChange("url", token);
      return;
    }

    handleFieldChange("url", `${before}${token}${after}`);
  };

  // HTTP keeps its worker name in `name`, so its reference is read from taskReferenceName first.
  const referenceName =
    cfg.taskReferenceName || cfg.referenceName || cfg.name || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General" defaultExpanded={true}>
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          referenceName={referenceName}
          defaultNodeName="HTTP"
          readOnly={readOnly}
          disabled={disabled}
        />
      </NodeConfigSection>

      <NodeConfigSection title="Request" defaultExpanded={true}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <WeaverSelectField
            label="Collection"
            value={selectedCollectionId}
            options={collectionOptions}
            onChange={handleCollectionChange}
            readOnly={readOnly}
            disabled={disabled || collectionsLoading}
          />

          <WeaverSelectField
            label="Endpoint"
            value={selectedEndpointId}
            options={endpointOptions}
            onChange={handleEndpointChange}
            readOnly={readOnly}
            disabled={disabled || endpointsLoading || !selectedCollectionId}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 120 }}>
            <WeaverSelectField
              label="Method"
              value={cfg.method || "GET"}
              options={HTTP_METHOD_OPTIONS}
              onChange={(v) => handleFieldChange("method", v)}
              readOnly={readOnly}
              disabled={disabled}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Autocomplete
              freeSolo
              forcePopupIcon={false}
              options={suggestionTokens}
              open={urlSuggestionsOpen && suggestionTokens.length > 0}
              onClose={() => setUrlSuggestionsOpen(false)}
              value={cfg.url || ""}
              inputValue={cfg.url || ""}
              onInputChange={(_event, nextInputValue, reason) => {
                if (reason === "input" || reason === "clear") {
                  handleFieldChange("url", nextInputValue ?? "");
                }
              }}
              onChange={(_event, nextValue) => {
                if (nextValue) {
                  handleUrlSelectToken(String(nextValue));
                }
                setUrlSuggestionsOpen(false);
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
                  ref={urlInputRef}
                  label="URL"
                  value={cfg.url || ""}
                  onChange={(v) => handleFieldChange("url", v)}
                  required
                  readOnly={readOnly}
                  disabled={disabled}
                  placeholder="https://api.example.com/v1/resource"
                  onKeyDown={handleUrlKeyDown}
                />
              )}
            />
          </div>
        </div>

        <WeaverNumberField
          label="Timeout"
          value={cfg.timeout !== undefined ? Number(cfg.timeout) : DEFAULT_HTTP_TIMEOUT}
          onChange={(v) => handleFieldChange("timeout", v ?? DEFAULT_HTTP_TIMEOUT)}
          min={100}
          step={500}
          suffix="ms"
          readOnly={readOnly}
          disabled={disabled}
        />

        <WeaverSelectField
          label="Connection"
          value={cfg.connection || "--NONE--"}
          options={connectionOptions}
          onChange={(v) => handleFieldChange("connection", v || "--NONE--")}
          readOnly={readOnly}
          disabled={disabled}
        />
      </NodeConfigSection>

      <NodeConfigSection title="Headers" defaultExpanded={true}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="json"
            value={formatHeadersJson(cfg.headers)}
            onChange={(v) => handleJsonFieldChange("headers", v)}
            suggestions={editorSuggestions}
            readOnly={readOnly}
            height="100%"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              suggestOnTriggerCharacters: true,
              quickSuggestions: { other: true, comments: false, strings: true },
            }}
          />
        </div>
      </NodeConfigSection>

      <NodeConfigSection title="Request Body" defaultExpanded={true}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="json"
            value={formatJson(cfg.body || "{}")}
            onChange={(v) => handleJsonFieldChange("body", v)}
            suggestions={editorSuggestions}
            readOnly={readOnly}
            height="100%"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              suggestOnTriggerCharacters: true,
              quickSuggestions: { other: true, comments: false, strings: true },
            }}
          />
        </div>
      </NodeConfigSection>
    </div>
  );
};
