import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
} from "react";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useDebounce } from "@/hooks/useDebounce";
import { WeaverTextField } from "../WeaverTextField";
import type {
  WeaverNameFieldProps,
  NameValidationStatus,
} from "./WeaverNameField.types";

export const WeaverNameField = forwardRef<HTMLInputElement, WeaverNameFieldProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onChange,
      namePattern,
      invalidNameMessage = "Invalid name format",
      debounceMs = 400,
      validateName,
      showValidationStatus = true,
      onValidationStateChange,
      errorMessage,
      helperText,
      endAdornment,
      disabled = false,
      readOnly = false,
      ...restProps
    },
    ref
  ) => {
    // Controlled vs uncontrolled tracking
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState<string>(
      controlledValue ?? defaultValue ?? ""
    );

    const currentValue = isControlled ? (controlledValue ?? "") : internalValue;

    // Reuse existing shared debounce hook
    const debouncedValue = useDebounce<string>(currentValue, debounceMs);

    // Validation state
    const [validationStatus, setValidationStatus] =
      useState<NameValidationStatus>("idle");
    const [asyncErrorMessage, setAsyncErrorMessage] = useState<string>("");

    // Race-condition protection version counter
    const requestIdRef = useRef(0);

    // Keep latest callbacks in refs so they never trigger effect re-runs
    const onValidationStateChangeRef = useRef(onValidationStateChange);
    onValidationStateChangeRef.current = onValidationStateChange;

    const validateNameRef = useRef(validateName);
    validateNameRef.current = validateName;

    // Cache last notified state to prevent re-entrant state updates and re-renders
    const lastNotifiedStateRef = useRef<{ status: NameValidationStatus; message?: string }>({
      status: "idle",
    });

    const notifyStateChange = useCallback(
      (status: NameValidationStatus, message?: string) => {
        if (
          lastNotifiedStateRef.current.status === status &&
          lastNotifiedStateRef.current.message === message
        ) {
          return;
        }
        lastNotifiedStateRef.current = { status, message };
        onValidationStateChangeRef.current?.({ status, message });
      },
      []
    );

    // Step 1: Client regex validation (synchronous)
    const patternSource = namePattern?.source;
    const patternFlags = namePattern?.flags;

    const isRegexValid = useMemo(() => {
      if (!patternSource || currentValue === "") {
        return true;
      }
      try {
        const cleanFlags = patternFlags ? patternFlags.replace(/[gy]/g, "") : "";
        const testRegex = new RegExp(patternSource, cleanFlags);
        return testRegex.test(currentValue);
      } catch {
        return true;
      }
    }, [patternSource, patternFlags, currentValue]);

    const localRegexError = !isRegexValid ? invalidNameMessage : undefined;

    // Synchronous regex status update
    useEffect(() => {
      if (currentValue === "") {
        setValidationStatus("idle");
        setAsyncErrorMessage("");
        notifyStateChange("idle");
      } else if (!isRegexValid) {
        setValidationStatus("invalid");
        setAsyncErrorMessage("");
        notifyStateChange("invalid", invalidNameMessage);
      }
    }, [currentValue, isRegexValid, invalidNameMessage, notifyStateChange]);

    // Keep track of the last successfully or actively validated value to avoid duplicate calls
    const lastValidatedValueRef = useRef<string | null>(null);

    // Step 2 & 3: Debounced async validation
    const hasValidateName = Boolean(validateName);

    useEffect(() => {
      // Don't validate if empty, regex is invalid, or no async validator provided
      if (!hasValidateName || debouncedValue === "" || !isRegexValid || disabled || readOnly) {
        lastValidatedValueRef.current = null;
        return;
      }

      // If we already validated this exact value, skip re-validating
      if (lastValidatedValueRef.current === debouncedValue) {
        return;
      }

      const currentReqId = ++requestIdRef.current;
      setValidationStatus("validating");
      notifyStateChange("validating");

      let isCancelled = false;
      const validator = validateNameRef.current;
      if (!validator) return;

      validator(debouncedValue)
        .then((result) => {
          if (isCancelled || requestIdRef.current !== currentReqId) {
            // Stale response discarded!
            return;
          }

          lastValidatedValueRef.current = debouncedValue;

          if (result.valid) {
            setValidationStatus("valid");
            setAsyncErrorMessage("");
            notifyStateChange("valid");
          } else {
            const msg = result.message || "Name is invalid or already taken";
            setValidationStatus("invalid");
            setAsyncErrorMessage(msg);
            notifyStateChange("invalid", msg);
          }
        })
        .catch((err: Error) => {
          if (isCancelled || requestIdRef.current !== currentReqId) {
            return;
          }
          lastValidatedValueRef.current = debouncedValue;
          const msg = err?.message || "Validation failed";
          setValidationStatus("error");
          setAsyncErrorMessage(msg);
          notifyStateChange("error", msg);
        });

      return () => {
        isCancelled = true;
      };
    }, [debouncedValue, isRegexValid, hasValidateName, disabled, readOnly, notifyStateChange]);

    // Error precedence: external errorMessage > local regex error > async validation error > helperText
    const effectiveError =
      errorMessage || localRegexError || asyncErrorMessage || undefined;

    // Status indicator adornment
    const renderValidationStatusAdornment = () => {
      if (!showValidationStatus || currentValue === "" || disabled || readOnly) {
        return null;
      }

      switch (validationStatus) {
        case "validating":
          return <CircularProgress size={16} color="inherit" />;
        case "valid":
          return (
            <CheckCircleOutlineIcon
              color="success"
              sx={{ fontSize: 18 }}
              aria-label="Name is valid"
            />
          );
        case "invalid":
        case "error":
          return (
            <ErrorOutlineIcon
              color="error"
              sx={{ fontSize: 18 }}
              aria-label="Name is invalid"
            />
          );
        default:
          return null;
      }
    };

    const mergedEndAdornment = (
      <>
        {renderValidationStatusAdornment()}
        {endAdornment}
      </>
    );

    const handleChange = (nextVal: string) => {
      if (!isControlled) {
        setInternalValue(nextVal);
      }
      onChange?.(nextVal);
    };

    return (
      <WeaverTextField
        ref={ref}
        value={currentValue}
        onChange={handleChange}
        errorMessage={effectiveError}
        helperText={helperText}
        endAdornment={mergedEndAdornment}
        disabled={disabled}
        readOnly={readOnly}
        {...restProps}
      />
    );
  }
);

WeaverNameField.displayName = "WeaverNameField";
