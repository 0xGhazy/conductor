import React, { useMemo } from "react";
import { Plus, Trash2, GitCommit, ShieldCheck } from "lucide-react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import ListSubheader from "@mui/material/ListSubheader";
import { Stack, IconButton, TextField, MenuItem, Select, FormControl, InputLabel, Tooltip } from "@mui/material";
import { WeaverTextField } from "@/components/common/fields";
import { WeaverButton } from "@/components/common/buttons";
import {
  OPERATOR_GROUPS,
  UNARY_OPERATORS,
} from "@/features/designer/components/actions/validation/model/validationDto";
import type {
  ValidationNodeData,
  ValidationRuleItem,
  ValidationRuleCondition,
} from "@/features/designer/components/actions/validation/model/validationDto";

export interface ValidationConfigFormProps {
  data: ValidationNodeData;
  onChange: (nextData: Partial<ValidationNodeData>) => void;
  validationErrors?: Record<string, string>;
  parameterOptions?: Array<string | { value?: string; label?: string; id?: string }>;
}

export function ValidationConfigForm({
  data,
  onChange,
  validationErrors = {},
  parameterOptions = [],
}: ValidationConfigFormProps) {
  const cfg = data?.config || {};
  const actionName = data?.name || "";
  const rulesList: ValidationRuleItem[] = Array.isArray(cfg.validationRules)
    ? cfg.validationRules
    : Array.isArray(cfg.rules)
    ? cfg.rules
    : [];

  const autocompleteOptions = useMemo(() => {
    if (!Array.isArray(parameterOptions)) return [];
    return parameterOptions
      .map((option) => {
        if (!option) return null;
        if (typeof option === "string") return option;
        if (typeof option === "object") return option.value || option.label || option.id || "";
        return null;
      })
      .filter(Boolean) as string[];
  }, [parameterOptions]);

  const updateConfig = (patch: Record<string, any>) => {
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
      config: { ...cfg },
    });
  };

  const handleAddRule = () => {
    const nextRules = [...rulesList];
    if (nextRules.length > 0) {
      nextRules.push("AND");
    }
    nextRules.push({ field: "", operator: "NOT_EMPTY", value: "", message: "" });
    updateConfig({ validationRules: nextRules, rules: nextRules });
  };

  const handleRemoveRule = (index: number) => {
    const nextRules = [...rulesList];
    nextRules.splice(index, 1);
    if (nextRules.length > 0 && typeof nextRules[0] === "string") {
      nextRules.shift();
    }
    if (nextRules.length > 0 && typeof nextRules[nextRules.length - 1] === "string") {
      nextRules.pop();
    }
    updateConfig({ validationRules: nextRules, rules: nextRules });
  };

  const handleUpdateRule = (index: number, patch: Partial<ValidationRuleCondition>) => {
    const nextRules = [...rulesList];
    const target = nextRules[index];
    if (typeof target === "object" && target !== null) {
      nextRules[index] = { ...target, ...patch };
      updateConfig({ validationRules: nextRules, rules: nextRules });
    }
  };

  const handleToggleJoiner = (index: number) => {
    const nextRules = [...rulesList];
    if (typeof nextRules[index] === "string") {
      nextRules[index] = nextRules[index] === "AND" ? "OR" : "AND";
      updateConfig({ validationRules: nextRules, rules: nextRules });
    }
  };

  let conditionCounter = 0;

  return (
    <Box className="validation-modal-body" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box className="database-config-grid">
        <Box>
          <WeaverTextField
            label="Node Name *"
            value={actionName}
            onChange={handleActionNameChange}
            disabled={false}
            helperText=""
            placeholder="Validation"
          />
        </Box>
        <Box>
          <WeaverTextField
            label="Reference Name *"
            value={cfg.name || cfg.referenceName || cfg.reference || ""}
            onChange={(value) =>
              updateConfig({ name: value, referenceName: value, reference: value })
            }
            disabled={false}
            errorMessage={validationErrors.referenceName || undefined}
            placeholder="validation_xxxxxxxx"
          />
        </Box>
      </Box>

      <Box sx={{ mt: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ShieldCheck size={18} color="#10b981" /> Validation Rules & Failure Messages
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Defines workflow input validation rules and custom failure messages.
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {rulesList.map((item, idx) => {
            if (typeof item === "string") {
              const isAnd = item === "AND";
              return (
                <div key={idx} className="validation-joiner-badge-wrapper">
                  <Tooltip title="Click to toggle logic joiner (AND / OR)" arrow placement="top">
                    <div
                      className={`validation-joiner-badge ${isAnd ? "joiner-and" : "joiner-or"}`}
                      onClick={() => handleToggleJoiner(idx)}
                    >
                      <GitCommit size={14} />
                      <span>{item}</span>
                    </div>
                  </Tooltip>
                </div>
              );
            }

            conditionCounter += 1;
            const currentRuleNum = conditionCounter;
            const colorIndex = (conditionCounter - 1) % 6;
            const isUnary = UNARY_OPERATORS.includes(item.operator);

            return (
              <div key={idx} className={`validation-condition-card card-color-${colorIndex}`}>
                <div className="validation-condition-header">
                  <span className="validation-index-chip">
                    Condition #{currentRuleNum}
                  </span>
                  <Tooltip title="Delete Condition" arrow>
                    <IconButton size="small" color="error" onClick={() => handleRemoveRule(idx)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                </div>

                <div className="validation-condition-grid">
                  <Autocomplete
                    freeSolo
                    options={autocompleteOptions}
                    value={item.field || ""}
                    onChange={(_, newValue) => handleUpdateRule(idx, { field: (newValue as string) || "" })}
                    onInputChange={(_, newInputValue) => handleUpdateRule(idx, { field: newInputValue })}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Field / Variable (${path} or value)"
                        size="small"
                        placeholder=""
                      />
                    )}
                  />

                  <FormControl size="small" fullWidth>
                    <InputLabel>Operator</InputLabel>
                    <Select
                      value={item.operator || "=="}
                      label="Operator"
                      onChange={(e) => handleUpdateRule(idx, { operator: e.target.value as string })}
                    >
                      {OPERATOR_GROUPS.map((group) => [
                        <ListSubheader key={group.category} className="operator-group-header">
                          {group.category}
                        </ListSubheader>,
                        ...group.operators.map((op) => (
                          <MenuItem key={op.value} value={op.value} sx={{ fontSize: "0.85rem" }}>
                            {op.label}
                          </MenuItem>
                        )),
                      ])}
                    </Select>
                  </FormControl>

                  {!isUnary ? (
                    <TextField
                      label="Expected Value"
                      size="small"
                      fullWidth
                      value={item.value !== undefined ? item.value : ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateRule(idx, { value: e.target.value })}
                      placeholder=""
                    />
                  ) : (
                    <Box sx={{ fontSize: "0.78rem", color: "text.secondary", fontStyle: "italic", px: 1 }}>
                      No expected value required for {item.operator}
                    </Box>
                  )}
                </div>

                <div className="validation-failure-message-wrap">
                  <TextField
                    label="Failure Message (Optional)"
                    size="small"
                    fullWidth
                    value={item.message || item.failureMessage || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleUpdateRule(idx, { message: e.target.value, failureMessage: e.target.value })
                    }
                    placeholder=""
                  />
                </div>
              </div>
            );
          })}
        </Stack>

        <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-start" }}>
          <WeaverButton
            variant="contained"
            color="primary"
            className="btn-add-validation-rule"
            onClick={handleAddRule}
          >
            + Add Validation Rule
          </WeaverButton>
        </Box>
      </Box>
    </Box>
  );
}
