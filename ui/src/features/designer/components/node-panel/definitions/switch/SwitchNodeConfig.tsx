import React from "react";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import {
  WeaverTextField,
  WeaverSelectField,
} from "@/components/common/fields";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import { NodeIdentityFields } from "../../common/NodeIdentityFields";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { createUuid } from "@/utils/uuid";

const EVALUATOR_TYPES = [
  { value: "value-param", label: "Value-Param" },
  { value: "javascript", label: "JavaScript" },
];

export const SwitchNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}) => {
  const cfg = value || {};
  const cases: Array<{ id?: string; value: string; label: string }> = Array.isArray(cfg.cases)
    ? cfg.cases
    : [];

  const handleFieldChange = (field: string, val: any) => {
    onChange({ [field]: val });
  };

  const handleCaseChange = (index: number, patch: { value?: string; label?: string }) => {
    const nextCases = [...cases];
    nextCases[index] = { ...nextCases[index], ...patch };
    onChange({ cases: nextCases });
  };

  const handleAddCase = () => {
    const nextNum = cases.length + 1;
    const newCase = {
      id: `case-${createUuid()}`,
      value: `case${nextNum}`,
      label: `Case ${nextNum}`,
    };
    onChange({ cases: [...cases, newCase] });
  };

  const handleRemoveCase = (index: number) => {
    const nextCases = cases.filter((_, i) => i !== index);
    onChange({ cases: nextCases });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General" defaultExpanded={true}>
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          defaultNodeName="Switch"
          readOnly={readOnly}
          disabled={disabled}
        />

        <WeaverSelectField
          label="Evaluator Type"
          value={cfg.evaluatorType || "value-param"}
          options={EVALUATOR_TYPES}
          onChange={(v) => handleFieldChange("evaluatorType", v)}
          readOnly={readOnly}
          disabled={disabled}
        />

        <WeaverTextField
          label="Expression / Evaluation Path"
          value={cfg.expression || ""}
          onChange={(v) => handleFieldChange("expression", v)}
          readOnly={readOnly}
          disabled={disabled}
          placeholder="e.g. switchCaseValue or workflow.input.status"
          helperText="Expression evaluated to select matching branch"
        />
      </NodeConfigSection>

      <NodeConfigSection
        title="Cases"
        defaultExpanded={true}
        badge={`${cases.length} cases`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cases.map((c, index) => (
            <div
              key={c.id || index}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "8px",
                borderRadius: "6px",
                backgroundColor: "var(--color-surface-soft, rgba(0, 0, 0, 0.03))",
                border: "1px solid var(--color-border-default, #dde3ea)",
              }}
            >
              <div style={{ flex: 1 }}>
                <WeaverTextField
                  label={`Case ${index + 1} Value`}
                  value={c.value}
                  onChange={(v) => handleCaseChange(index, { value: v })}
                  readOnly={readOnly}
                  disabled={disabled}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <WeaverTextField
                  label="Label"
                  value={c.label}
                  onChange={(v) => handleCaseChange(index, { label: v })}
                  readOnly={readOnly}
                  disabled={disabled}
                />
              </div>

              {!readOnly && !disabled && (
                <IconButton
                  size="small"
                  onClick={() => handleRemoveCase(index)}
                  title="Remove Case"
                  aria-label={`Remove Case ${index + 1}`}
                  sx={{
                    color: "var(--color-status-danger, #c93136)",
                    alignSelf: "flex-end",
                    mb: 0.5,
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </div>
          ))}

          {!readOnly && !disabled && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddCase}
              sx={{
                borderColor: "var(--color-border-strong, #c6d0da)",
                color: "var(--color-fg-default, #111827)",
                textTransform: "none",
                fontWeight: 600,
                alignSelf: "flex-start",
                mt: 0.5,
              }}
            >
              Add Case
            </Button>
          )}
        </div>
      </NodeConfigSection>
    </div>
  );
};
