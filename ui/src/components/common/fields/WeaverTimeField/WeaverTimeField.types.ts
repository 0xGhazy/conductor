import type { Dayjs } from "dayjs";
import type { TimePickerProps } from "@mui/x-date-pickers/TimePicker";
import type { WeaverFieldBaseProps } from "../types";
import type { WeaverPickerValidationError } from "../internal/pickerFieldUtils";

/**
 * Props for the canonical WeaverTimeField component
 */
export interface WeaverTimeFieldProps
  extends WeaverFieldBaseProps,
    Omit<
      TimePickerProps,
      | "value"
      | "defaultValue"
      | "onChange"
      | "disabled"
      | "readOnly"
      | "label"
    > {
  /** Controlled time value as Dayjs or null */
  value?: Dayjs | null;

  /** Uncontrolled initial time value */
  defaultValue?: Dayjs | null;

  /** Normalized change callback returning Dayjs | null */
  onChange?: (value: Dayjs | null) => void;

  /** Whether the field can be cleared back to null */
  clearable?: boolean;

  /**
   * Whether to show the 'Now' quick-action button in the picker action bar
   * @default true
   */
  showNow?: boolean;

  /** Callback when native picker validation changes (minTime, maxTime, etc.) */
  onValidationError?: (error: WeaverPickerValidationError | null) => void;
}
