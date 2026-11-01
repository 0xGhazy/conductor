import React, {
  useState,
  useMemo,
  useCallback,
  type SyntheticEvent,
} from "react";
import Autocomplete, { type FilterOptionsState } from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import RefreshIcon from "@mui/icons-material/Refresh";
import { WeaverTextField } from "../WeaverTextField";
import type {
  WeaverOption,
  WeaverOptionTextFieldProps,
} from "./WeaverOptionTextField.types";
import styles from "./WeaverOptionTextField.module.css";

export function WeaverOptionTextField<T = unknown>(
  props: WeaverOptionTextFieldProps<T>
) {
  const {
    // Base field contract
    label,
    helperText,
    errorMessage,
    required = false,
    disabled = false,
    readOnly = false,
    width,
    height,
    direction,

    // Option-specific props
    value: controlledValue,
    defaultValue,
    onChange,
    options = [],
    allowFreeText = true,
    suggestions = {
      onTyping: true,
      onFocus: false,
      onCtrlSpace: true,
    },
    onOptionSelect,
    onInputChange,
    getOptionLabel,
    getOptionInputValue,
    refreshable = false,
    refreshing = false,
    onRefresh,
    loading = false,
    clearable = false,
    placeholder,
    size = "small",
    fullWidth = true,
    variant = "outlined",
    startAdornment,
    endAdornment,
    filterOptions,
    renderOption,
    onKeyDown,
    className = "",
  } = props;

  // Controlled vs uncontrolled input text tracking
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    controlledValue ?? defaultValue ?? ""
  );

  const currentInputValue = isControlled
    ? (controlledValue ?? "")
    : internalValue;

  // Dropdown open state
  const [open, setOpen] = useState(false);

  // Suggestions capabilities configuration
  const onTyping = suggestions.onTyping ?? true;
  const onFocus = suggestions.onFocus ?? false;
  const onCtrlSpace = suggestions.onCtrlSpace ?? true;

  // Extractors
  const resolveOptionLabel = useCallback(
    (option: WeaverOption<T> | string): string => {
      if (typeof option === "string") return option;
      if (getOptionLabel) return getOptionLabel(option);
      return option.label ?? "";
    },
    [getOptionLabel]
  );

  const resolveOptionInputValue = useCallback(
    (option: WeaverOption<T>): string => {
      if (getOptionInputValue) return getOptionInputValue(option);
      return option.inputValue ?? option.label ?? "";
    },
    [getOptionInputValue]
  );

  // Keyboard navigation & Ctrl + Space trigger
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      onCtrlSpace &&
      event.ctrlKey &&
      (event.code === "Space" || event.key === " ")
    ) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    }
    onKeyDown?.(event);
  };

  // Autocomplete change: user selected an option or cleared
  const handleAutocompleteChange = (
    _event: SyntheticEvent,
    newValue: WeaverOption<T> | string | null
  ) => {
    if (!newValue) {
      // Cleared
      if (!isControlled) {
        setInternalValue("");
      }
      onChange?.("");
      onInputChange?.("", "clear");
      return;
    }

    if (typeof newValue === "string") {
      // User typed text and submitted in freeSolo mode
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
      onInputChange?.(newValue, "typing");
      return;
    }

    // Selected an option
    const textToWrite = resolveOptionInputValue(newValue);
    if (!isControlled) {
      setInternalValue(textToWrite);
    }
    onChange?.(textToWrite);
    onOptionSelect?.(newValue);
    onInputChange?.(textToWrite, "selection");
  };

  // Free typing handler
  const handleInputChange = (
    _event: SyntheticEvent,
    newInputValue: string,
    reason: "input" | "reset" | "clear"
  ) => {
    if (reason === "input") {
      if (!isControlled) {
        setInternalValue(newInputValue);
      }
      onChange?.(newInputValue);
      onInputChange?.(newInputValue, "typing");

      if (onTyping) {
        setOpen(true);
      }
    } else if (reason === "clear") {
      if (!isControlled) {
        setInternalValue("");
      }
      onChange?.("");
      onInputChange?.("", "clear");
    }
  };

  // Smart default filtering: matches against label, inputValue, or group
  const defaultFilterOptions = useCallback(
    (
      candidateOptions: WeaverOption<T>[],
      state: FilterOptionsState<WeaverOption<T>>
    ) => {
      const query = (state.inputValue ?? "").trim().toLowerCase();
      if (!query) return candidateOptions;

      const filtered = candidateOptions.filter((option) => {
        const labelMatch = (option.label ?? "").toLowerCase().includes(query);
        const inputValMatch = (option.inputValue ?? "")
          .toLowerCase()
          .includes(query);
        const groupMatch = (option.group ?? "").toLowerCase().includes(query);
        return labelMatch || inputValMatch || groupMatch;
      });

      // If user typed something but nothing matched, fall back to all options so Ctrl+Space always works
      return filtered.length > 0 ? filtered : candidateOptions;
    },
    []
  );

  // Default option renderer: shows clean label, group badge, and code/value preview
  const defaultRenderOption = useCallback(
    (
      optionProps: React.HTMLAttributes<HTMLLIElement>,
      option: WeaverOption<T>
    ) => {
      const { key, ...liProps } = optionProps as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>;
      const hasDistinctValue =
        Boolean(option.inputValue) && option.inputValue !== option.label;

      return (
        <li
          key={key}
          {...liProps}
          className={`${optionProps.className || ""} ${styles.optionItem}`}
        >
          <div className={styles.optionHeader}>
            <span className={styles.optionLabel}>{option.label}</span>
            {option.group && (
              <span className={styles.optionGroupBadge}>{option.group}</span>
            )}
          </div>
          {hasDistinctValue && (
            <code className={styles.optionValuePreview}>
              {option.inputValue}
            </code>
          )}
        </li>
      );
    },
    []
  );

  // Grouping support and sorted options
  const hasGrouping = useMemo(() => {
    return options.some((opt) => Boolean(opt.group));
  }, [options]);

  const sortedOptions = useMemo(() => {
    if (!hasGrouping) return options;
    return [...options].sort((a, b) =>
      (a.group || "").localeCompare(b.group || "")
    );
  }, [options, hasGrouping]);

  // Find currently matched option for controlled value if applicable
  const selectedOption = useMemo(() => {
    return (
      sortedOptions.find(
        (opt) =>
          resolveOptionInputValue(opt) === currentInputValue ||
          opt.label === currentInputValue
      ) ?? null
    );
  }, [sortedOptions, currentInputValue, resolveOptionInputValue]);

  return (
    <Autocomplete<WeaverOption<T>, false, false, boolean>
      freeSolo={allowFreeText}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disabled={disabled}
      readOnly={readOnly}
      options={sortedOptions}
      value={selectedOption}
      inputValue={currentInputValue}
      onInputChange={handleInputChange}
      onChange={handleAutocompleteChange}
      getOptionLabel={resolveOptionLabel}
      getOptionDisabled={(option) =>
        typeof option === "string" ? false : Boolean(option.disabled)
      }
      groupBy={hasGrouping ? (option) => option.group || "" : undefined}
      filterOptions={filterOptions ?? defaultFilterOptions}
      renderOption={renderOption ?? defaultRenderOption}
      onKeyDown={handleKeyDown}
      className={`${styles.root} ${className}`}
      sx={{
        ...(width !== undefined ? { width } : {}),
      }}
      slotProps={{
        popper: {
          sx: { zIndex: 1400 },
        },
      }}
      renderInput={(params) => {
        // Construct end adornment combining refresh action and consumer adornment
        const extraEndAdornments = (
          <span className={styles.adornmentGroup}>
            {refreshable && (
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={refreshing || disabled || readOnly}
                className={`${styles.refreshButton} ${
                  refreshing ? styles.refreshSpinning : ""
                }`}
                aria-label="Refresh options"
                tabIndex={-1}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
            {endAdornment}
          </span>
        );

        return (
          <WeaverTextField
            {...params}
            label={label}
            helperText={helperText}
            errorMessage={errorMessage}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            width={width}
            height={height}
            direction={direction}
            placeholder={placeholder}
            size={size}
            variant={variant}
            fullWidth={fullWidth}
            loading={loading}
            clearable={clearable}
            startAdornment={startAdornment}
            endAdornment={extraEndAdornments}
            onFocus={(e) => {
              if (onFocus) {
                setOpen(true);
              }
              params.inputProps.onFocus?.(e as React.FocusEvent<HTMLInputElement>);
            }}
            onBlur={(e) => {
              params.inputProps.onBlur?.(e as React.FocusEvent<HTMLInputElement>);
            }}
            onKeyDown={(e) => {
              if (
                onCtrlSpace &&
                e.ctrlKey &&
                (e.code === "Space" || e.key === " ")
              ) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
              }
              params.inputProps.onKeyDown?.(e as React.KeyboardEvent<HTMLInputElement>);
            }}
          />
        );
      }}
    />
  );
}
