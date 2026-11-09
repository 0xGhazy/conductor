import { Fragment, FunctionComponent } from "react";
import { Box, Grid, IconButton } from "@mui/material";
import { Button } from "components";
import maybeVariable from "../maybeVariableHOC";
import { WeaverAutocompleteVariables } from "components/FlatMapForm/WeaverAutocompleteVariables";
import { WeaverEmptyGroupField } from "components/ui/inputs/WeaverEmptyGroupField";
import AddIcon from "components/icons/AddIcon";
import TrashIcon from "components/icons/TrashIcon";

const ROLE_SUGGESTION = ["user", "assistant", "system", "human"];

interface WeaverArrayMapFormFieldProps {
  availableOptions: string[];
  onChange: (idx: number, role: string, message: string) => void;
  idx: number;
  data: { role: string; message: string };
  handleRemoveItem: (idx: number) => void;
}

const WeaverArrayMapFormField: FunctionComponent<
  WeaverArrayMapFormFieldProps
> = ({ availableOptions, onChange, idx, data, handleRemoveItem }) => {
  return (
    <Grid container sx={{ width: "100%" }} spacing={2}>
      <Grid
        size={{
          xs: 12,
          md: 4,
          sm: 12,
        }}
      >
        <WeaverAutocompleteVariables
          onChange={(selectedKey: string) => {
            onChange(idx, selectedKey, data.message);
          }}
          otherOptions={availableOptions}
          value={data.role ?? ""}
          label="Role"
        />
      </Grid>
      <Grid
        size={{
          xs: 12,
          md: 7,
          sm: 11,
        }}
      >
        <WeaverAutocompleteVariables
          onChange={(val: any) => {
            onChange(idx, data.role, val);
          }}
          value={data.message ?? ""}
          label="Message"
        />
      </Grid>
      <Grid
        size={{
          md: 1,
          sm: 1,
        }}
      >
        <IconButton onClick={() => handleRemoveItem(idx)}>
          <TrashIcon />
        </IconButton>
      </Grid>
    </Grid>
  );
};

interface WeaverArrayMapFormProps {
  value: { role: string; message: string }[];
  onChange: (messages: { role: string; message: string }[]) => void;
}

const WeaverArrayMapFormBase: FunctionComponent<
  WeaverArrayMapFormProps
> = ({ value, onChange }) => {
  const handleAddItem = () => {
    const newMessages = [...value, { role: "", message: "" }];
    onChange(newMessages);
  };

  const handleRemoveItem = (idx: number) => {
    const newMessages = [...value];
    newMessages.splice(idx, 1);
    onChange(newMessages);
  };

  const handleChangeItem = (idx: number, role: string, message: string) => {
    const newMessages = [...value];
    newMessages[idx] = { role, message };
    onChange(newMessages);
  };

  return (
    <>
      {(!value || value.length === 0) && (
        <WeaverEmptyGroupField
          addButtonLabel="Add message"
          handleAddItem={handleAddItem}
        />
      )}
      {Array.isArray(value) && value.length > 0 && (
        <>
          <Box
            sx={{
              p: 6,
              borderRadius: "6px",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              background: "rgba(0, 0, 0, 0.04)",
              width: "100%",
              display: "grid",
              gridRowGap: 12,
            }}
          >
            {value.map((item, idx) => (
              <Fragment key={idx}>
                <WeaverArrayMapFormField
                  availableOptions={ROLE_SUGGESTION}
                  idx={idx}
                  data={item}
                  onChange={handleChangeItem}
                  handleRemoveItem={handleRemoveItem}
                />
              </Fragment>
            ))}
          </Box>
          <Button
            size="small"
            onClick={handleAddItem}
            startIcon={<AddIcon />}
            sx={{ my: 2 }}
          >
            Add message
          </Button>
        </>
      )}
    </>
  );
};

const WeaverArrayMapForm = maybeVariable(WeaverArrayMapFormBase);
export { WeaverArrayMapForm, WeaverArrayMapFormBase };
