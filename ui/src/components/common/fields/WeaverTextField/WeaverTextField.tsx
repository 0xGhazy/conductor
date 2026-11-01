import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  type ChangeEvent,
} from "react";
import MuiTextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { WeaverTextFieldProps } from "./WeaverTextField.types";
import styles from "./WeaverTextField.module.css";

export const WeaverTextField = forwardRef<HTMLInputElement, WeaverTextFieldProps>(
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

      // WeaverTextField specific props
      value: controlledValue,
      defaultValue,
      onChange,
      clearable = false,
      onClear,
      passwordToggle = false,
      loading = false,
      startAdornment,
      endAdornment,
      maxLength,
      pattern,
      patternErrorMessage = "Invalid format",
      onPatternValidityChange,

      // MUI props & overrides
      fullWidth = true,
      size = "small",
      variant = "outlined",
      type: userType = "text",
      className = "",
      sx,
      slotProps,
      InputProps: legacyInputProps,
      inputProps: legacyInputAttributes,
      multiline = false,
      ...restProps
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Value state tracking (controlled vs uncontrolled vs legacyInputAttributes from Autocomplete)
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState<string>(
      controlledValue ?? defaultValue ?? ""
    );

    const effectiveValue = isControlled
      ? (controlledValue ?? "")
      : legacyInputAttributes?.value !== undefined
      ? (legacyInputAttributes.value as string)
      : internalValue;

    // Password visibility toggle state
    const [showPassword, setShowPassword] = useState(false);
    const effectiveType = passwordToggle
      ? showPassword
        ? "text"
        : "password"
      : userType;

    // Client-side regex pattern validation
    const isPatternValid = useMemo(() => {
      if (!pattern || effectiveValue === "") {
        return true;
      }
      try {
        // Strip sticky/global flags to avoid stateful lastIndex issues
        const cleanFlags = pattern.flags ? pattern.flags.replace(/[gy]/g, "") : "";
        const testRegex = new RegExp(pattern.source, cleanFlags);
        return testRegex.test(effectiveValue);
      } catch {
        return true;
      }
    }, [pattern, effectiveValue]);

    // Notify pattern validity change
    const prevValidRef = useRef(isPatternValid);
    useEffect(() => {
      if (pattern && prevValidRef.current !== isPatternValid) {
        prevValidRef.current = isPatternValid;
        onPatternValidityChange?.(isPatternValid);
      }
    }, [isPatternValid, pattern, onPatternValidityChange]);

    // Error precedence: External errorMessage > local regex error > helperText
    const localRegexError = !isPatternValid ? patternErrorMessage : undefined;
    const effectiveErrorText = errorMessage || localRegexError;
    const hasError = Boolean(effectiveErrorText);
    const displayHelperText = hasError ? effectiveErrorText : helperText;

    // Change handlers
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const nextVal = e.target.value;
      if (!isControlled) {
        setInternalValue(nextVal);
      }
      legacyInputAttributes?.onChange?.(e);
      onChange?.(nextVal);
    };

    const handleClear = () => {
      if (disabled || readOnly) return;
      if (!isControlled) {
        setInternalValue("");
      }
      onChange?.("");
      onClear?.();
      inputRef.current?.focus();
    };

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    // Construct adornments safely without clobbering consumer-provided adornments
    const hasStartAdornment = Boolean(
      startAdornment ||
        legacyInputProps?.startAdornment ||
        (slotProps?.input as { startAdornment?: React.ReactNode })?.startAdornment
    );

    const mergedStartAdornment = hasStartAdornment ? (
      <>
        {(slotProps?.input as { startAdornment?: React.ReactNode })?.startAdornment}
        {legacyInputProps?.startAdornment}
        {startAdornment && (
          <InputAdornment position="start">{startAdornment}</InputAdornment>
        )}
      </>
    ) : undefined;

    const showClearButton =
      clearable && Boolean(effectiveValue) && !disabled && !readOnly;

    const mergedEndAdornment = (
      <span className={styles.adornmentGroup}>
        {(slotProps?.input as { endAdornment?: React.ReactNode })?.endAdornment}
        {legacyInputProps?.endAdornment}
        {endAdornment && (
          <InputAdornment position="end">{endAdornment}</InputAdornment>
        )}
        {loading && (
          <span className={styles.spinnerAdornment}>
            <CircularProgress size={16} color="inherit" />
          </span>
        )}
        {showClearButton && (
          <IconButton
            size="small"
            onClick={handleClear}
            className={styles.adornmentButton}
            aria-label="Clear input"
            tabIndex={-1}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        {passwordToggle && (
          <IconButton
            size="small"
            onClick={togglePasswordVisibility}
            className={styles.adornmentButton}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? (
              <VisibilityOffIcon sx={{ fontSize: 18 }} />
            ) : (
              <VisibilityIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        )}
      </span>
    );

    // Dimension handling: Apply width and height cleanly without breaking labels/multiline
    const dimensionSx = {
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined
        ? multiline
          ? {
              "& .MuiInputBase-root": {
                minHeight: typeof height === "number" ? `${height}px` : height,
              },
            }
          : {
              "& .MuiInputBase-root": {
                height: typeof height === "number" ? `${height}px` : height,
                boxSizing: "border-box",
              },
            }
        : {}),
      ...sx,
    };

    // Combine direction and read-only classes
    const combinedClassName = [
      styles.root,
      readOnly ? styles.readOnly : "",
      direction === "rtl" ? styles.dirRtl : direction === "ltr" ? styles.dirLtr : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Fully merge legacy InputProps (containing Autocomplete's ref: setAnchorEl!) and slotProps
    const resolvedInputProps = {
      ...legacyInputProps,
      ...(slotProps?.input as object),
      readOnly,
      ...(mergedStartAdornment ? { startAdornment: mergedStartAdornment } : {}),
      endAdornment: mergedEndAdornment,
    };

    const resolvedHtmlInput = {
      ...legacyInputAttributes,
      ...(slotProps?.htmlInput as object),
      ...(readOnly ? { readOnly: true } : {}),
      ...(maxLength !== undefined ? { maxLength } : {}),
      ...(direction ? { dir: direction } : {}),
    };

    // Ref handler merging internal ref with Autocomplete's native input ref
    const handleInputRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof legacyInputAttributes?.ref === "function") {
        legacyInputAttributes.ref(node);
      } else if (
        legacyInputAttributes?.ref &&
        typeof legacyInputAttributes.ref === "object"
      ) {
        (legacyInputAttributes.ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    return (
      <MuiTextField
        inputRef={handleInputRef}
        label={label}
        value={effectiveValue}
        onChange={handleChange}
        fullWidth={fullWidth}
        size={size}
        variant={variant}
        type={effectiveType}
        required={required}
        disabled={disabled}
        error={hasError}
        helperText={displayHelperText}
        multiline={multiline}
        className={combinedClassName}
        sx={dimensionSx}
        InputProps={resolvedInputProps}
        inputProps={resolvedHtmlInput}
        slotProps={{
          ...slotProps,
          input: resolvedInputProps,
          htmlInput: resolvedHtmlInput,
        }}
        {...restProps}
      />
    );
  }
);

WeaverTextField.displayName = "WeaverTextField";
