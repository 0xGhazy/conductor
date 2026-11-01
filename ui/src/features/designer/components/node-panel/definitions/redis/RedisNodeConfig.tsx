import React, { useState, useEffect, useMemo, useRef } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import {
  WeaverSelectField,
  WeaverTextField,
} from "@/components/common/fields";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import { NodeIdentityFields } from "../../common/NodeIdentityFields";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { fetchRedisDatasources } from "@/features/redis";
import type { RedisDatasource } from "@/features/redis";
import { buildScopedSuggestions } from "@/features/designer/utils/contextMap";

export interface RedisActionMeta {
  value: string;
  label: string;
  fields: Array<"key" | "field" | "value" | "ttlSeconds" | "delta">;
  description?: string;
}

export const REDIS_ACTIONS: RedisActionMeta[] = [
  { value: "GET", label: "GET - Retrieve Key Value", fields: ["key"], description: "Get the value of a key" },
  { value: "SET", label: "SET - Store Key Value", fields: ["key", "value", "ttlSeconds"], description: "Set the string value of a key with optional TTL" },
  { value: "DEL", label: "DEL - Delete Key", fields: ["key"], description: "Delete one or more keys" },
  { value: "EXISTS", label: "EXISTS - Check Key Existence", fields: ["key"], description: "Determine if a key exists" },
  { value: "EXPIRE", label: "EXPIRE - Set Key TTL (Seconds)", fields: ["key", "ttlSeconds"], description: "Set a key's time to live in seconds" },
  { value: "KEYS", label: "KEYS - List Keys Matching Pattern", fields: ["key"], description: "Find all keys matching the given pattern" },
  { value: "INCR", label: "INCR - Increment Key by 1", fields: ["key"], description: "Increment the integer value of a key by one" },
  { value: "INCRBY", label: "INCRBY - Increment Key by Step", fields: ["key", "delta"], description: "Increment the integer value of a key by the given amount" },
  { value: "DECR", label: "DECR - Decrement Key by 1", fields: ["key"], description: "Decrement the integer value of a key by one" },
  { value: "DECRBY", label: "DECRBY - Decrement Key by Step", fields: ["key", "delta"], description: "Decrement the integer value of a key by the given number" },
  { value: "HSET", label: "HSET - Set Hash Field Value", fields: ["key", "field", "value"], description: "Set the string value of a hash field" },
  { value: "HGET", label: "HGET - Get Hash Field Value", fields: ["key", "field"], description: "Get the value of a hash field" },
  { value: "HDEL", label: "HDEL - Delete Hash Field", fields: ["key", "field"], description: "Delete one or more hash fields" },
  { value: "HGETALL", label: "HGETALL - Get All Hash Fields & Values", fields: ["key"], description: "Get all fields and values in a hash" },
  { value: "HINCRBY", label: "HINCRBY - Increment Hash Field by Step", fields: ["key", "field", "delta"], description: "Increment the integer value of a hash field by given number" },
  { value: "PING", label: "PING - Test Redis Server Latency", fields: [], description: "Ping the server to check connectivity and latency" },
];

export const RedisNodeConfig: React.FC<WeaverNodeConfigProps> = ({
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

  // Redis datasources state
  const [datasources, setDatasources] = useState<
    Array<{ value: string; label: string; active?: boolean }>
  >([]);
  const [loadingDs, setLoadingDs] = useState(false);

  // Fetch available Redis instances on mount
  useEffect(() => {
    let active = true;
    setLoadingDs(true);
    fetchRedisDatasources()
      .then((res: any) => {
        if (!active) return;
        const body = res?.data ?? res ?? {};
        const list: RedisDatasource[] = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body)
          ? body
          : [];

        const opts = list.map((ds) => ({
          value: String(ds.id),
          label: `${ds.name || ds.id}${ds.host ? ` (${ds.host}:${ds.port})` : ""}${
            ds.active === false ? " [INACTIVE]" : ""
          }`,
          active: ds.active !== false,
        }));

        // Preserve current selection if not present in fetched list
        if (cfg.datasourceId && !opts.some((d) => d.value === String(cfg.datasourceId))) {
          opts.unshift({
            value: String(cfg.datasourceId),
            label: String(cfg.datasourceName || cfg.datasourceId),
            active: true,
          });
        }

        setDatasources(opts);
      })
      .catch((err) => {
        console.warn("Failed to fetch Redis datasources:", err);
      })
      .finally(() => {
        if (active) setLoadingDs(false);
      });

    return () => {
      active = false;
    };
  }, [cfg.datasourceId, cfg.datasourceName]);

  // Scoped suggestions from upstream nodes, inputs, and variables
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

  const currentAction = cfg.action || "GET";
  const actionMeta =
    REDIS_ACTIONS.find((a) => a.value === currentAction) || REDIS_ACTIONS[0];
  const activeFields = actionMeta.fields;

  const handleFieldChange = (field: string, val: any) => {
    onChange({ [field]: val });
  };

  const handleDatasourceChange = (val: string) => {
    const selected = datasources.find((d) => d.value === val);
    onChange({
      datasourceId: val,
      datasourceName: selected ? selected.label : val,
    });
  };

  const handleActionChange = (val: string) => {
    onChange({ action: val });
  };

  // Autocomplete token insertion helper
  const insertTokenIntoField = (
    fieldName: string,
    currentValue: string,
    token: string,
    cursorPos?: number | null
  ) => {
    const cursor = cursorPos ?? currentValue.length;
    const before = currentValue.slice(0, cursor);
    const after = currentValue.slice(cursor);

    const lastOpenBrace = before.lastIndexOf("${");
    if (lastOpenBrace !== -1 && !before.slice(lastOpenBrace).includes("}")) {
      const cleanBefore = before.slice(0, lastOpenBrace);
      handleFieldChange(fieldName, `${cleanBefore}${token}${after}`);
      return;
    }

    if (!currentValue.trim()) {
      handleFieldChange(fieldName, token);
      return;
    }

    handleFieldChange(fieldName, `${before}${token}${after}`);
  };

  // State & handlers for Key field autocomplete
  const [keySuggestionsOpen, setKeySuggestionsOpen] = useState(false);
  const keyInputRef = useRef<HTMLInputElement | null>(null);
  const keyCursorPosRef = useRef<number | null>(null);

  const handleKeyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      e.ctrlKey && !e.altKey && !e.metaKey && (e.code === "Space" || e.key === " ");
    if (isCtrlSpace) {
      e.preventDefault();
      e.stopPropagation();
      keyCursorPosRef.current =
        e.currentTarget.selectionStart ?? (cfg.key || "").length;
      setKeySuggestionsOpen((prev) => !prev);
    }
  };

  // State & handlers for Hash Field autocomplete
  const [fieldSuggestionsOpen, setFieldSuggestionsOpen] = useState(false);
  const fieldInputRef = useRef<HTMLInputElement | null>(null);
  const fieldCursorPosRef = useRef<number | null>(null);

  const handleFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      e.ctrlKey && !e.altKey && !e.metaKey && (e.code === "Space" || e.key === " ");
    if (isCtrlSpace) {
      e.preventDefault();
      e.stopPropagation();
      fieldCursorPosRef.current =
        e.currentTarget.selectionStart ?? (cfg.field || "").length;
      setFieldSuggestionsOpen((prev) => !prev);
    }
  };

  // State & handlers for TTL autocomplete
  const [ttlSuggestionsOpen, setTtlSuggestionsOpen] = useState(false);
  const ttlInputRef = useRef<HTMLInputElement | null>(null);
  const ttlCursorPosRef = useRef<number | null>(null);

  const handleTtlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      e.ctrlKey && !e.altKey && !e.metaKey && (e.code === "Space" || e.key === " ");
    if (isCtrlSpace) {
      e.preventDefault();
      e.stopPropagation();
      ttlCursorPosRef.current =
        e.currentTarget.selectionStart ?? String(cfg.ttlSeconds ?? "").length;
      setTtlSuggestionsOpen((prev) => !prev);
    }
  };

  // State & handlers for Delta autocomplete
  const [deltaSuggestionsOpen, setDeltaSuggestionsOpen] = useState(false);
  const deltaInputRef = useRef<HTMLInputElement | null>(null);
  const deltaCursorPosRef = useRef<number | null>(null);

  const handleDeltaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      e.ctrlKey && !e.altKey && !e.metaKey && (e.code === "Space" || e.key === " ");
    if (isCtrlSpace) {
      e.preventDefault();
      e.stopPropagation();
      deltaCursorPosRef.current =
        e.currentTarget.selectionStart ?? String(cfg.delta ?? "").length;
      setDeltaSuggestionsOpen((prev) => !prev);
    }
  };

  // Reusable option renderer with category badges
  const renderSuggestionOption = (
    props: React.HTMLAttributes<HTMLLIElement>,
    option: string
  ) => {
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
  };

  const filterSuggestionOptions = (
    options: string[],
    state: { inputValue: string }
  ) => {
    const input = state.inputValue || "";
    const lastBrace = input.lastIndexOf("${");
    if (lastBrace === -1) {
      return options;
    }
    const query = input.slice(lastBrace).toLowerCase().trim();
    const cleanQuery = query.replace(/[${}]/g, "");
    if (!cleanQuery) return options;
    return options.filter((opt) => opt.toLowerCase().includes(cleanQuery));
  };

  const actionOptions = useMemo(
    () =>
      REDIS_ACTIONS.map((a) => ({
        value: a.value,
        label: a.label,
      })),
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* General Section */}
      <NodeConfigSection title="General" defaultExpanded={true}>
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          defaultNodeName="Redis"
          readOnly={readOnly}
          disabled={disabled}
        />

        <WeaverSelectField
          label="Redis Instance"
          value={cfg.datasourceId || ""}
          options={datasources}
          onChange={handleDatasourceChange}
          readOnly={readOnly}
          disabled={disabled || loadingDs}
        />

        <WeaverSelectField
          label="Action"
          value={currentAction}
          options={actionOptions}
          onChange={handleActionChange}
          readOnly={readOnly}
          disabled={disabled}
          helperText={actionMeta.description}
        />
      </NodeConfigSection>

      {/* Dynamic Action Parameters Section */}
      <NodeConfigSection title="Parameters" defaultExpanded={true}>
        {activeFields.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1.5,
              borderRadius: "6px",
              backgroundColor: "rgba(13, 148, 136, 0.08)",
              border: "1px solid rgba(13, 148, 136, 0.2)",
              color: "var(--color-fg-default, #111827)",
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 18, color: "#0d9488" }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              PING action tests Redis server connectivity and latency. No additional
              parameters required.
            </Typography>
          </Box>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Key / Pattern Field */}
            {activeFields.includes("key") && (
              <Autocomplete
                freeSolo
                forcePopupIcon={false}
                options={suggestionTokens}
                open={keySuggestionsOpen && suggestionTokens.length > 0}
                onClose={() => setKeySuggestionsOpen(false)}
                value={cfg.key || ""}
                inputValue={cfg.key || ""}
                onInputChange={(_event, nextInputValue, reason) => {
                  if (reason === "input" || reason === "clear") {
                    const val = nextInputValue ?? "";
                    if (val.includes("${")) {
                      setKeySuggestionsOpen(true);
                    }
                    handleFieldChange("key", val);
                  }
                }}
                onChange={(_event, nextValue) => {
                  if (nextValue) {
                    insertTokenIntoField(
                      "key",
                      cfg.key || "",
                      String(nextValue),
                      keyCursorPosRef.current
                    );
                  }
                  setKeySuggestionsOpen(false);
                }}
                filterOptions={filterSuggestionOptions}
                renderOption={renderSuggestionOption}
                renderInput={(params) => (
                  <WeaverTextField
                    {...params}
                    ref={keyInputRef}
                    label={currentAction === "KEYS" ? "Pattern *" : "Key *"}
                    value={cfg.key || ""}
                    onChange={(v) => handleFieldChange("key", v)}
                    readOnly={readOnly}
                    disabled={disabled}
                    placeholder={
                      currentAction === "KEYS"
                        ? "e.g. user:* or *"
                        : "e.g. user:session:1001 or ${workflow.input.userId}"
                    }
                    onKeyDown={handleKeyKeyDown}
                  />
                )}
              />
            )}

            {/* Hash Field */}
            {activeFields.includes("field") && (
              <Autocomplete
                freeSolo
                forcePopupIcon={false}
                options={suggestionTokens}
                open={fieldSuggestionsOpen && suggestionTokens.length > 0}
                onClose={() => setFieldSuggestionsOpen(false)}
                value={cfg.field || ""}
                inputValue={cfg.field || ""}
                onInputChange={(_event, nextInputValue, reason) => {
                  if (reason === "input" || reason === "clear") {
                    const val = nextInputValue ?? "";
                    if (val.includes("${")) {
                      setFieldSuggestionsOpen(true);
                    }
                    handleFieldChange("field", val);
                  }
                }}
                onChange={(_event, nextValue) => {
                  if (nextValue) {
                    insertTokenIntoField(
                      "field",
                      cfg.field || "",
                      String(nextValue),
                      fieldCursorPosRef.current
                    );
                  }
                  setFieldSuggestionsOpen(false);
                }}
                filterOptions={filterSuggestionOptions}
                renderOption={renderSuggestionOption}
                renderInput={(params) => (
                  <WeaverTextField
                    {...params}
                    ref={fieldInputRef}
                    label="Hash Field *"
                    value={cfg.field || ""}
                    onChange={(v) => handleFieldChange("field", v)}
                    readOnly={readOnly}
                    disabled={disabled}
                    placeholder="e.g. email, status, or ${workflow.input.field}"
                    onKeyDown={handleFieldKeyDown}
                  />
                )}
              />
            )}

            {/* Value Field (Multiline) */}
            {activeFields.includes("value") && (
              <WeaverTextField
                label="Value"
                value={cfg.value || ""}
                onChange={(v) => handleFieldChange("value", v)}
                multiline
                rows={4}
                readOnly={readOnly}
                disabled={disabled}
                placeholder="Key value string, JSON object, or expression (e.g. ${workflow.input.userData})"
              />
            )}

            {/* TTL & Delta side-by-side or stacked depending on active fields */}
            {(activeFields.includes("ttlSeconds") || activeFields.includes("delta")) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    activeFields.includes("ttlSeconds") && activeFields.includes("delta")
                      ? "1fr 1fr"
                      : "1fr",
                  gap: 12,
                }}
              >
                {activeFields.includes("ttlSeconds") && (
                  <Autocomplete
                    freeSolo
                    forcePopupIcon={false}
                    options={suggestionTokens}
                    open={ttlSuggestionsOpen && suggestionTokens.length > 0}
                    onClose={() => setTtlSuggestionsOpen(false)}
                    value={cfg.ttlSeconds !== undefined ? String(cfg.ttlSeconds) : ""}
                    inputValue={cfg.ttlSeconds !== undefined ? String(cfg.ttlSeconds) : ""}
                    onInputChange={(_event, nextInputValue, reason) => {
                      if (reason === "input" || reason === "clear") {
                        const val = nextInputValue ?? "";
                        if (val.includes("${")) {
                          setTtlSuggestionsOpen(true);
                        }
                        const num = Number(val);
                        if (val !== "" && !isNaN(num) && Number.isFinite(num)) {
                          handleFieldChange("ttlSeconds", num);
                        } else {
                          handleFieldChange("ttlSeconds", val || undefined);
                        }
                      }
                    }}
                    onChange={(_event, nextValue) => {
                      if (nextValue) {
                        insertTokenIntoField(
                          "ttlSeconds",
                          String(cfg.ttlSeconds ?? ""),
                          String(nextValue),
                          ttlCursorPosRef.current
                        );
                      }
                      setTtlSuggestionsOpen(false);
                    }}
                    filterOptions={filterSuggestionOptions}
                    renderOption={renderSuggestionOption}
                    renderInput={(params) => (
                      <WeaverTextField
                        {...params}
                        ref={ttlInputRef}
                        label="TTL (Seconds)"
                        value={cfg.ttlSeconds !== undefined ? String(cfg.ttlSeconds) : ""}
                        onChange={(v) => {
                          const num = Number(v);
                          if (v !== "" && !isNaN(num) && Number.isFinite(num)) {
                            handleFieldChange("ttlSeconds", num);
                          } else {
                            handleFieldChange("ttlSeconds", v || undefined);
                          }
                        }}
                        readOnly={readOnly}
                        disabled={disabled}
                        placeholder="e.g. 3600 (Optional)"
                        onKeyDown={handleTtlKeyDown}
                      />
                    )}
                  />
                )}

                {activeFields.includes("delta") && (
                  <Autocomplete
                    freeSolo
                    forcePopupIcon={false}
                    options={suggestionTokens}
                    open={deltaSuggestionsOpen && suggestionTokens.length > 0}
                    onClose={() => setDeltaSuggestionsOpen(false)}
                    value={cfg.delta !== undefined ? String(cfg.delta) : ""}
                    inputValue={cfg.delta !== undefined ? String(cfg.delta) : ""}
                    onInputChange={(_event, nextInputValue, reason) => {
                      if (reason === "input" || reason === "clear") {
                        const val = nextInputValue ?? "";
                        if (val.includes("${")) {
                          setDeltaSuggestionsOpen(true);
                        }
                        const num = Number(val);
                        if (val !== "" && !isNaN(num) && Number.isFinite(num)) {
                          handleFieldChange("delta", num);
                        } else {
                          handleFieldChange("delta", val || undefined);
                        }
                      }
                    }}
                    onChange={(_event, nextValue) => {
                      if (nextValue) {
                        insertTokenIntoField(
                          "delta",
                          String(cfg.delta ?? ""),
                          String(nextValue),
                          deltaCursorPosRef.current
                        );
                      }
                      setDeltaSuggestionsOpen(false);
                    }}
                    filterOptions={filterSuggestionOptions}
                    renderOption={renderSuggestionOption}
                    renderInput={(params) => (
                      <WeaverTextField
                        {...params}
                        ref={deltaInputRef}
                        label="Increment / Decrement Delta"
                        value={cfg.delta !== undefined ? String(cfg.delta) : ""}
                        onChange={(v) => {
                          const num = Number(v);
                          if (v !== "" && !isNaN(num) && Number.isFinite(num)) {
                            handleFieldChange("delta", num);
                          } else {
                            handleFieldChange("delta", v || undefined);
                          }
                        }}
                        readOnly={readOnly}
                        disabled={disabled}
                        placeholder="Default: 1"
                        onKeyDown={handleDeltaKeyDown}
                      />
                    )}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </NodeConfigSection>
    </div>
  );
};
