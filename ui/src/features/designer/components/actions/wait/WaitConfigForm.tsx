import Box from "@mui/material/Box";
import { WeaverTextField, WeaverSelectField } from "@/components/common/fields";
import {
  formatUntil,
  normalizeUntilParts,
  normalizeWaitMode,
  TIMEZONE_OPTIONS,
} from "@/features/designer/components/actions/wait/model/waitDto";
import type { WaitActionConfig, WaitNodeData } from "@/features/designer/components/actions/wait/model/waitDto";

export interface WaitConfigFormProps {
  data?: WaitNodeData | null;
  onChange?: (patch: Partial<WaitNodeData>) => void;
  validationErrors?: Record<string, string>;
}

type InputChangeValue = string | number | { target: { value?: string | number } };

const hasInputTarget = (value: InputChangeValue): value is { target: { value?: string | number } } =>
  typeof value === "object" && value !== null && "target" in value;

export function WaitConfigForm({
  data,
  onChange,
  validationErrors = {},
}: WaitConfigFormProps) {
  const cfg = data?.config ?? {};
  const mode = normalizeWaitMode(cfg.mode);
  const untilParts = normalizeUntilParts(cfg);

  const updateConfig = (patch: WaitActionConfig) => {
    if (!onChange) return;
    onChange({
      config: {
        ...cfg,
        ...patch,
      },
    });
  };

  const updateConfigField = (key: keyof WaitActionConfig) => (valueOrEvent: InputChangeValue) => {
    const value = hasInputTarget(valueOrEvent) ? valueOrEvent.target.value : valueOrEvent;
    updateConfig({ [key]: value });
  };

  return (
    <Box className="database-config-grid">
      <Box>
        <WeaverTextField
          className=""
          label="Reference Name"
          value={cfg.name ?? ""}
          placeholder="wait_action"
          onChange={updateConfigField("name")}
          errorMessage={validationErrors.referenceName || undefined}
        />
      </Box>
      <Box>
        <WeaverSelectField
          label="Wait Mode"
          value={mode}
          onChange={(value) => updateConfigField("mode")(value as string)}
          options={[
            { label: "Duration", value: "DURATION" },
            { label: "Until time", value: "UNTIL" },
          ]}
        />
      </Box>

      {mode === "DURATION" ? (
        <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
          <WeaverTextField
            className=""
            label="Duration"
            value={String(cfg.duration ?? "1 minute")}
            placeholder="1 day 2 hours 30 minutes 15 seconds"
            onChange={updateConfigField("duration")}
            errorMessage={validationErrors.duration || undefined}
            helperText="Use days/d, hours/hrs/h, minutes/mins/m, seconds/secs/s."
          />
        </Box>
      ) : (
        <>
          <Box>
            <WeaverTextField
              className=""
              label="Date Time"
              type="datetime-local"
              value={untilParts.untilDateTime}
              placeholder="2026-04-30T15:20"
              onChange={updateConfigField("untilDateTime")}
              errorMessage={validationErrors.until || undefined}
              helperText="Format: yyyy-MM-dd HH:mm"
            />
          </Box>
          <Box>
            <WeaverSelectField
              label="Time Zone"
              value={untilParts.untilTimezone}
              onChange={(value) => updateConfigField("untilTimezone")(value as string)}
              errorMessage={validationErrors.until || undefined}
              options={TIMEZONE_OPTIONS.map((timezone) => ({ label: timezone, value: timezone }))}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
            <WeaverTextField
              className=""
              label="Until"
              value={formatUntil(cfg)}
              placeholder="2026-04-30 15:20 GMT+04:00"
              onChange={() => undefined}
              disabled
              helperText="Exported format: yyyy-MM-dd HH:mm z"
            />
          </Box>
        </>
      )}
    </Box>
  );
}
