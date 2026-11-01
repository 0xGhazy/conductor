import type { Dayjs } from "dayjs";
import type { DateTimePickerProps } from "@mui/x-date-pickers/DateTimePicker";
import type { WeaverFieldBaseProps } from "../types";
import type { WeaverPickerValidationError } from "../internal/pickerFieldUtils";

/**
 * Props for the canonical WeaverDateTimeField component
 */
export interface WeaverDateTimeFieldProps
  extends WeaverFieldBaseProps,
    Omit<
      DateTimePickerProps,
      | "value"
      | "defaultValue"
      | "onChange"
      | "disabled"
      | "readOnly"
      | "label"
    > {
  /** Controlled date-time value as Dayjs or null */
  value?: Dayjs | null;

  /** Uncontrolled initial date-time value */
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

  /**
   * Whether to show the 'Now' quick-action button in the picker action bar
   * @default true
   */
  showNow?: boolean;

  /** Callback when native picker validation changes (minDateTime, maxDateTime, etc.) */
  onValidationError?: (error: WeaverPickerValidationError | null) => void;
}
