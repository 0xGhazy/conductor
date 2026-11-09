import { Box, Grid } from "@mui/material";

import { WeaverCodeBlockInput } from "components/ui/inputs/WeaverCodeBlockInput";
import { WeaverAutocompleteVariables } from "components/FlatMapForm/WeaverAutocompleteVariables";
import { configurePromQl } from "utils/monacoUtils/CodeEditorUtils";
import { useTaskForm } from "../hooks/useTaskForm";
import { TaskFormProps } from "../types";

export const MetricsTypeForm = ({ task, onChange }: TaskFormProps) => {
  const [query, setQuery] = useTaskForm("inputParameters.metricsQuery", {
    task,
    onChange,
  });
  const [metricsStart, setMetricsStart] = useTaskForm(
    "inputParameters.metricsStart",
    {
      task,
      onChange,
    },
  );
  const [metricsEnd, setMetricsEnd] = useTaskForm(
    "inputParameters.metricsEnd",
    {
      task,
      onChange,
    },
  );
  const [metricsStep, setMetricsStep] = useTaskForm(
    "inputParameters.metricsStep",
    {
      task,
      onChange,
    },
  );
  return (
    <Grid container sx={{ width: "100%" }} spacing={3} mt={1}>
      <Grid size={12}>
        <WeaverCodeBlockInput
          language="promql"
          minHeight={100}
          autoformat={false}
          value={query}
          onChange={setQuery}
          beforeMount={configurePromQl}
        />
      </Grid>
      <Grid size={12}>
        <Grid container sx={{ width: "100%" }} alignItems={"center"} gap={2}>
          <Box>{"Start time from (Now - "} </Box>
          <Grid size={2}>
            <WeaverAutocompleteVariables
              label="Value"
              value={metricsStart}
              fullWidth
              onChange={setMetricsStart}
              growPopper
            />
          </Grid>
          <Box>{`mins) to (Now -`} </Box>
          <Grid size={2}>
            <WeaverAutocompleteVariables
              label="Value"
              value={metricsEnd}
              fullWidth
              onChange={setMetricsEnd}
              growPopper
            />
          </Grid>
          <Box>{"mins)"} </Box>
        </Grid>
      </Grid>
      <Grid size={12}>
        <WeaverAutocompleteVariables
          fullWidth
          label="Step"
          value={metricsStep}
          onChange={setMetricsStep}
        />
      </Grid>
    </Grid>
  );
};
