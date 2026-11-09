import { Grid } from "@mui/material";
import { WeaverAutoComplete } from "components/ui/inputs";
import { WeaverCodeBlockInput } from "components/ui/inputs/WeaverCodeBlockInput";
import WeaverInput from "components/ui/inputs/WeaverInput";
import { SMALL_EDITOR_DEFAULT_OPTIONS } from "utils/constants";
import { IdempotencyValuesProp } from "../../definition/RunWorkflow/state";
import IdempotencyForm from "../../runWorkflow/IdempotencyForm";

interface WorkflowConfigSectionProps {
  workflowType: string | null;
  setWorkflowType: (workflowType: string) => void;
  workflowVersion: string | null;
  setWorkflowVersion: (workflowVersion: string | null) => void;
  workflowVersions: string[];
  workflowNames: string[];
  agentNames?: string[];
  workflowInputTemplate: string;
  setWorkflowInputTemplate: (value: string) => void;
  workflowCorrelationId: string;
  setWorkflowCorrelationId: (value: string) => void;
  idempotencyValues: {
    idempotencyKey?: string;
    idempotencyStrategy?: any;
  };
  handleIdempotencyValues: (data: IdempotencyValuesProp) => void;
  errors?: any;
}

export function WorkflowConfigSection({
  workflowType,
  setWorkflowType,
  workflowVersion,
  setWorkflowVersion,
  workflowVersions,
  workflowNames,
  agentNames = [],
  workflowInputTemplate,
  setWorkflowInputTemplate,
  workflowCorrelationId,
  setWorkflowCorrelationId,
  idempotencyValues,
  handleIdempotencyValues,
  errors,
}: WorkflowConfigSectionProps) {
  return (
    <>
      <Grid size={{ xs: 12, md: 9 }}>
        <WeaverAutoComplete
          fullWidth
          required
          label="Workflow or agent"
          options={workflowNames}
          groupBy={(option) =>
            agentNames.includes(option) ? "Agents" : "Workflows"
          }
          onChange={(__, val: any) => setWorkflowType(val)}
          value={workflowType}
          error={errors?.["startWorkflowRequest.name"]}
          helperText={errors ? errors["startWorkflowRequest.name"] : undefined}
          WeaverInputProps={{
            tooltip: {
              title: "Workflow or agent",
              content:
                "Scheduled agents run their deployed workflow definition. Provide their prompt in Input params.",
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <WeaverAutoComplete
          fullWidth
          disableClearable
          label="Workflow version"
          options={[...workflowVersions, "Latest version"]}
          onChange={(_, val: any) => setWorkflowVersion(val)}
          value={workflowVersion === "" ? "Latest version" : workflowVersion}
          WeaverInputProps={{
            tooltip: {
              title: "Workflow version",
              content: "Optional, by default the latest version is triggered",
            },
          }}
        />
      </Grid>
      <Grid size={12}>
        <WeaverCodeBlockInput
          label="Input params"
          minHeight={350}
          defaultLanguage="json"
          value={workflowInputTemplate}
          onChange={setWorkflowInputTemplate}
          options={SMALL_EDITOR_DEFAULT_OPTIONS}
        />
      </Grid>
      <Grid size={12}>
        <WeaverInput
          fullWidth
          label="Correlation id"
          value={workflowCorrelationId}
          onTextInputChange={setWorkflowCorrelationId}
        />
      </Grid>
      <Grid size={12}>
        <Grid container spacing={3} paddingBottom={2}>
          <IdempotencyForm
            idempotencyValues={idempotencyValues}
            onChange={handleIdempotencyValues}
          />
        </Grid>
      </Grid>
    </>
  );
}
