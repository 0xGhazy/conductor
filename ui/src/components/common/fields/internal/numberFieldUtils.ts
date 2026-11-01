/**
 * Number field parsing, formatting, clamping, and validation utilities.
 * Pure TypeScript functions independent of UI framework.
 */

export interface NumberFormatOptions {
  thousandSeparator?: boolean | string;
  precision?: number;
}

export interface NumberParseOptions {
  thousandSeparator?: boolean | string;
  allowDecimal?: boolean;
  allowNegative?: boolean;
}

export interface NumberValidationOptions {
  min?: number;
  max?: number;
  precision?: number;
  allowNegative?: boolean;
  allowDecimal?: boolean;
  allowEmpty?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Strips formatting characters (thousands separators, spaces) from user input
 */
export function sanitizeNumberString(
  input: string,
  options: NumberParseOptions = {}
): string {
  if (!input) return "";

  const separator =
    typeof options.thousandSeparator === "string"
      ? options.thousandSeparator
      : options.thousandSeparator
      ? ","
      : "";

  let cleaned = input.trim();

  // Strip thousand separator if present
  if (separator) {
    const escaped = separator.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(escaped, "g"), "");
  }

  // If thousandSeparator was boolean true, also handle common comma/space variations
  if (options.thousandSeparator === true) {
    cleaned = cleaned.replace(/,/g, "");
  }

  return cleaned;
}

/**
 * Parses user input string into a number, tracking whether it is an intermediate typing state
 */
export function parseNumberInput(
  input: string,
  options: NumberParseOptions = {}
): {
  numberValue: number | null;
  isIntermediate: boolean;
  rawCleaned: string;
} {
  const cleaned = sanitizeNumberString(input, options);

  if (!cleaned) {
    return { numberValue: null, isIntermediate: false, rawCleaned: "" };
  }

  // Intermediate states: single minus sign or trailing decimal point
  const isIntermediate =
    (options.allowNegative !== false && cleaned === "-") ||
    (options.allowDecimal !== false && (cleaned.endsWith(".") || cleaned === "-."));

  if (cleaned === "-" || cleaned === "-.") {
    return { numberValue: null, isIntermediate: true, rawCleaned: cleaned };
  }

  const parsed = Number(cleaned);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return { numberValue: null, isIntermediate: false, rawCleaned: cleaned };
  }

  return { numberValue: parsed, isIntermediate, rawCleaned: cleaned };
}

/**
 * Formats a numeric value into a display string with optional thousand separator and precision
 */
export function formatNumberDisplay(
  value: number | null | undefined,
  options: NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  let formatted =
    options.precision !== undefined
      ? value.toFixed(options.precision)
      : String(value);

  // Apply thousand separator if requested
  if (options.thousandSeparator) {
    const separator =
      typeof options.thousandSeparator === "string"
        ? options.thousandSeparator
        : ",";

    const parts = formatted.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    formatted = parts.join(".");
  }

  return formatted;
}

/**
 * Validates a number against min, max, precision, negative, and decimal rules
 */
export function validateNumberInput(
  value: number | null,
  text: string,
  options: NumberValidationOptions = {}
): ValidationResult {
  const hasText = text.trim().length > 0;

  if (!hasText || value === null) {
    if (options.allowEmpty === false) {
      return { valid: false, error: "Number is required" };
    }
    return { valid: true };
  }

  if (options.allowNegative === false && value < 0) {
    return { valid: false, error: "Negative values are not allowed" };
  }

  if (options.allowDecimal === false && !Number.isInteger(value)) {
    return { valid: false, error: "Decimals are not allowed" };
  }

  if (options.min !== undefined && value < options.min) {
    return { valid: false, error: `Minimum value is ${options.min}` };
  }

  if (options.max !== undefined && value > options.max) {
    return { valid: false, error: `Maximum value is ${options.max}` };
  }

  if (options.precision !== undefined && options.allowDecimal !== false) {
    const cleaned = text.replace(/,/g, "").trim();
    const decimalPart = cleaned.split(".")[1];
    if (decimalPart && decimalPart.length > options.precision) {
      return {
        valid: false,
        error: `Maximum ${options.precision} decimal place${
          options.precision > 1 ? "s" : ""
        } allowed`,
      };
    }
  }

  return { valid: true };
}

/**
 * Clamps a number to min and max boundaries
 */
export function clampNumber(
  val: number,
  min?: number,
  max?: number
): number {
  let res = val;
  if (min !== undefined && res < min) res = min;
  if (max !== undefined && res > max) res = max;
  return res;
}

/**
 * Computes the stepped value avoiding floating-point precision inaccuracies
 */
export function stepNumber(
  current: number | null,
  direction: 1 | -1,
  options: {
    step?: number;
    min?: number;
    max?: number;
    precision?: number;
    allowNegative?: boolean;
  } = {}
): number {
  const step = options.step ?? 1;
  const base = current ?? (options.min !== undefined ? options.min : 0);
  let next = base + direction * step;

  // Handle precision rounding
  const precision = options.precision ?? getDecimalPlaces(step);
  if (precision > 0) {
    next = parseFloat(next.toFixed(precision));
  } else {
    next = Math.round(next);
  }

  if (options.allowNegative === false && next < 0) {
    next = 0;
  }

  return clampNumber(next, options.min, options.max);
}

function getDecimalPlaces(num: number): number {
  const match = String(num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return 0;
  return Math.max(
    0,
    (match[1] ? match[1].length : 0) - (match[2] ? +match[2] : 0)
  );
}
