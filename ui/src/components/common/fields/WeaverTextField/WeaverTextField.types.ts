import type { ReactNode } from "react";
import type { TextFieldProps } from "@mui/material/TextField";
import type { WeaverFieldBaseProps } from "../types";

export interface WeaverTextFieldProps
  extends Omit<
      TextFieldProps,
      | "error"
      | "helperText"
      | "onChange"
      | "label"
      | "disabled"
      | "required"
    >,
    WeaverFieldBaseProps {
  /** Current controlled string value */
  value?: string;

  /** Uncontrolled default value */
  defaultValue?: string;

  /** Value change callback providing the clean string value */
  onChange?: (value: string) => void;

  /** When true, displays an end-adornment clear button when value is present */
  clearable?: boolean;

  /** Callback fired when the clear button is clicked */
  onClear?: () => void;

  /** When true, enables password visibility toggling via eye icon */
  passwordToggle?: boolean;

  /** When true, shows an inline loading spinner inside the end adornment */
  loading?: boolean;

  /** Custom start adornment element (merged before input) */
  startAdornment?: ReactNode;

  /** Custom end adornment element (merged after input) */
  endAdornment?: ReactNode;

  /** Maximum character length constraint (wired into native HTML input) */
  maxLength?: number;

  /** Client-side validation pattern */
  pattern?: RegExp;

  /** Custom error message displayed when the pattern test fails */
  patternErrorMessage?: string;

  /** Callback fired whenever pattern validity state changes */
  onPatternValidityChange?: (valid: boolean) => void;
}
