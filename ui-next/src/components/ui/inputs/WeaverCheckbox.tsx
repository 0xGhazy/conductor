import { FormControlLabel } from "@mui/material";
import MuiCheckbox from "components/ui/MuiCheckbox";

export type WeaverCheckboxProps = {
  id?: string;
  label?: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
};

export const WeaverCheckbox = ({
  id,
  label,
  value,
  onChange,
}: WeaverCheckboxProps) => {
  return (
    <FormControlLabel
      control={
        <MuiCheckbox
          id={id}
          checked={value}
          onChange={(__, value) => {
            onChange?.(value);
          }}
        />
      }
      label={label}
    />
  );
};
