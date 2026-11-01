import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { WeaverSelectField, WeaverTextField } from "@/components/common/fields";
import { WeaverCodeEditor, toWeaverSuggestions } from "@/components/common/editors";
import {
  TERMINATION_STATUSES,
} from "@/features/designer/components/actions/terminate/model/terminateDto";
import type { TerminateActionConfig, TerminateNodeData } from "@/features/designer/components/actions/terminate/model/terminateDto";

export interface TerminateConfigFormProps {
  data?: TerminateNodeData | null;
  onChange?: (patch: Partial<TerminateNodeData>) => void;
  validationErrors?: Record<string, string>;
  parameterOptions?: Array<string | { value?: string; label?: string; id?: string }>;
}

type InputChangeValue = string | number | { target: { value?: string | number } };

const hasInputTarget = (value: InputChangeValue): value is { target: { value?: string | number } } =>
  typeof value === "object" && value !== null && "target" in value;

export function TerminateConfigForm({
  data,
  onChange,
  validationErrors = {},
  parameterOptions = [],
}: TerminateConfigFormProps) {
  const cfg = data?.config ?? {
    status: "COMPLETED",
    reason: "Workflow terminated",
    output: {},
  };

  const [outputText, setOutputText] = useState(() => {
    if (typeof cfg.output === "string") return cfg.output;
    return JSON.stringify(cfg.output ?? {}, null, 2);
  });

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

  const updateConfig = (patch: TerminateActionConfig) => {
    if (!onChange) return;
    onChange({
      config: {
        ...cfg,
        ...patch,
      },
    });
  };

  const updateConfigField = (key: keyof TerminateActionConfig) => (valueOrEvent: InputChangeValue) => {
    const value = hasInputTarget(valueOrEvent) ? valueOrEvent.target.value : valueOrEvent;
    updateConfig({ [key]: value });
  };

  const showReason = cfg.status === "FAILED" || cfg.status === "TERMINATED";

  return (
    <Box className="database-config-grid">
      <Box>
        <WeaverSelectField
          label="Status"
          value={cfg.status ?? "COMPLETED"}
          onChange={(value) => updateConfigField("status")(value as string)}
          options={TERMINATION_STATUSES.map((status) => ({ label: status, value: status }))}
        />
      </Box>
      <Box>
        <WeaverTextField
          className=""
          label="Reference Name"
          value={cfg?.name ?? ""}
          placeholder="terminate_action"
          onChange={updateConfigField("name")}
          disabled={false}
          errorMessage={validationErrors.referenceName || undefined}
        />
      </Box>

      {showReason ? (
        <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
          <WeaverTextField
            className=""
            label="Reason"
            value={cfg?.reason ?? ""}
            placeholder="Workflow termination"
            onChange={updateConfigField("reason")}
            disabled={false}
            helperText=""
          />
        </Box>
      ) : null}

      <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
        <Typography variant="subtitle2">Output (JSON)</Typography>
        <WeaverCodeEditor
          className="terminate-output-json-editor"
          language="json"
          value={outputText}
          suggestions={toWeaverSuggestions(completionOptions)}
          height="240px"
          onChange={(nextValue) => {
            const safeValue = nextValue ?? "";
            setOutputText(safeValue);
            try {
              const parsed = JSON.parse(safeValue);
              updateConfig({ output: parsed });
            } catch {
              updateConfig({ output: safeValue });
            }
          }}
          options={{ lineNumbers: "on" }}
        />
      </Box>
    </Box>
  );
}
