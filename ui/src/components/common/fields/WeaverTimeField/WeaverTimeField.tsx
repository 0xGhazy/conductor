import { useState, forwardRef } from "react";
import type { Dayjs } from "dayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { WeaverTimeFieldProps } from "./WeaverTimeField.types";
import {
  buildPickerSlotProps,
  getPickerErrorMessage,
  type WeaverPickerValidationError,
} from "../internal/pickerFieldUtils";
import { WeaverTimeActionBar } from "../internal/pickerFieldActionBars";
import styles from "../internal/pickerField.module.css";

export const WeaverTimeField = forwardRef<HTMLDivElement, WeaverTimeFieldProps>(
  (
    {
      // Base contract props
      label,
      helperText,
      errorMessage,
      required = false,
      disabled = false,
      readOnly = false,
      width,
      height,
      direction,

      // Picker props
      value,
      defaultValue,
      onChange,
      clearable = false,
      showNow = true,
      onValidationError,

      // MUI props
      className = "",
      slotProps,
      slots,
      ...restProps
    },
    ref
  ) => {
    const [pickerError, setPickerError] =
      useState<WeaverPickerValidationError | null>(null);

    const handlePickerError = (error: any, val: Dayjs | null) => {
      const errorStr = error ? (String(error) as WeaverPickerValidationError) : null;
      setPickerError(errorStr);
      onValidationError?.(errorStr);
      restProps.onError?.(error, val);
    };

    const handleChange = (newVal: Dayjs | null, context: any) => {
      onChange?.(newVal);
      restProps.onChange?.(newVal as any, context);
    };

    const mergedSlotProps = buildPickerSlotProps({
      label,
      helperText,
      errorMessage,
      pickerErrorText: getPickerErrorMessage(pickerError),
      required,
      disabled,
      readOnly,
      width,
      height,
      direction,
      clearable,
      className,
      consumerSlotProps: slotProps,
      styles,
    });

    const finalSlotProps = {
      ...mergedSlotProps,
      actionBar: {
        showNow,
        ...mergedSlotProps.actionBar,
      },
    };

    const finalSlots = {
      actionBar: WeaverTimeActionBar,
      ...slots,
    };

    // Each picker supplies its own adapter so the date-pickers package only loads
    // with the screens that render a picker (no app-wide LocalizationProvider).
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <TimePicker
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          disabled={disabled}
          readOnly={readOnly}
          onError={handlePickerError}
          slots={finalSlots}
          slotProps={finalSlotProps}
          {...restProps}
        />
      </LocalizationProvider>
    );
  }
);

WeaverTimeField.displayName = "WeaverTimeField";
