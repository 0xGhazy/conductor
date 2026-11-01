import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { WeaverCodeEditor, toWeaverSuggestions } from "@/components/common/editors";
import { WeaverSelectField, WeaverTextField } from "@/components/common/fields";
import {
  buildDecisionCases,
  createDefaultSwitchConfig,
  createDefaultSwitchCase,
  normalizeCases,
} from "@/features/designer/components/actions/switch/model/switchDto";
import type { SwitchActionConfig, SwitchCase, SwitchNodeData } from "@/features/designer/components/actions/switch/model/switchDto";

export interface SwitchConfigFormProps {
  data?: SwitchNodeData | null;
  onChange?: (patch: Partial<SwitchNodeData>) => void;
  validationErrors?: Record<string, string>;
  parameterOptions?: Array<string | { value?: string; label?: string; id?: string }>;
}

type InputChangeValue = string | number | { target: { value?: string | number } };

const hasInputTarget = (value: InputChangeValue): value is { target: { value?: string | number } } =>
  typeof value === "object" && value !== null && "target" in value;

export function SwitchConfigForm({
  data,
  onChange,
  validationErrors = {},
  parameterOptions = [],
}: SwitchConfigFormProps) {
  const cfg = data?.config ?? createDefaultSwitchConfig(data);
  const cases = normalizeCases(cfg);

  const taskReferenceName =
    cfg?.name ||
    cfg?.referenceName ||
    cfg?.taskReferenceName ||
    (data?.name && data.name !== "SWITCH" ? data.name : "Switch");

  const switchCaseValue =
    cfg?.inputParameters?.switchCaseValue ?? "switchCaseValue";
  const [inputParameterAutocompleteOpen, setInputParameterAutocompleteOpen] = useState(false);
  const completionOptions = useMemo(() => {
    if (!Array.isArray(parameterOptions)) return [];
    const seen = new Set<string>();
    return parameterOptions.reduce<string[]>((acc, option) => {
      const raw =
        typeof option === "string"
          ? option
          : typeof option?.value === "string"
            ? option.value
            : "";
      const normalized = String(raw ?? "").trim();
      if (!normalized || seen.has(normalized)) return acc;
      seen.add(normalized);
      acc.push(normalized);
      return acc;
    }, []);
  }, [parameterOptions]);

  const updateConfig = (patch: SwitchActionConfig) => {
    if (!onChange) return;
    const nextConfig = {
      ...cfg,
      ...patch,
    };
    const resolvedEvaluatorType =
      nextConfig.evaluatorType ?? cfg.evaluatorType ?? "value-param";
    const resolvedExpression =
      resolvedEvaluatorType === "value-param"
        ? "switchCaseValue"
        : nextConfig.expression ?? cfg.expression ?? "";
    const resolvedCases = Array.isArray(nextConfig.cases)
      ? nextConfig.cases
      : cases;

    const decisionCases = buildDecisionCases(resolvedCases);

    onChange({
      config: {
        ...nextConfig,
        evaluatorType: resolvedEvaluatorType,
        expression: resolvedExpression,
        type: "SWITCH",
        name: nextConfig.name ?? nextConfig.taskReferenceName ?? taskReferenceName,
        referenceName: nextConfig.referenceName ?? nextConfig.taskReferenceName ?? taskReferenceName,
        taskReferenceName: nextConfig.taskReferenceName ?? taskReferenceName,
        cases: resolvedCases,
        decisionCases,
        defaultCase: nextConfig.defaultCase ?? [],
        inputParameters: {
          ...(nextConfig.inputParameters ?? {}),
          switchCaseValue:
            nextConfig.inputParameters?.switchCaseValue ?? switchCaseValue,
        },
      },
    });
  };

  const updateConfigField = (key: keyof SwitchActionConfig) => (valueOrEvent: InputChangeValue) => {
    const value = hasInputTarget(valueOrEvent) ? valueOrEvent.target.value : valueOrEvent;
    updateConfig({ [key]: value });
  };

  const normalizeValue = (valueOrEvent: InputChangeValue) =>
    hasInputTarget(valueOrEvent) ? valueOrEvent.target.value : valueOrEvent;

  const handleCaseChange = (index: number, field: keyof SwitchCase, valueOrEvent: InputChangeValue) => {
    const value = normalizeValue(valueOrEvent);
    const nextCases = cases.map((caseData, caseIndex) =>
      caseIndex === index ? { ...caseData, [field]: value } : caseData
    );
    updateConfig({ cases: nextCases });
  };

  const handleNodeNameChange = (valueOrEvent: InputChangeValue) => {
    const value = hasInputTarget(valueOrEvent) ? valueOrEvent.target.value : valueOrEvent;

    if (typeof onChange !== "function") return;
    onChange({
      name: String(value ?? ""),
    });
  };

  const handleSwitchCaseValueChange = (valueOrEvent: InputChangeValue) => {
    const value = hasInputTarget(valueOrEvent) ? valueOrEvent.target.value : valueOrEvent;

    updateConfig({
      inputParameters: {
        ...(cfg.inputParameters ?? {}),
        switchCaseValue: value,
      },
    });
  };

  const handleInputParameterKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlSpace =
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      (event.code === "Space" || event.key === " ");
    if (!isCtrlSpace) return;
    event.preventDefault();
    event.stopPropagation();
    if (completionOptions.length === 0) return;
    setInputParameterAutocompleteOpen(true);
  };

  const handleAddCase = () => {
    updateConfig({ cases: [...cases, createDefaultSwitchCase(cases.length)] });
  };

  const handleRemoveCase = (index: number) => {
    if (cases.length <= 1) return;
    const nextCases = cases.filter((_, caseIndex) => caseIndex !== index);
    updateConfig({ cases: nextCases });
  };

  const hasCases = cases.length > 0;
  const canRemoveCase = cases.length > 1;

  return (
    <Box className="database-config-grid">
      <Box>
        <WeaverTextField
          className=""
          label="Node Name *"
          value={data?.name || ""}
          onChange={handleNodeNameChange}
          placeholder="Switch"
        />
      </Box>
      <Box>
        <WeaverTextField
          className=""
          label="Reference Name"
          value={cfg?.name || cfg?.referenceName || ""}
          onChange={(val) => {
            updateConfig({ name: val, referenceName: val, taskReferenceName: val });
          }}
          placeholder="switch_xxxxxxxx"
          errorMessage={validationErrors.referenceName || undefined}
        />
      </Box>

      <Box>
        <WeaverSelectField
          label="Evaluator Type"
          value={cfg.evaluatorType ?? "value-param"}
          onChange={(value) => updateConfigField("evaluatorType")(value as string)}
          options={[
            { label: "value-param", value: "value-param" },
            { label: "javascript", value: "javascript" },
          ]}
        />
      </Box>

      <Box>
        <Autocomplete
          freeSolo
          forcePopupIcon={false}
          options={completionOptions}
          open={inputParameterAutocompleteOpen && completionOptions.length > 0}
          value={String(switchCaseValue || "")}
          inputValue={String(switchCaseValue || "")}
          onClose={() => setInputParameterAutocompleteOpen(false)}
          onInputChange={(_event, nextInputValue, reason) => {
            if (reason === "input" || reason === "clear") {
              handleSwitchCaseValueChange(nextInputValue ?? "");
              if (completionOptions.length > 0) {
                setInputParameterAutocompleteOpen(true);
              }
            }
          }}
          onChange={(_event, nextValue) => {
            const resolvedValue =
              typeof nextValue === "string"
                ? nextValue
                : String(nextValue ?? "");
            handleSwitchCaseValueChange(resolvedValue);
            setInputParameterAutocompleteOpen(false);
          }}
          renderInput={(autocompleteParams) => (
            <WeaverTextField
              {...autocompleteParams}
              className=""
              label="Input Parameter"
              value={String(switchCaseValue || "")}
              onChange={handleSwitchCaseValueChange}
              placeholder=""
              onKeyDown={handleInputParameterKeyDown}
              inputProps={{
                ...autocompleteParams.inputProps,
                autoComplete: "off",
              }}
            />
          )}
        />
      </Box>

      {cfg.evaluatorType === "javascript" && (
        <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Expression (JavaScript)
          </Typography>
          <div className="border rounded-lg shadow-sm designer-node-card">
            <WeaverCodeEditor
              height="180px"
              language="javascript"
              value={cfg.expression || ""}
              suggestions={toWeaverSuggestions(completionOptions)}
              onChange={(value) =>
                updateConfigField("expression")(value ?? "")
              }
              options={{
                lineNumbers: "off",
                folding: true,
                formatOnType: true,
                formatOnPaste: true,
              }}
            />
          </div>
        </Box>
      )}

      <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Cases</Typography>
          <IconButton aria-label="add-case" size="small" onClick={handleAddCase}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Stack>
        {!hasCases ? (
          <Typography variant="caption" sx={{ color: "var(--color-fg-muted)" }}>
            No cases defined.
          </Typography>
        ) : (
          <Box className="database-params-grid">
            {cases.map((caseData, index) => (
              <Box key={caseData.id || `row-${index}`} className="database-params-row">
                <WeaverTextField
                  className=""
                  label="Key"
                  value={caseData.value || ""}
                  onChange={(value) => handleCaseChange(index, "value", value)}
                  placeholder={`case_${index + 1}`}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <WeaverTextField
                      className=""
                      label="Value"
                      value={caseData.label || ""}
                      onChange={(value) => handleCaseChange(index, "label", value)}
                      placeholder={`Label for ${caseData.value || `case_${index + 1}`}`}
                    />
                  </Box>
                  <IconButton
                    aria-label="delete-case"
                    size="small"
                    disabled={!canRemoveCase}
                    onClick={() => handleRemoveCase(index)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
