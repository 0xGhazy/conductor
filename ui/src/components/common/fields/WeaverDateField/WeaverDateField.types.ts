import type { Dayjs } from "dayjs";
import type { DatePickerProps } from "@mui/x-date-pickers/DatePicker";
import type { WeaverFieldBaseProps } from "../types";
import type { WeaverPickerValidationError } from "../internal/pickerFieldUtils";

/**
 * Props for the canonical WeaverDateField component
 */
export interface WeaverDateFieldProps
  extends WeaverFieldBaseProps,
    Omit<
      DatePickerProps,
      | "value"
      | "defaultValue"
      | "onChange"
      | "disabled"
      | "readOnly"
      | "label"
    > {
  /** Controlled date value as Dayjs or null */
  value?: Dayjs | null;

  /** Uncontrolled initial date value */
  defaultValue?: Dayjs | null;

  /** Normalized change callback returning Dayjs | null */
  onChange?: (value: Dayjs | null) => void;

  /** Whether the field can be cleared back to null */
  clearable?: boolean;

  /**
   * Whether to show the 'Today' quick-action button in the picker action bar
   * @default true
   */
  showToday?: boolean;

  /** Callback when native picker validation changes (minDate, maxDate, invalidDate, etc.) */
  onValidationError?: (error: WeaverPickerValidationError | null) => void;
}
