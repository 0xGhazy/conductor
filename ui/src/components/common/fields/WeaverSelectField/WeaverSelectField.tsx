import React, {
  useState,
  useId,
  forwardRef,
  type ReactNode,
} from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormHelperText from "@mui/material/FormHelperText";
import type {
  WeaverSelectFieldProps,
  WeaverSelectOption,
} from "./WeaverSelectField.types";
import styles from "./WeaverSelectField.module.css";

/** Stable empty value for multi-selects (avoids a new array identity every render) */
const EMPTY_ARRAY: never[] = [];

function WeaverSelectFieldInner<T = string>(
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

    // WeaverSelectField props
    options = [],
    multiple = false,
    value: controlledValue,
    defaultValue,
    onChange,
    placeholder,
    renderSelectedValue,
    showSelectedIcons = false,

    // MUI overrides & props
    id: userProvidedId,
    fullWidth = true,
    size = "small",
    variant = "outlined",
    className = "",
    sx,
    MenuProps,
    inputProps,
    renderValue: nativeRenderValue,
    ...restSelectProps
  }: WeaverSelectFieldProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const autoId = useId();
  const selectId = userProvidedId || `weaver-select-${autoId}`;
  const labelId = `${selectId}-label`;

  // Value tracking: controlled vs uncontrolled
  const isControlled = controlledValue !== undefined;
  const initialFallback = (multiple ? EMPTY_ARRAY : "") as unknown as T | T[];
  const [internalValue, setInternalValue] = useState<T | T[]>(
    controlledValue ?? defaultValue ?? initialFallback
  );

  const rawEffective = isControlled
    ? (controlledValue ?? initialFallback)
    : internalValue;

  const effectiveValue = multiple
    ? (Array.isArray(rawEffective) ? rawEffective : EMPTY_ARRAY)
    : (rawEffective ?? ("" as unknown as T));

  // Error precedence: external errorMessage takes priority over helperText
  const hasError = Boolean(errorMessage);
  const displayHelperText = hasError ? errorMessage : helperText;
  const helperTextId = displayHelperText ? `${selectId}-helper-text` : undefined;

  // Dimension handling: matches WeaverTextField exactly
  const dimensionSx = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined
      ? {
          "& .MuiInputBase-root": {
            height: typeof height === "number" ? `${height}px` : height,
            boxSizing: "border-box",
          },
        }
      : {}),
    ...sx,
  };

  const combinedClassName = [
    styles.root,
    readOnly ? styles.readOnly : "",
    direction === "rtl" ? styles.dirRtl : direction === "ltr" ? styles.dirLtr : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Change handler normalizing MUI SelectChangeEvent into clean values & options
  const handleSelectChange = (
    event: SelectChangeEvent<T | T[]>,
    child: ReactNode
  ) => {
    if (readOnly) return;

    const rawValue = event.target.value as T | T[];

    if (multiple) {
      const arrayVal = Array.isArray(rawValue) ? rawValue : [rawValue];
      const selectedOptions = options.filter((opt) => arrayVal.includes(opt.value));
      if (!isControlled) {
        setInternalValue(arrayVal);
      }
      onChange?.(arrayVal, selectedOptions);
    } else {
      const selectedOption = options.find((opt) => opt.value === rawValue);
      if (!isControlled) {
        setInternalValue(rawValue);
      }
      onChange?.(rawValue, selectedOption ? [selectedOption] : []);
    }

    restSelectProps.onChange?.(event, child);
  };

  // Selected value display renderer
  const customRenderValue = (selectedVal: T | T[]): ReactNode => {
    // 1. If consumer passed custom renderSelectedValue, resolve options and call it
    if (typeof renderSelectedValue === "function") {
      const selectedOptions = multiple
        ? options.filter((o) =>
            Array.isArray(selectedVal) ? (selectedVal as T[]).includes(o.value) : false
          )
        : options.filter((o) => o.value === selectedVal);
      return renderSelectedValue(selectedOptions);
    }

    // 2. If consumer passed native MUI renderValue, defer to it
    if (typeof nativeRenderValue === "function") {
      return nativeRenderValue(selectedVal);
    }

    // 3. Check for empty selection
    const isEmpty = multiple
      ? !Array.isArray(selectedVal) || selectedVal.length === 0
      : selectedVal === undefined || selectedVal === null || selectedVal === "";

    if (isEmpty) {
      if (placeholder) {
        return <span className={styles.placeholder}>{placeholder}</span>;
      }
      return "";
    }

    // 4. Default multiple select rendering
    if (multiple) {
      const selectedList = options.filter((o) =>
        Array.isArray(selectedVal) ? (selectedVal as T[]).includes(o.value) : false
      );
      const text = selectedList.map((o) => o.label).join(", ");
      return (
        <div className={styles.selectedContainer} title={text}>
          <span>{text}</span>
        </div>
      );
    }

    // 5. Default single select rendering
    const selectedOption = options.find((o) => o.value === selectedVal);
    return (
      <div className={styles.selectedContainer}>
        {showSelectedIcons && selectedOption?.icon && (
          <span className={styles.selectedIcon}>{selectedOption.icon}</span>
        )}
        <span>{selectedOption ? selectedOption.label : String(selectedVal)}</span>
      </div>
    );
  };

  // Merge MenuProps to disable opening when read-only and preserve consumer MenuProps
  const mergedMenuProps = {
    ...MenuProps,
    PaperProps: {
      ...MenuProps?.PaperProps,
      sx: {
        maxHeight: 320,
        ...(readOnly ? { display: "none" } : {}),
        ...MenuProps?.PaperProps?.sx,
      },
    },
    ...(readOnly ? { open: false } : {}),
  };

  return (
    <FormControl
      ref={ref}
      fullWidth={fullWidth}
      size={size}
      variant={variant}
      error={hasError}
      disabled={disabled}
      required={required}
      sx={dimensionSx}
      className={combinedClassName}
    >
      {label && (
        <InputLabel id={labelId} required={required} error={hasError}>
          {label}
        </InputLabel>
      )}

      <Select
        labelId={label ? labelId : undefined}
        id={selectId}
        label={label}
        multiple={multiple}
        value={effectiveValue}
        onChange={handleSelectChange}
        displayEmpty={Boolean(placeholder)}
        renderValue={customRenderValue}
        disabled={disabled}
        readOnly={readOnly}
        MenuProps={mergedMenuProps}
        onOpen={(event) => {
          if (readOnly) {
            return;
          }
          restSelectProps.onOpen?.(event);
        }}
        inputProps={{
          ...(helperTextId ? { "aria-describedby": helperTextId } : {}),
          ...inputProps,
          ...(readOnly ? { readOnly: true } : {}),
          ...(direction ? { dir: direction } : {}),
        }}
        {...restSelectProps}
      >
        {options.map((option) => (
          <MenuItem
            key={String(option.value)}
            value={option.value as unknown as string | number}
            disabled={option.disabled}
          >
            <div className={styles.optionRow}>
              {option.icon && (
                <span className={styles.optionIcon}>{option.icon}</span>
              )}
              <span className={styles.optionLabel}>{option.label}</span>
            </div>
          </MenuItem>
        ))}
      </Select>

      {displayHelperText && (
        <FormHelperText id={helperTextId} error={hasError}>
          {displayHelperText}
        </FormHelperText>
      )}
    </FormControl>
  );
}

export const WeaverSelectField = forwardRef(WeaverSelectFieldInner) as <T = string>(
  props: WeaverSelectFieldProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

(WeaverSelectField as unknown as { displayName?: string }).displayName =
  "WeaverSelectField";
