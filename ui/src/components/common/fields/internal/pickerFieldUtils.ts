import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";

export type WeaverPickerValidationError =
  | "invalidDate"
  | "minDate"
  | "maxDate"
  | "minTime"
  | "maxTime"
  | "minDateTime"
  | "maxDateTime"
  | "disablePast"
  | "disableFuture"
  | string;

/**
 * Resolves a human-readable fallback message for MUI X picker validation errors
 */
export function getPickerErrorMessage(
  errorReason: WeaverPickerValidationError | null | undefined
): string | undefined {
  if (!errorReason) return undefined;
  switch (errorReason) {
    case "invalidDate":
      return "Invalid date format";
    case "minDate":
      return "Date is before minimum allowed";
    case "maxDate":
      return "Date is after maximum allowed";
    case "minTime":
      return "Time is before minimum allowed";
    case "maxTime":
      return "Time is after maximum allowed";
    case "minDateTime":
      return "Date and time is before minimum allowed";
    case "maxDateTime":
      return "Date and time is after maximum allowed";
    case "disablePast":
      return "Past dates are not allowed";
    case "disableFuture":
      return "Future dates are not allowed";
    default:
      return "Invalid value";
  }
}

/**
 * Generates sizing sx matching WeaverTextField exactly:
 * - fullWidth by default or explicit width
 * - height applies to input control (& .MuiInputBase-root)
 */
export function createPickerDimensionSx({
  width,
  height,
  sx,
}: {
  width?: number | string;
  height?: number | string;
  sx?: SxProps<Theme>;
}): SxProps<Theme> {
  return {
    width: width !== undefined ? width : "100%",
    ...(height !== undefined
      ? {
          "& .MuiInputBase-root": {
            height: typeof height === "number" ? `${height}px` : height,
            boxSizing: "border-box",
          },
        }
      : {}),
    ...(Array.isArray(sx) ? sx : [sx]),
  } as SxProps<Theme>;
}

export interface BuildPickerSlotPropsOptions {
  label?: ReactNode;
  helperText?: ReactNode;
  errorMessage?: string;
  pickerErrorText?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  width?: number | string;
  height?: number | string;
  direction?: "ltr" | "rtl";
  clearable?: boolean;
  className?: string;
  consumerSlotProps?: any;
  styles: Record<string, string>;
}

/**
 * Merges wrapper contracts and consumer slotProps without overwriting
 */
export function buildPickerSlotProps({
  label,
  helperText,
  errorMessage,
  pickerErrorText,
  required = false,
  disabled = false,
  readOnly = false,
  width,
  height,
  direction,
  clearable = false,
  className = "",
  consumerSlotProps = {},
  styles,
}: BuildPickerSlotPropsOptions) {
  // Precedence: external errorMessage > picker validation error > helperText
  const hasExternalError = Boolean(errorMessage);
  const effectiveErrorText = errorMessage || pickerErrorText;
  const hasError = hasExternalError || Boolean(pickerErrorText) || Boolean(consumerSlotProps?.textField?.error);
  const displayHelperText = hasExternalError
    ? errorMessage
    : effectiveErrorText ?? helperText ?? consumerSlotProps?.textField?.helperText;

  const dimensionSx = createPickerDimensionSx({
    width,
    height,
    sx: consumerSlotProps?.textField?.sx,
  });

  const combinedClassName = [
    styles.root,
    readOnly ? styles.readOnly : "",
    direction === "rtl" ? styles.dirRtl : direction === "ltr" ? styles.dirLtr : "",
    className,
    consumerSlotProps?.textField?.className,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...consumerSlotProps,
    field: {
      ...(clearable && !readOnly && !disabled ? { clearable: true } : {}),
      ...consumerSlotProps?.field,
    },
    textField: {
      size: "small" as const,
      fullWidth: width === undefined,
      label,
      required,
      disabled,
      error: hasError,
      helperText: displayHelperText,
      className: combinedClassName,
      sx: dimensionSx,
      ...consumerSlotProps?.textField,
      inputProps: {
        ...(readOnly ? { readOnly: true } : {}),
        ...(direction ? { dir: direction } : {}),
        ...consumerSlotProps?.textField?.inputProps,
      },
    },
  };
}
