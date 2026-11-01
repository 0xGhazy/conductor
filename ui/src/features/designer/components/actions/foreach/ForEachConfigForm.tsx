import React, { type ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { Repeat, Info, Layers, ShieldAlert, Sparkles, ArrowRight } from "lucide-react";
import { WeaverTextField, WeaverSelectField } from "@/components/common/fields";
import type {
  ForEachActionConfig,
  ForEachNodeData,
  ForEachExecutionMode,
  ForEachErrorStrategy,
} from "@/features/designer/components/actions/foreach/model/forEachDto";

export interface ForEachConfigFormProps {
  data?: ForEachNodeData | null;
  onChange?: (patch: Partial<ForEachNodeData>) => void;
  validationErrors?: Record<string, string>;
}

type InputChangeValue = string | number | { target: { value?: string | number } };

const hasInputTarget = (value: InputChangeValue): value is { target: { value?: string | number } } =>
  typeof value === "object" && value !== null && "target" in value;

export function ForEachConfigForm({
  data,
  onChange,
  validationErrors = {},
}: ForEachConfigFormProps) {
  const cfg = data?.config ?? {};
  const actionName = data?.name || "ForEach";

  const updateConfig = (patch: Partial<ForEachActionConfig>) => {
    if (!onChange) return;
    onChange({
      config: {
        ...cfg,
        ...patch,
      },
    });
  };

  const updateConfigField = (key: keyof ForEachActionConfig) => (valueOrEvent: InputChangeValue) => {
    const value = hasInputTarget(valueOrEvent) ? valueOrEvent.target.value : valueOrEvent;
    updateConfig({ [key]: value });
  };

  const handleActionNameChange = (value: string) => {
    if (!onChange) return;
    onChange({
      name: value,
    });
  };

  const handlePreserveOrderToggle = (e: ChangeEvent<HTMLInputElement>) => {
    updateConfig({ preserveOrder: e.target.checked });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Informative Architecture Banner */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid var(--color-border-default)",
          background: "var(--color-surface-soft, #EEF1F4)",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Repeat size={18} color="#8b5cf6" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#7c3aed" }}>
            Native Conductor Dynamic Orchestration
          </Typography>
          <Chip
            size="small"
            label="FORK_JOIN_DYNAMIC"
            sx={{
              height: 20,
              fontSize: "0.72rem",
              fontWeight: 600,
              bgcolor: "rgba(139, 92, 246, 0.15)",
              color: "#7c3aed",
            }}
          />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.84rem", lineHeight: 1.5 }}>
          Compiles automatically into <code>weaver_foreach_prepare</code> &rarr; <code>FORK_JOIN_DYNAMIC</code> &rarr; <code>JOIN</code> &rarr; <code>weaver_foreach_aggregate</code>.
          Every iteration runs as an independent Conductor task or sub-workflow with complete observability, retries, and history.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mt: 0.5, pt: 1, borderTop: "1px dashed rgba(139, 92, 246, 0.2)" }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: "#8b5cf6",
                boxShadow: "0 0 0 2px rgba(139, 92, 246, 0.3)",
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary" }}>
              Loop Body Port (Purple):
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Connect to tasks executed for each item
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: "#3b82f6",
                boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.3)",
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary" }}>
              On Complete Port (Blue):
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Connect to next step after all iterations finish
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {/* Main Grid Fields */}
      <Box className="database-config-grid">
        <Box>
          <WeaverTextField
            label="Display Name"
            value={actionName}
            placeholder="ForEach"
            onChange={handleActionNameChange}
            helperText="User-friendly name shown on the designer node"
          />
        </Box>

        <Box>
          <WeaverTextField
            label="Reference Name"
            value={cfg.name ?? cfg.referenceName ?? ""}
            placeholder="foreach_customers"
            onChange={updateConfigField("name")}
            errorMessage={validationErrors.referenceName || undefined}
            helperText="Unique Java-valid identifier used for output referencing"
          />
        </Box>

        {/* Collection Expression (Full Width) */}
        <Box sx={{ gridColumn: { xs: "1", md: "1 / span 2" } }}>
          <WeaverTextField
            label="Collection Expression *"
            value={String(cfg.collectionExpression ?? cfg.collection ?? "")}
            placeholder="${workflow.input.items} or ${http_action.output.result.users}"
            onChange={(val) => {
              updateConfig({ collection: String(val), collectionExpression: String(val) });
            }}
            errorMessage={validationErrors.collection || undefined}
            helperText="Expression resolving to an Array / List to iterate over (e.g. ${workflow.input.items})"
          />
        </Box>

        <Box>
          <WeaverTextField
            label="Item Variable Name *"
            value={String(cfg.itemVariable ?? "item")}
            placeholder="item"
            onChange={updateConfigField("itemVariable")}
            errorMessage={validationErrors.itemVariable || undefined}
            helperText="Name of the variable exposing each item (accessed via ${item} or ${item.field})"
          />
        </Box>

        <Box>
          <WeaverTextField
            label="Index Variable Name"
            value={String(cfg.indexVariable ?? "index")}
            placeholder="index"
            onChange={updateConfigField("indexVariable")}
            errorMessage={validationErrors.indexVariable || undefined}
            helperText="Optional 0-based iteration index variable name"
          />
        </Box>

        <Box>
          <WeaverSelectField
            label="Execution Mode"
            value={String(cfg.executionMode ?? "PARALLEL").toUpperCase()}
            onChange={(value) => updateConfigField("executionMode")(value as string)}
            helperText="How iterations are executed by Conductor"
            options={[{ label: "PARALLEL (Fork Join Dynamic)", value: "PARALLEL" }]}
          />
        </Box>

        <Box>
          <WeaverSelectField
            label="Error Strategy"
            value={String(cfg.errorStrategy ?? "FAIL_FAST").toUpperCase()}
            onChange={(value) => updateConfigField("errorStrategy")(value as string)}
            helperText="How failure in an iteration should be handled"
            options={[
              { label: "FAIL_FAST (Fail workflow immediately)", value: "FAIL_FAST" },
              { label: "COLLECT_ERRORS (Run all, collect errors)", value: "COLLECT_ERRORS" },
            ]}
          />
        </Box>

        <Box>
          <WeaverTextField
            label="Max Iterations Limit"
            type="number"
            value={cfg.maxIterations !== undefined ? String(cfg.maxIterations) : "1000"}
            placeholder="1000"
            onChange={updateConfigField("maxIterations")}
            errorMessage={validationErrors.maxIterations || undefined}
            helperText="Safety ceiling to protect against runaway dynamic loops"
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", pt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={cfg.preserveOrder !== false}
                onChange={handlePreserveOrderToggle}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Preserve Result Ordering
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  Ensure aggregated results match the original input array order
                </Typography>
              </Box>
            }
          />
        </Box>
      </Box>

      {/* Output Schema preview */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: "background.paper",
          border: "1px solid rgba(0, 0, 0, 0.08)",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Available Output Expressions in Subsequent Tasks
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.75 }}>
          {[
            `\${${cfg.name || "foreach"}.output.results}`,
            `\${${cfg.name || "foreach"}.output.total}`,
            `\${${cfg.name || "foreach"}.output.successful}`,
            `\${${cfg.name || "foreach"}.output.failed}`,
            `\${${cfg.name || "foreach"}.output.status}`,
          ].map((expr) => (
            <Chip
              key={expr}
              label={expr}
              size="small"
              variant="outlined"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                bgcolor: "action.hover",
              }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export default ForEachConfigForm;
