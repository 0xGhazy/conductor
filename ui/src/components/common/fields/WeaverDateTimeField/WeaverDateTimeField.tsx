import { useState, forwardRef } from "react";
import type { Dayjs } from "dayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { WeaverDateTimeFieldProps } from "./WeaverDateTimeField.types";
import {
  buildPickerSlotProps,
  getPickerErrorMessage,
  type WeaverPickerValidationError,
} from "../internal/pickerFieldUtils";
import { WeaverDateTimeActionBar } from "../internal/pickerFieldActionBars";
import styles from "../internal/pickerField.module.css";

export const WeaverDateTimeField = forwardRef<HTMLDivElement, WeaverDateTimeFieldProps>(
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
      showToday = true,
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
        showToday,
        showNow,
        ...mergedSlotProps.actionBar,
      },
    };

    const finalSlots = {
      actionBar: WeaverDateTimeActionBar,
      ...slots,
    };

    // Each picker supplies its own adapter so the date-pickers package only loads
    // with the screens that render a picker (no app-wide LocalizationProvider).
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateTimePicker
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

WeaverDateTimeField.displayName = "WeaverDateTimeField";
