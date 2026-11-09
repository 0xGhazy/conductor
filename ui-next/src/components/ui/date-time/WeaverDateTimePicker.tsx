import {
  DateTimePicker,
  DateTimePickerProps,
  LocalizationProvider,
} from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import React, { RefAttributes, forwardRef } from "react";
import { TextFieldProps } from "@mui/material";

import WeaverInput, {
  WeaverInputProps,
} from "components/ui/inputs/WeaverInput";
import DatetimeIcon from "components/icons/DatetimeIcon";
import { FORMAT_DATE_TIME_PICKER } from "utils/constants/common";

export type WeaverDateTimePickerProps<TDate> = DateTimePickerProps<TDate> &
  RefAttributes<HTMLDivElement> & {
    inputProps?: WeaverInputProps;
  };

const WeaverDateTimePicker = forwardRef<
  HTMLInputElement,
  WeaverDateTimePickerProps<Date | null>
>(
  (
    {
      autoFocus,
      format = FORMAT_DATE_TIME_PICKER,
      disabled,
      inputProps,
      ...restProps
    },
    ref,
  ) => {
    return (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DateTimePicker
          {...restProps}
          inputRef={ref}
          format={format}
          autoFocus={autoFocus}
          disabled={disabled}
          className="conductor-datetime-picker"
          slots={{
            openPickerIcon: DatetimeIcon,
            textField: WeaverInput as React.ComponentType<TextFieldProps>,
          }}
          slotProps={{
            textField: { ...inputProps, disabled },
            actionBar: {
              actions: ["clear", "accept"],
            },
          }}
        />
      </LocalizationProvider>
    );
  },
);

export default WeaverDateTimePicker;
