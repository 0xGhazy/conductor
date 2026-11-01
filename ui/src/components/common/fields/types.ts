import type { ReactNode } from "react";

/**
 * Common base contract for all Weaver shared field components.
 * Standardizes label, error, validation, dimensions, and direction.
 */
export interface WeaverFieldBaseProps {
  /** Field label element or text */
  label?: ReactNode;

  /** Supporting helper text displayed below the field */
  helperText?: ReactNode;

  /** Primary external error message. When provided, takes highest precedence. */
  errorMessage?: string;

  /** Marks the field as required and displays standard indicator */
  required?: boolean;

  /** Disables the field from user interaction and dims styling */
  disabled?: boolean;

  /** Sets the field into read-only mode, distinct visually from disabled */
  readOnly?: boolean;

  /** Explicit width override (number in px or CSS string e.g. "100%", "400px") */
  width?: number | string;

  /** Explicit height override for the input container */
  height?: number | string;

  /** Explicit text direction ("ltr" or "rtl") */
  direction?: "ltr" | "rtl";
}

/** Canonical default height in pixels for all Weaver input controls (matches MUI size="small") */
export const WEAVER_FIELD_DEFAULT_HEIGHT = 40;

