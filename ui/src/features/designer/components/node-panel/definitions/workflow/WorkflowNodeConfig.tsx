import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import {
  WeaverSelectField,
  WeaverTextField,
} from "@/components/common/fields";
import { WeaverCodeEditor } from "@/components/common/editors";
import type { WeaverEditorSuggestion } from "@/components/common/editors/WeaverCodeEditor";
import {
  buildScopedSuggestions,
  buildSimpleContextMap,
  flattenContextMapSuggestions,
} from "@/features/designer/utils/contextMap";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useShallow } from "zustand/react/shallow";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import { NodeIdentityFields } from "../../common/NodeIdentityFields";
import { useWorkflowNodeOptions } from "./useWorkflowNodeOptions";
import type {
  WorkflowNodeConfigComponentProps,
  WorkflowExecutionMode,
} from "./WorkflowNodeConfig.types";

const MODE_OPTIONS: { value: WorkflowExecutionMode; label: string }[] = [
  { value: "ASYNC", label: "Asynchronized" },
  { value: "SYNC", label: "Synchronized" },
];

export const WorkflowNodeConfig: React.FC<WorkflowNodeConfigComponentProps> = ({
  node,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}) => {
  const cfg = value || {};

  // Form field state from config
  const selectedWorkflowName = cfg.workflowName ?? null;
  const selectedVersion =
    cfg.version !== undefined && cfg.version !== null && cfg.version !== ""
      ? Number(cfg.version)
      : null;
  const correlationId = cfg.correlationId ?? "";
  const selectedMode: WorkflowExecutionMode =
    cfg.mode === "SYNC" ? "SYNC" : "ASYNC";

  // Store integration for suggestions across workflow inputs, variables, and upstream nodes
  const {
    nodes,
    edges,
    workflowName,
    workflowVersion,
    workflowVariables,
  } = useDesignerStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      workflowName: state.workflowName,
      workflowVersion: state.workflowVersion,
      workflowVariables: state.workflowVariables,
    }))
  );

  // Data hook for workflow catalog, version resolution, and input templates
  const {
    workflowOptions,
    versionOptions,
    loadingWorkflows,
    loadingInputs,
    workflowError,
    versionError,
    inputsError,
    getGreatestVersion,
    resolveInputsForWorkflow,
  } = useWorkflowNodeOptions(selectedWorkflowName, selectedVersion);

  // Build suggestions for defined variables, workflow inputs, and upstream nodes output
  const suggestionTokens = useMemo(() => {
    const currentNodes = nodes || [];
    const currentEdges = edges || [];

    // Scoped suggestions strictly from workflow inputs, variables, and upstream ancestor nodes
    const scoped = buildScopedSuggestions({
      nodes: currentNodes,
      edges: currentEdges,
      selectedNodeId: node?.id || "",
      workflowName: workflowName || "",
      workflowVersion: Number(workflowVersion) || 1,
      workflowVariables: workflowVariables ?? {},
    });

    return scoped.suggestions || [];
  }, [nodes, edges, node?.id, workflowName, workflowVersion, workflowVariables]);

  // Monaco editor suggestions for Inputs JSON
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

  // Correlation Id Autocomplete & Ctrl+Space handling
  const [correlationSuggestionsOpen, setCorrelationSuggestionsOpen] = useState(false);
  const correlationInputRef = useRef<HTMLInputElement | null>(null);
  const cursorPositionRef = useRef<number | null>(null);

  const handleCorrelationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      (e.code === "Space" || e.key === " ");

    if (isCtrlSpace) {
      e.preventDefault();
      e.stopPropagation();
      cursorPositionRef.current = e.currentTarget.selectionStart ?? (correlationId || "").length;
      setCorrelationSuggestionsOpen((prev) => !prev);
    }
  };

  const handleCorrelationSelectToken = (token: string) => {
    const currentVal = correlationId || "";
    const cursor = cursorPositionRef.current ?? correlationInputRef.current?.selectionStart ?? currentVal.length;

    const before = currentVal.slice(0, cursor);
    const after = currentVal.slice(cursor);

    // If before ends with an unclosed '${...', replace the partial token
    const lastOpenBrace = before.lastIndexOf("${");
    if (lastOpenBrace !== -1 && !before.slice(lastOpenBrace).includes("}")) {
      const cleanBefore = before.slice(0, lastOpenBrace);
      const nextVal = `${cleanBefore}${token}${after}`;
      handleCorrelationIdChange(nextVal);
      return;
    }

    if (!currentVal.trim()) {
      handleCorrelationIdChange(token);
      return;
    }

    handleCorrelationIdChange(`${before}${token}${after}`);
  };

  // Local draft state for Inputs JSON code editor
  const [inputsText, setInputsText] = useState<string>(() => {
    if (cfg.inputsText !== undefined) {
      return String(cfg.inputsText);
    }
    if (cfg.inputs !== undefined) {
      return typeof cfg.inputs === "string"
        ? cfg.inputs
        : JSON.stringify(cfg.inputs ?? {}, null, 2);
    }
    return "{}";
  });

  const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Tracks the last target for which inputs were automatically populated.
  // This guarantees inputs are NOT wiped on normal rerenders or tab switches!
  const lastPopulatedTargetRef = useRef<{
    workflowName: string | null;
    version: number | null;
  }>({
    workflowName: selectedWorkflowName,
    version: selectedVersion,
  });

  // Keep editor text in sync if external config inputs change independently
  useEffect(() => {
    if (cfg.inputsText !== undefined && cfg.inputsText !== inputsText) {
      setInputsText(cfg.inputsText);
    }
  }, [cfg.inputsText]);

  // Handle workflow Name selection
  const handleNameChange = useCallback(
    async (newWorkflowName: string) => {
      if (readOnly || disabled) return;

      const trimmedName = String(newWorkflowName || "").trim();
      setHasAttemptedSubmit(true);

      if (!trimmedName) {
        lastPopulatedTargetRef.current = {
          workflowName: null,
          version: null,
        };
        setInputsText("{}");
        setJsonValidationError(null);
        onChange({
          workflowName: null,
          version: null,
          inputs: {},
          inputsText: "{}",
          subWorkflowParam: { name: "", version: null },
        });
        return;
      }

      // Automatically auto-select the greatest version number for the selected workflow
      const greatestVersion = getGreatestVersion(trimmedName);

      lastPopulatedTargetRef.current = {
        workflowName: trimmedName,
        version: greatestVersion,
      };

      // Automatically fetch / derive the input template for the newly selected workflow at greatestVersion
      const template = await resolveInputsForWorkflow(trimmedName, greatestVersion);
      const templateJson = JSON.stringify(template, null, 2);

      setInputsText(templateJson);
      setJsonValidationError(null);

      onChange({
        workflowName: trimmedName,
        version: greatestVersion,
        inputs: template,
        inputsText: templateJson,
        subWorkflowParam: {
          name: trimmedName,
          version: greatestVersion,
        },
      });
    },
    [readOnly, disabled, onChange, getGreatestVersion, resolveInputsForWorkflow]
  );

  // Handle Version selection
  const handleVersionChange = useCallback(
    async (val: string) => {
      if (readOnly || disabled || !selectedWorkflowName) return;

      const newVersion = val === "" ? null : Number(val);
      lastPopulatedTargetRef.current = {
        workflowName: selectedWorkflowName,
        version: newVersion,
      };

      // Resolve that version's expected input structure
      const template = await resolveInputsForWorkflow(selectedWorkflowName, newVersion);
      const templateJson = JSON.stringify(template, null, 2);

      setInputsText(templateJson);
      setJsonValidationError(null);

      onChange({
        version: newVersion,
        inputs: template,
        inputsText: templateJson,
        subWorkflowParam: {
          name: selectedWorkflowName,
          version: newVersion,
        },
      });
    },
    [readOnly, disabled, selectedWorkflowName, onChange, resolveInputsForWorkflow]
  );

  // If a workflow is selected but no version has been set yet, auto-select the greatest version number
  useEffect(() => {
    if (readOnly || disabled || !selectedWorkflowName) return;
    if (selectedVersion == null && versionOptions.length > 0) {
      const greatest = getGreatestVersion(selectedWorkflowName);
      if (greatest != null && greatest !== selectedVersion) {
        handleVersionChange(String(greatest));
      }
    }
  }, [
    selectedWorkflowName,
    selectedVersion,
    versionOptions,
    readOnly,
    disabled,
    getGreatestVersion,
    handleVersionChange,
  ]);

  // Handle Inputs code editor change with validation
  const handleInputsChange = useCallback(
    (newText: string) => {
      if (readOnly || disabled) return;

      setInputsText(newText);

      const trimmed = newText.trim();
      if (!trimmed) {
        setJsonValidationError(null);
        onChange({
          inputs: {},
          inputsText: newText,
        });
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          setJsonValidationError(null);
          onChange({
            inputs: parsed,
            inputsText: newText,
          });
        } else {
          setJsonValidationError("Inputs must be a valid JSON object.");
          onChange({
            inputsText: newText,
          });
        }
      } catch (err: any) {
        setJsonValidationError("Invalid JSON: " + (err?.message || "Syntax error"));
        onChange({
          inputsText: newText,
        });
      }
    },
    [readOnly, disabled, onChange]
  );

  // Handle Correlation Id change
  const handleCorrelationIdChange = useCallback(
    (val: string) => {
      if (readOnly || disabled) return;
      onChange({
        correlationId: val,
      });
    },
    [readOnly, disabled, onChange]
  );

  // Handle Mode change
  const handleModeChange = useCallback(
    (newMode: WorkflowExecutionMode) => {
      if (readOnly || disabled) return;
      onChange({
        mode: newMode,
      });
    },
    [readOnly, disabled, onChange]
  );

  // Determine Name error message
  const nameErrorMessage = useMemo(() => {
    if (workflowError) return workflowError;
    if (hasAttemptedSubmit && !selectedWorkflowName) {
      return "Workflow Name is required.";
    }
    return undefined;
  }, [workflowError, hasAttemptedSubmit, selectedWorkflowName]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <NodeConfigSection title="General">
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          referenceName={cfg.taskReferenceName || cfg.referenceName || cfg.name || ""}
          defaultNodeName="Workflow"
          readOnly={readOnly}
          disabled={disabled}
        />
      </NodeConfigSection>

      <NodeConfigSection title="Workflow Invocation">
        {/* 1. Name Field (WeaverSelectField, Required) */}
        <WeaverSelectField
          label="Name"
          required
          value={selectedWorkflowName || ""}
          options={workflowOptions}
          onChange={(val) => handleNameChange(val)}
          errorMessage={nameErrorMessage}
          disabled={disabled || loadingWorkflows}
          readOnly={readOnly}

        />

        {/* 2. Version Field (WeaverSelectField, Default: Latest) */}
        <WeaverSelectField
          label="Version"
          value={selectedVersion != null ? String(selectedVersion) : ""}
          options={versionOptions}
          onChange={(val) => handleVersionChange(val)}
          errorMessage={versionError || undefined}
          disabled={disabled || !selectedWorkflowName}
          readOnly={readOnly}
        />

        {/* 3. Inputs Field (WeaverCodeEditor, JSON) */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: 12,
              color: "var(--color-fg-muted, #475467)",
            }}
          >
            Inputs {loadingInputs ? "(resolving template...)" : ""}
          </Typography>

          {inputsError && (
            <Alert severity="warning" sx={{ mb: 1, py: 0, fontSize: 12 }}>
              {inputsError}
            </Alert>
          )}

          {jsonValidationError && (
            <Alert severity="error" sx={{ mb: 1, py: 0, fontSize: 12 }}>
              {jsonValidationError}
            </Alert>
          )}

          <Box
            sx={{
              border: `1px solid ${jsonValidationError
                ? "var(--color-accent-fg)"
                : "var(--color-border-subtle, #e4e7ec)"
                }`,
              borderRadius: "6px",
              overflow: "hidden",
              minHeight: 180,
            }}
          >
            <WeaverCodeEditor
              modelKey={`workflow-node-inputs-${node?.id || "draft"}`}
              language="json"
              value={inputsText}
              onChange={handleInputsChange}
              suggestions={editorSuggestions}
              readOnly={readOnly || disabled}
              height="250px"
              options={{
                minimap: { enabled: false },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                fontSize: 12,
                tabSize: 4,
                suggestOnTriggerCharacters: true,
                quickSuggestions: { other: true, comments: false, strings: true },
              }}
            />
          </Box>
        </Box>

        {/* 4. Correlation Id Field (WeaverTextField with Suggestions) */}
        <Autocomplete
          freeSolo
          forcePopupIcon={false}
          readOnly={readOnly}
          disabled={disabled}
          options={suggestionTokens}
          open={correlationSuggestionsOpen && suggestionTokens.length > 0 && !readOnly && !disabled}
          onClose={() => setCorrelationSuggestionsOpen(false)}
          value={correlationId || ""}
          inputValue={correlationId || ""}
          onInputChange={(_event, nextInputValue, reason) => {
            if (reason === "input" || reason === "clear") {
              handleCorrelationIdChange(nextInputValue ?? "");
            }
          }}
          onChange={(_event, nextValue) => {
            if (nextValue) {
              handleCorrelationSelectToken(String(nextValue));
            }
            setCorrelationSuggestionsOpen(false);
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
              ref={correlationInputRef}
              label="Correlation Id"
              placeholder="Optional (e.g. ${workflow.input.customerId})"
              onKeyDown={handleCorrelationKeyDown}
              disabled={disabled}
              readOnly={readOnly}
            />
          )}
        />

        {/* 5. Mode Field (WeaverSelectField, Asynchronized / Synchronized) */}
        <WeaverSelectField
          label="Mode"
          value={selectedMode}
          options={MODE_OPTIONS}
          onChange={(val) => handleModeChange(val as WorkflowExecutionMode)}
          readOnly={readOnly}
          disabled={disabled}
        />
      </NodeConfigSection>
    </Box>
  );
};
