import { Box, Grid } from "@mui/material";
import { WeaverAutocompleteVariables } from "components/FlatMapForm/WeaverAutocompleteVariables";
import { path as _path } from "lodash/fp";
import { updateField } from "utils/fieldHelpers";
import { WeaverAdditionalHeadersBase } from "./HTTPTaskForm/WeaverAdditionalHeaders";
import { WeaverCacheOutput } from "./WeaverCacheOutputForm";
import { Optional } from "./OptionalFieldForm";
import TaskFormSection from "./TaskFormSection";
import { TaskFormProps } from "./types";

/** Config form for LIST_MCP_TOOLS — lists tools exposed by a Model Context Protocol server. */
export const ListMcpToolsTaskForm = ({ task, onChange }: TaskFormProps) => {
  const get = (p: string) => _path(p, task);
  const set = (p: string, value: any) => onChange(updateField(p, value, task));

  const headers: Record<string, string> =
    (get("inputParameters.headers") as Record<string, string>) || {};

  return (
    <Box padding={1} width="100%">
      <TaskFormSection
        accordionAdditionalProps={{ defaultExpanded: true }}
        title="MCP Server"
      >
        <Grid container spacing={2} sx={{ width: "100%" }}>
          <Grid size={12}>
            <WeaverAutocompleteVariables
              label="MCP server URL"
              value={get("inputParameters.mcpServer")}
              onChange={(v) => set("inputParameters.mcpServer", v)}
            />
          </Grid>
        </Grid>
      </TaskFormSection>

      <TaskFormSection title="Headers">
        <Grid container spacing={2} sx={{ width: "100%" }}>
          <Grid size={12}>
            <WeaverAdditionalHeadersBase
              headers={headers}
              onChangeHeaders={(h) => set("inputParameters.headers", h)}
            />
          </Grid>
        </Grid>
      </TaskFormSection>

      <TaskFormSection>
        <Box display="flex" flexDirection="column" gap={3}>
          <WeaverCacheOutput onChange={onChange} taskJson={task} />
          <Optional onChange={onChange} taskJson={task} />
        </Box>
      </TaskFormSection>
    </Box>
  );
};
