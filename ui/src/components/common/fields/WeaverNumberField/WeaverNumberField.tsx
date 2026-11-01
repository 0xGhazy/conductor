import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type WheelEvent,
} from "react";
import { WeaverTextField } from "../WeaverTextField";
import type { WeaverNumberFieldProps } from "./WeaverNumberField.types";
import {
  parseNumberInput,
  formatNumberDisplay,
  validateNumberInput,
  clampNumber,
  stepNumber,
} from "../internal/numberFieldUtils";
import styles from "./WeaverNumberField.module.css";

export const WeaverNumberField = forwardRef<
  HTMLInputElement,
  WeaverNumberFieldProps
>(
  (
    {
      // Value & Change
      value: controlledValue,
      defaultValue,
      onChange,

      // Constraints & Formatting
      min,
      max,
      step = 1,
      precision,
      allowNegative = true,
      allowDecimal = true,
      thousandSeparator = false,
      allowEmpty = true,
      preventWheelChange = true,
      clampOnBlur = false,
      onValidityChange,

      // Adornments
      prefix,
      suffix,
      showControls = false,

      // Base props & overrides
      errorMessage,
      helperText,
      disabled = false,
      readOnly = false,
      startAdornment,
      endAdornment,
      onBlur,
      onKeyDown,
      onWheel,
      ...restProps
    },
    ref
  ) => {
    const isControlled = controlledValue !== undefined;

    // Track internal numeric value
    const [internalValue, setInternalValue] = useState<number | null>(
      controlledValue ?? defaultValue ?? null
    );

    const effectiveValue = isControlled
      ? controlledValue ?? null
      : internalValue;

    // Track string in the input field to support intermediate typing states (e.g. "12." or "-")
    const [displayString, setDisplayString] = useState<string>(() =>
      formatNumberDisplay(effectiveValue, {
        thousandSeparator,
        precision,
      })
    );

    const isFocusedRef = useRef(false);

    // Sync input string when controlled value changes externally while NOT focused
    useEffect(() => {
      if (isControlled && !isFocusedRef.current) {
        setDisplayString(
          formatNumberDisplay(controlledValue, {
            thousandSeparator,
            precision,
          })
        );
      }
    }, [isControlled, controlledValue, thousandSeparator, precision]);

    // Validate current input state
    const validation = validateNumberInput(effectiveValue, displayString, {
      min,
      max,
      precision,
      allowNegative,
      allowDecimal,
      allowEmpty,
    });

    const prevValidRef = useRef<boolean>(validation.valid);
    useEffect(() => {
      if (prevValidRef.current !== validation.valid) {
        prevValidRef.current = validation.valid;
        onValidityChange?.(validation.valid);
      }
    }, [validation.valid, onValidityChange]);

    // Error precedence: external errorMessage > local numeric validation error > helperText
    const effectiveError = errorMessage || validation.error;

    // Input change handler
    const handleChange = (rawInput: string) => {
      setDisplayString(rawInput);

      const parsed = parseNumberInput(rawInput, {
        thousandSeparator,
        allowDecimal,
        allowNegative,
      });

      if (!isControlled) {
        setInternalValue(parsed.numberValue);
      }

      // Emit numeric value (or null if empty/intermediate)
      onChange?.(parsed.numberValue);
    };

    // Step calculation handler (used by stepper buttons and ArrowUp/Down)
    const handleStep = (direction: 1 | -1) => {
      if (disabled || readOnly) return;

      const next = stepNumber(effectiveValue, direction, {
        step,
        min,
        max,
        precision,
        allowNegative,
      });

      if (!isControlled) {
        setInternalValue(next);
      }

      setDisplayString(
        formatNumberDisplay(next, {
          thousandSeparator,
          precision,
        })
      );

      onChange?.(next);
    };

    // Blur handler: formats string and optionally clamps to min/max
    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;

      let currentVal = effectiveValue;

      if (clampOnBlur && currentVal !== null) {
        const clamped = clampNumber(currentVal, min, max);
        if (clamped !== currentVal) {
          currentVal = clamped;
          if (!isControlled) {
            setInternalValue(clamped);
          }
          onChange?.(clamped);
        }
      }

      // Reformat string cleanly on blur (applying precision / thousand separator)
      setDisplayString(
        formatNumberDisplay(currentVal, {
          thousandSeparator,
          precision,
        })
      );

      onBlur?.(e);
    };

    const handleFocus = () => {
      isFocusedRef.current = true;
    };

    // Keyboard navigation: ArrowUp/ArrowDown for stepper
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (!disabled && !readOnly) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          handleStep(1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          handleStep(-1);
        }
      }
      onKeyDown?.(e);
    };

    // Mouse wheel handler to prevent accidental number change on scroll
    const handleWheel = (e: WheelEvent<HTMLInputElement>) => {
      if (preventWheelChange) {
        (e.target as HTMLElement).blur();
      }
      onWheel?.(e);
    };

    // Merge start adornments with prefix
    const mergedStartAdornment = (
      <>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        {startAdornment}
      </>
    );

    // Merge end adornments with suffix and optional stepper controls
    const mergedEndAdornment = (
      <>
        {suffix && <span className={styles.suffix}>{suffix}</span>}
        {endAdornment}
        {showControls && (
          <div className={styles.controlsContainer}>
            <button
              type="button"
              className={styles.stepperButton}
              disabled={disabled || readOnly || (max !== undefined && effectiveValue !== null && effectiveValue >= max)}
              onClick={() => handleStep(1)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Increment value"
              tabIndex={-1}
            >
              <span className={styles.stepperIcon}>▲</span>
            </button>
            <button
              type="button"
              className={styles.stepperButton}
              disabled={disabled || readOnly || (min !== undefined && effectiveValue !== null && effectiveValue <= min)}
              onClick={() => handleStep(-1)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Decrement value"
              tabIndex={-1}
            >
              <span className={styles.stepperIcon}>▼</span>
            </button>
          </div>
        )}
      </>
    );

    return (
      <WeaverTextField
        ref={ref}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={displayString}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        startAdornment={prefix || startAdornment ? mergedStartAdornment : undefined}
        endAdornment={suffix || endAdornment || showControls ? mergedEndAdornment : undefined}
        errorMessage={effectiveError}
        helperText={helperText}
        disabled={disabled}
        readOnly={readOnly}
        {...restProps}
      />
    );
  }
);

WeaverNumberField.displayName = "WeaverNumberField";
