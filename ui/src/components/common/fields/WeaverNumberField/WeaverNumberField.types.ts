import type { ReactNode } from "react";
import type { WeaverTextFieldProps } from "../WeaverTextField";

/**
 * Props for the canonical WeaverNumberField component
 */
export interface WeaverNumberFieldProps
  extends Omit<
    WeaverTextFieldProps,
    "value" | "defaultValue" | "onChange" | "type"
  > {
  /** Current controlled numeric value */
  value?: number | null;

  /** Uncontrolled initial numeric value */
  defaultValue?: number | null;

  /** Value change callback returning number | null */
  onChange?: (value: number | null) => void;

  /** Minimum allowed value */
  min?: number;

  /** Maximum allowed value */
  max?: number;

  /** Increment / decrement step size. @default 1 */
  step?: number;

  /** Allowed number of decimal digits */
  precision?: number;

  /** Whether negative numbers are allowed. @default true */
  allowNegative?: boolean;

  /** Whether decimal values are allowed. @default true */
  allowDecimal?: boolean;

  /** Whether to display a thousands separator (e.g. "," or custom character). @default false */
  thousandSeparator?: boolean | string;

  /** Visual prefix placed before the numeric input (e.g. "$" or icon) */
  prefix?: ReactNode;

  /** Visual suffix placed after the numeric input (e.g. "%" or unit) */
  suffix?: ReactNode;

  /** Whether to render up/down stepper buttons inside the end adornment. @default false */
  showControls?: boolean;

  /** Whether clearing the field or leaving it empty emits null. @default true */
  allowEmpty?: boolean;

  /** Whether scrolling the mouse wheel over the focused field is ignored. @default true */
  preventWheelChange?: boolean;

  /** If true, clamps the value to min/max on blur. @default false */
  clampOnBlur?: boolean;

  /** Callback fired whenever the field's numeric validity state changes */
  onValidityChange?: (valid: boolean) => void;
}
