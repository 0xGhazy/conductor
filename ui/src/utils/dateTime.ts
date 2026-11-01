export const exactDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const tooltipDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

/**
 * Safely parses any date value (string, number, Date) into a valid Date object or null.
 */
export const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Formats date to a human-readable exact representation (e.g., "Oct 4, 2026, 06:50 PM").
 */
export const formatExactDateTime = (
  value: unknown,
  fallback = "Not available"
): string => {
  const date = parseDate(value);
  return date ? exactDateFormatter.format(date) : fallback;
};

/**
 * Formats date suitable for tooltips with 24-hour time notation.
 */
export const formatTooltipDateTime = (
  value: unknown,
  fallback = "Not available"
): string => {
  const date = parseDate(value);
  return date ? tooltipDateFormatter.format(date) : fallback;
};

const RELATIVE_TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/**
 * Formats a date relative to now (e.g. "3 minutes ago", "in 2 hours", "yesterday").
 */
export const formatRelativeTime = (
  value: unknown,
  fallback = "Not available"
): string => {
  const date = parseDate(value);
  if (!date) return fallback;

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);

  let duration = diffSeconds;
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return fallback;
};

/**
 * Formats a date with a specific timezone in en-GB locale (dd/MM/yyyy, HH:mm:ss).
 */
export const toTimezoneDateTime = (
  value: unknown,
  timezone?: string
): string => {
  if (!value) return "";
  const date = parseDate(value);
  if (!date) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};
