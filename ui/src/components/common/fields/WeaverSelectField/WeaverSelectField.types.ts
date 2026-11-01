import type { ReactNode } from "react";
import type { SelectProps } from "@mui/material/Select";
import type { WeaverFieldBaseProps } from "../types";

/**
 * Option descriptor for WeaverSelectField
 */
export interface WeaverSelectOption<T = string> {
  /** Human-readable label displayed in dropdown and selected value */
  label: string;

  /** Underlying unique value */
  value: T;

  /** Optional icon rendered next to the label */
  icon?: ReactNode;

  /** Whether this individual option is disabled */
  disabled?: boolean;
}

/**
 * Props for the canonical WeaverSelectField component
 */
export interface WeaverSelectFieldProps<T = string>
  extends Omit<
      SelectProps<T | T[]>,
      | "value"
      | "defaultValue"
      | "multiple"
      | "onChange"
      | "error"
      | "disabled"
      | "required"
      | "label"
    >,
    WeaverFieldBaseProps {
  /** Array of selectable options */
  options: WeaverSelectOption<T>[];

  /** Whether multiple options can be selected */
  multiple?: boolean;

  /** Current controlled value (T for single select, T[] for multiple select) */
  value?: T | T[];

  /** Initial uncontrolled value */
  defaultValue?: T | T[];

  /**
   * Value change callback providing the normalized value and corresponding option metadata
   */
  onChange?: (
    value: T | T[],
    selectedOptions: WeaverSelectOption<T>[]
  ) => void;

  /** Placeholder text shown when no value is selected */
  placeholder?: string;

  /**
   * Custom renderer for the selected value display
   */
  renderSelectedValue?: (
    selectedOptions: WeaverSelectOption<T>[]
  ) => ReactNode;

  /**
   * When true in single-select mode, renders the option's icon inside the selected value box
   * @default false
   */
  showSelectedIcons?: boolean;
}
