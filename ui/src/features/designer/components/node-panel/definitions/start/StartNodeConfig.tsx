import React, { useMemo, useState, useCallback, useRef } from "react";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import {
  WeaverTextField,
  WeaverNameField,
  WeaverNumberField,
  WeaverSelectField,
} from "@/components/common/fields";
import type { NameValidationResult } from "@/components/common/fields";
import { WeaverCodeEditor } from "@/components/common/editors";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import {
  START_TIMEOUT_POLICIES,
  parseStartInputsJson,
  parseStartVariablesJson,
  buildStartInputDefinitions,
} from "@/features/designer/utils/designerGraphUtils";
import { checkWorkflowExists } from "@/features/designer/services/designerApi";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";

const TIMEOUT_POLICY_OPTIONS = Object.entries(START_TIMEOUT_POLICIES).map(
  ([value, label]) => ({
    value,
    label,
  })
);

const LANGUAGE_OPTIONS = [
  { value: "", label: "None / Default" },
  { value: "JSON", label: "JSON" },
  { value: "JAVASCRIPT", label: "JavaScript" },
  { value: "PYTHON", label: "Python" },
];

export const StartNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}) => {
  const cfg = value || {};

  const storeWorkflowName = useDesignerStore((state) => state.workflowName);
  const setWorkflowName = useDesignerStore((state) => state.setWorkflowName);
  const workflowStatus = useDesignerStore((state) => state.workflowStatus);

  const initialWorkflowNameRef = useRef<string>(
    storeWorkflowName || cfg.name || node?.data?.name || ""
  );

  const handleFieldChange = (field: string, val: any) => {
    onChange({ [field]: val });
  };

  const handleWorkflowNameChange = (val: string) => {
    handleFieldChange("name", val);
    setWorkflowName(val);
  };

  const validateWorkflowName = useCallback(
    async (nameToValidate: string): Promise<NameValidationResult> => {
      const trimmed = String(nameToValidate || "").trim();
      if (!trimmed) {
        return { valid: false, message: "Workflow name is required." };
      }

      if (/\s/.test(trimmed)) {
        return { valid: false, message: "Workflow name must not contain spaces." };
      }

      // If the workflow was loaded from backend, retaining the initial workflow name is valid
      if (
        workflowStatus !== "DRAFT" &&
        initialWorkflowNameRef.current &&
        trimmed.toLowerCase() === initialWorkflowNameRef.current.toLowerCase()
      ) {
        return { valid: true };
      }

      try {
        const exists = await checkWorkflowExists(trimmed);
        if (exists) {
          return {
            valid: false,
            message: `Workflow "${trimmed}" already exists.`,
          };
        }
        return { valid: true };
      } catch {
        return {
          valid: false,
          message: "Failed to verify workflow name availability.",
        };
      }
    },
    [workflowStatus]
  );

  const [variablesError, setVariablesError] = useState<string>("");

  const variablesString = useMemo(() => {
    try {
      if (typeof cfg.variablesText === "string") return cfg.variablesText;
      if (typeof cfg.variables === "string") return cfg.variables;
      return JSON.stringify(cfg.variables || {}, null, 2);
    } catch {
      return "{}";
    }
  }, [cfg.variables, cfg.variablesText]);

  const handleVariablesChange = (text: string) => {
    const parsed = parseStartVariablesJson(text);
    if (parsed.error) {
      setVariablesError(parsed.error);
      onChange({ variablesText: text });
    } else {
      setVariablesError("");
      onChange({
        variables: parsed.value || {},
        variablesText: undefined,
      });
    }
  };

  const [inputsError, setInputsError] = useState<string>("");

  const inputsString = useMemo(() => {
    try {
      if (typeof cfg.inputsText === "string") return cfg.inputsText;
      const rawInputs = cfg.inputParameters ?? cfg.inputs;
      if (typeof rawInputs === "string") return rawInputs;
      return JSON.stringify(rawInputs || {}, null, 2);
    } catch {
      return "{}";
    }
  }, [cfg.inputParameters, cfg.inputs, cfg.inputsText]);

  const handleInputsChange = (text: string) => {
    const parsed = parseStartInputsJson(text);
    if (parsed.error) {
      setInputsError(parsed.error);
      onChange({ inputsText: text });
    } else {
      setInputsError("");
      const resolved = parsed.value || {};
      onChange({
        inputParameters: resolved,
        inputs: resolved,
        inputDefinitions: buildStartInputDefinitions(resolved),
        inputsText: undefined,
      });
    }
  };

  const workflowNameValue =
    cfg.name !== undefined
      ? cfg.name
      : node?.data?.name !== undefined
        ? node.data.name
        : storeWorkflowName || "Start";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General" defaultExpanded={true}>
        <WeaverNameField
          label="Workflow Name"
          value={workflowNameValue}
          onChange={handleWorkflowNameChange}
          validateName={validateWorkflowName}
          namePattern={/^[^\s]+$/}
          invalidNameMessage="Workflow name must not contain spaces."
          debounceMs={400}
          showValidationStatus
          readOnly={readOnly}
          required
          disabled={disabled}
        />

        <WeaverTextField
          label="Description"
          value={cfg.description || ""}
          onChange={(v) => handleFieldChange("description", v)}
          multiline
          rows={4}
          readOnly={readOnly}
          disabled={disabled}
          placeholder="Workflow purpose and overview"
        />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <WeaverNumberField
              label="Version"
              value={cfg.version ? Number(cfg.version) : 1}
              onChange={(v) => handleFieldChange("version", v ?? 1)}
              min={1}
              readOnly={true}
              disabled={disabled}
            />
          </div>
          <div style={{ flex: 1 }}>
            <WeaverSelectField
              label="Language"
              value={cfg.language || ""}
              options={LANGUAGE_OPTIONS}
              onChange={(v) => handleFieldChange("language", v)}
              readOnly={readOnly}
              disabled={disabled}
            />
          </div>
        </div>
      </NodeConfigSection>

      <NodeConfigSection title="Execution & Timeout" defaultExpanded={true}>
        <WeaverNumberField
          label="Timeout"
          value={cfg.timeoutSeconds !== undefined ? Number(cfg.timeoutSeconds) : 10}
          onChange={(v) => handleFieldChange("timeoutSeconds", v ?? 10)}
          min={1}
          suffix="sec"
          readOnly={readOnly}
          disabled={disabled}
          helperText="Maximum allowed execution time"
        />

        <WeaverSelectField
          label="Timeout Policy"
          value={cfg.timeoutPolicy || "TIME_OUT_WF"}
          options={TIMEOUT_POLICY_OPTIONS}
          onChange={(v) => handleFieldChange("timeoutPolicy", v)}
          readOnly={readOnly}
          disabled={disabled}
        />
      </NodeConfigSection>

      <NodeConfigSection title="Inputs" defaultExpanded={true}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="json"
            value={inputsString}
            onChange={handleInputsChange}
            readOnly={readOnly}
            height="100%"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
            }}
          />
        </div>
        {inputsError && (
          <div
            style={{
              color: "var(--color-fg-error, #f04438)",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {inputsError}
          </div>
        )}
      </NodeConfigSection>

      <NodeConfigSection title="Variables" defaultExpanded={true}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="json"
            value={variablesString}
            onChange={handleVariablesChange}
            readOnly={readOnly}
            height="100%"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
            }}
          />
        </div>
        {variablesError && (
          <div
            style={{
              color: "var(--color-fg-error, #f04438)",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {variablesError}
          </div>
        )}
      </NodeConfigSection>
    </div>
  );
};
