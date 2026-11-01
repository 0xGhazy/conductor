import type { WeaverTextFieldProps } from "../WeaverTextField";

export interface NameValidationResult {
  /** Indicates whether the name is valid and available */
  valid: boolean;

  /** Optional explanatory message when invalid or rejected */
  message?: string;
}

export type NameValidationStatus =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "error";

export interface NameValidationState {
  status: NameValidationStatus;
  message?: string;
}

export interface WeaverNameFieldProps
  extends Omit<
    WeaverTextFieldProps,
    "pattern" | "onPatternValidityChange"
  > {
  /** Client-side regex pattern for name format validation */
  namePattern?: RegExp;

  /** Error message shown when client-side regex fails */
  invalidNameMessage?: string;

  /** Milliseconds to debounce prior to invoking async validateName (default: 400ms) */
  debounceMs?: number;

  /** Backend / async callback to validate name uniqueness or server-side rules */
  validateName?: (value: string) => Promise<NameValidationResult>;

  /** When true, shows inline checkmark/loader/error icon inside end adornment */
  showValidationStatus?: boolean;

  /** Notification callback whenever validation state updates */
  onValidationStateChange?: (state: NameValidationState) => void;
}
