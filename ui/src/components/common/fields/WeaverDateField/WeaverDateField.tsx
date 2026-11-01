import { useState, forwardRef } from "react";
import type { Dayjs } from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type { WeaverDateFieldProps } from "./WeaverDateField.types";
import {
  buildPickerSlotProps,
  getPickerErrorMessage,
  type WeaverPickerValidationError,
} from "../internal/pickerFieldUtils";
import { WeaverDateActionBar } from "../internal/pickerFieldActionBars";
import styles from "../internal/pickerField.module.css";

export const WeaverDateField = forwardRef<HTMLDivElement, WeaverDateFieldProps>(
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
        ...mergedSlotProps.actionBar,
      },
    };

    const finalSlots = {
      actionBar: WeaverDateActionBar,
      ...slots,
    };

    // Each picker supplies its own adapter so the date-pickers package only loads
    // with the screens that render a picker (no app-wide LocalizationProvider).
    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
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

WeaverDateField.displayName = "WeaverDateField";
