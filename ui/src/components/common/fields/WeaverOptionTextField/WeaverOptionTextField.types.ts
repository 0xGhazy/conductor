import type { ReactNode, KeyboardEventHandler } from "react";
import type { FilterOptionsState } from "@mui/material/useAutocomplete";
import type { WeaverFieldBaseProps } from "../types";

export interface WeaverOption<T = unknown> {
  /** Display label shown in the options dropdown */
  label: string;

  /** Underlying domain value */
  value: T;

  /** Value written into the text field upon selection (defaults to option.label) */
  inputValue?: string;

  /** When true, option cannot be selected */
  disabled?: boolean;

  /** Optional group name for categorized dropdown listings */
  group?: string;
}

export interface WeaverOptionTextFieldProps<T = unknown>
  extends WeaverFieldBaseProps {
  /** Current controlled string value */
  value?: string;

  /** Uncontrolled default value */
  defaultValue?: string;

  /** Callback fired when text changes (either via typing or option selection) */
  onChange?: (value: string) => void;

  /** Available options to choose from */
  options: WeaverOption<T>[];

  /** When true (default), allows user to type freeform text outside options */
  allowFreeText?: boolean;

  /** Suggestion popup trigger configuration */
  suggestions?: {
    /** Whether typing opens the suggestions dropdown (default: true) */
    onTyping?: boolean;

    /** Whether focusing the input opens the suggestions dropdown (default: false) */
    onFocus?: boolean;

    /** Whether pressing Ctrl + Space triggers suggestions (default: true) */
    onCtrlSpace?: boolean;
  };

  /** Callback fired when an option is selected from the dropdown */
  onOptionSelect?: (option: WeaverOption<T>) => void;

  /** Detailed callback indicating reason for text value change */
  onInputChange?: (
    value: string,
    reason: "typing" | "selection" | "clear"
  ) => void;

  /** Custom extractor for option label */
  getOptionLabel?: (option: WeaverOption<T>) => string;

  /** Custom extractor for input value to write into field upon selection */
  getOptionInputValue?: (option: WeaverOption<T>) => string;

  /** When true, renders a refresh button inside the field adornments */
  refreshable?: boolean;

  /** When true, indicates refresh is active and animates refresh icon */
  refreshing?: boolean;

  /** Callback fired when the refresh button is clicked */
  onRefresh?: () => void | Promise<void>;

  /** Displays loading spinner */
  loading?: boolean;

  /** Shows clear button when input has value */
  clearable?: boolean;

  /** Input placeholder text */
  placeholder?: string;

  /** Sizing of the field */
  size?: "small" | "medium";

  /** Full width field */
  fullWidth?: boolean;

  /** Variant */
  variant?: "outlined" | "filled" | "standard";

  /** Custom start adornment */
  startAdornment?: ReactNode;

  /** Custom end adornment */
  endAdornment?: ReactNode;

  /** Custom filter predicate */
  filterOptions?: (
    options: WeaverOption<T>[],
    state: FilterOptionsState<WeaverOption<T>>
  ) => WeaverOption<T>[];

  /** Custom option renderer */
  renderOption?: (
    props: React.HTMLAttributes<HTMLLIElement>,
    option: WeaverOption<T>
  ) => ReactNode;

  /** Keydown handler */
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;

  /** Custom class name */
  className?: string;
}
