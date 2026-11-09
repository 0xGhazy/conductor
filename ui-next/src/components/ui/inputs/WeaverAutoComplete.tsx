import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import {
  Autocomplete,
  AutocompleteProps,
  AutocompleteRenderGetTagProps,
  Chip,
  Popper,
} from "@mui/material";
import match from "autosuggest-highlight/match";
import parse from "autosuggest-highlight/parse";
import { forwardRef } from "react";
import { autocompleteStyle } from "shared/styles";
import WeaverInput, { WeaverInputProps } from "./WeaverInput";
import XCloseIcon from "../../icons/XCloseIcon";

export type WeaverAutocompleteProps<T = string> = Omit<
  AutocompleteProps<
    T,
    boolean | undefined,
    boolean | undefined,
    boolean | undefined
  >,
  "renderInput"
> & {
  label: string;
  placeholder?: string;
  error?: boolean;
  required?: boolean;
  helperText?: string;
  WeaverInputProps?: Partial<WeaverInputProps>;
  id?: string;
  onTextInputChange?: (v: string) => void;
  dataTestId?: string;
};

export const WeaverAutoComplete = forwardRef(
  (
    {
      id,
      options = [],
      fullWidth,
      disabled,
      value,
      helperText,
      label,
      placeholder,
      error,
      required,
      WeaverInputProps = {},
      onTextInputChange,
      sx,
      renderOption,
      dataTestId,
      ...rest
    }: WeaverAutocompleteProps<any>,
    ref,
  ) => {
    return (
      <Autocomplete
        id={id}
        sx={[
          ...(Array.isArray(sx) ? sx : [sx]),
          autocompleteStyle({ value }),
          rest.multiple && value?.length > 0
            ? {
                ".MuiTextField-root": {
                  ".MuiOutlinedInput-root": {
                    pt: "9px",
                    pl: "2px",
                    pb: "3px",
                  },
                },
              }
            : null,
        ]}
        ref={ref}
        renderOption={
          renderOption
            ? renderOption
            : (props, option, { inputValue }) => {
                const matches = match(option as string, inputValue);
                const parts = parse(option as string, matches);

                const { key, ...otherProps } = props;
                return (
                  <li key={key} {...otherProps}>
                    <div>
                      {parts.map((part, index) => (
                        <span
                          key={index}
                          style={{
                            fontWeight: part.highlight ? 700 : 400,
                          }}
                        >
                          {rest.getOptionLabel
                            ? rest.getOptionLabel(part.text)
                            : part.text}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              }
        }
        autoComplete
        renderInput={(params) => (
          <WeaverInput
            {...params}
            {...WeaverInputProps}
            onTextInputChange={onTextInputChange}
            fullWidth={fullWidth}
            label={label}
            placeholder={placeholder}
            error={error}
            helperText={helperText}
            required={required}
            data-testid={dataTestId}
          />
        )}
        options={options}
        fullWidth={fullWidth}
        disabled={disabled}
        value={value}
        PopperComponent={(props) => <Popper {...props} />}
        clearIcon={<XCloseIcon />}
        renderTags={(
          value: string[],
          getTagProps: AutocompleteRenderGetTagProps,
        ) =>
          value.map((v: string | { label: string }, index) => {
            const renderableLabel: string =
              typeof v === "string" || typeof v === "number" ? v : v.label;
            const { key, ...otherTagProps } = getTagProps({ index });
            return (
              <Chip
                key={key}
                label={renderableLabel}
                {...otherTagProps}
                sx={{
                  marginTop: "1px",
                  marginBottom: "1px",
                  backgroundColor: "rgba(221, 221, 221, 1)",
                  color: "#000",
                  borderRadius: "30px",
                  "& .MuiSvgIcon-root": {
                    background: "transparent",
                    fill: "black",
                  },
                }}
                deleteIcon={<CancelOutlinedIcon />}
              />
            );
          })
        }
        {...rest}
      />
    );
  },
);
