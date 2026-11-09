import { Grid } from "@mui/material";
import { WeaverAutocompleteVariables } from "components/FlatMapForm/WeaverAutocompleteVariables";
import { WeaverFlatMapFormBase } from "components/FlatMapForm/WeaverFlatMapForm";
import { TaskDef } from "types";

type PromptVariablesProps = {
  currentVariables: string | Record<string, string>;
  onChange: (t: Partial<TaskDef>) => void;
  updateField: (
    path: string,
    value: unknown,
    task: Partial<TaskDef>,
  ) => Partial<TaskDef>;
  task: Partial<TaskDef>;
};

const PromptVariables = ({
  currentVariables,
  onChange,
  updateField,
  task,
}: PromptVariablesProps) => {
  return (
    <>
      {typeof currentVariables === "string" ? (
        <Grid size={6}>
          <WeaverAutocompleteVariables
            openOnFocus
            onChange={(value: string) =>
              onChange(
                updateField(`inputParameters.promptVariables`, value, task),
              )
            }
            value={currentVariables}
            label="Prompt variables"
          />
        </Grid>
      ) : (
        <Grid size={12}>
          <WeaverFlatMapFormBase
            showFieldTypes={true}
            keyColumnLabel="Key"
            valueColumnLabel="Value"
            addItemLabel="Add variable"
            onChange={(value: Record<string, unknown>) =>
              onChange(
                updateField(`inputParameters.promptVariables`, value, task),
              )
            }
            value={{ ...currentVariables }}
            autoFocusField={false}
          />
        </Grid>
      )}
    </>
  );
};

export default PromptVariables;
