import { Box, Grid } from "@mui/material";
import { WeaverAutocompleteVariables } from "components/FlatMapForm/WeaverAutocompleteVariables";
import WeaverInput from "components/ui/inputs/WeaverInput";
import { path as _path } from "lodash/fp";
import { UiIntegrationsFieldType } from "types/FormFieldTypes";
import {
  fieldsToFieldsFieldsComponents,
  updateField,
} from "utils/fieldHelpers";
import { WeaverCacheOutput } from "./WeaverCacheOutputForm";
import { LLMFormFields } from "./LLMFormFields/LLMFormFields";
import LLMFormFieldsWrapper from "./LLMFormFields/LLMFormFieldsWrapper";
import { Optional } from "./OptionalFieldForm";
import TaskFormSection from "./TaskFormSection";
import { TaskFormProps } from "./types";

const modelFields = [
  UiIntegrationsFieldType.LLM_PROVIDER,
  UiIntegrationsFieldType.MODEL,
];
const modelFieldComponents = fieldsToFieldsFieldsComponents(modelFields);

/** Config form for GENERATE_AUDIO — synthesizes speech/audio from text using an LLM provider. */
export const GenerateAudioTaskForm = ({ task, onChange }: TaskFormProps) => {
  const get = (p: string) => _path(p, task);
  const set = (p: string, value: any) => onChange(updateField(p, value, task));

  return (
    <LLMFormFieldsWrapper
      task={task}
      onChange={onChange}
      allFieldComponents={modelFieldComponents}
    >
      {(actor) => (
        <Box padding={1} width="100%">
          <TaskFormSection
            accordionAdditionalProps={{ defaultExpanded: true }}
            title="Provider and Model"
          >
            <LLMFormFields
              task={task}
              onChange={onChange}
              fieldFieldComponents={modelFieldComponents}
              actor={actor}
            />
          </TaskFormSection>

          <TaskFormSection
            accordionAdditionalProps={{ defaultExpanded: true }}
            title="Input"
          >
            <Grid container spacing={2} sx={{ width: "100%" }}>
              <Grid size={12}>
                <WeaverInput
                  label="Text"
                  name="text"
                  value={(get("inputParameters.text") as string) || ""}
                  onTextInputChange={(v) => set("inputParameters.text", v)}
                  multiline
                  rows={5}
                  fullWidth
                  placeholder="Text to convert to speech"
                />
              </Grid>
            </Grid>
          </TaskFormSection>

          <TaskFormSection title="Audio options">
            <Grid container spacing={2} sx={{ width: "100%" }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <WeaverAutocompleteVariables
                  label="Voice"
                  value={get("inputParameters.voice") as string}
                  onChange={(v) => set("inputParameters.voice", v)}
                  placeholder="alloy"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <WeaverAutocompleteVariables
                  label="Speed"
                  value={get("inputParameters.speed") as number}
                  coerceTo="double"
                  onChange={(v) => set("inputParameters.speed", v)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <WeaverAutocompleteVariables
                  label="Response format"
                  value={get("inputParameters.responseFormat") as string}
                  onChange={(v) => set("inputParameters.responseFormat", v)}
                  placeholder="mp3 / opus / aac / flac"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <WeaverAutocompleteVariables
                  label="Number of outputs (n)"
                  value={get("inputParameters.n") as number}
                  coerceTo="integer"
                  onChange={(v) => set("inputParameters.n", v)}
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
      )}
    </LLMFormFieldsWrapper>
  );
};
