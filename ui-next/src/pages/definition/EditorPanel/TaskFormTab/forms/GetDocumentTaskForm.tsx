import { Box } from "@mui/material";
import { LLMFormFields } from "pages/definition/EditorPanel/TaskFormTab/forms/LLMFormFields";
import { UiIntegrationsFieldType } from "types";
import { fieldsToFieldsFieldsComponents } from "utils/fieldHelpers";
import { WeaverCacheOutput } from "./WeaverCacheOutputForm";
import TaskFormSection from "./TaskFormSection";
import { TaskFormProps } from "./types";
import LLMFormFieldsWrapper from "./LLMFormFields/LLMFormFieldsWrapper";

const fields = [
  UiIntegrationsFieldType.URL,
  UiIntegrationsFieldType.MEDIA_TYPE,
];
const fieldFieldComponents = fieldsToFieldsFieldsComponents(fields);

export const GetDocumentTaskForm = ({ task, onChange }: TaskFormProps) => {
  return (
    <LLMFormFieldsWrapper
      task={task}
      onChange={onChange}
      allFieldComponents={fieldFieldComponents}
    >
      {(actor) => (
        <Box padding={1} width="100%">
          <TaskFormSection
            accordionAdditionalProps={{ defaultExpanded: true }}
            title="Document Source"
          >
            <LLMFormFields
              task={task}
              onChange={onChange}
              fieldFieldComponents={fieldFieldComponents}
              actor={actor}
            />
          </TaskFormSection>
          <TaskFormSection>
            <WeaverCacheOutput onChange={onChange} taskJson={task} />
          </TaskFormSection>
        </Box>
      )}
    </LLMFormFieldsWrapper>
  );
};
