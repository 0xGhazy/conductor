import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export type WaitMode = "DURATION" | "UNTIL";

export interface WaitActionConfig extends BaseActionConfig {
  mode?: string;
  duration?: string | number;
  until?: string;
  untilDateTime?: string;
  untilTimezone?: string;
}

export interface WaitNodeData extends WeaverActionNodeData<WaitActionConfig> {}

export interface NodePosition {
  x?: string | number;
  y?: string | number;
}

export interface WaitUntilParts {
  untilDateTime: string;
  untilTimezone: string;
}

export const TIMEZONE_OPTIONS = Array.from({ length: 27 }, (_, index) => {
  const offset = index - 12;
  const sign = offset >= 0 ? "+" : "-";
  return `GMT${sign}${String(Math.abs(offset)).padStart(2, "0")}:00`;
});

const DURATION_UNIT_PATTERN = "(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)";
const DURATION_PART_PATTERN = new RegExp(`^\\d+\\s*${DURATION_UNIT_PATTERN}$`, "i");
const UNTIL_FORMAT_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?:\s+(GMT[+-]\d{2}:\d{2}))?)?$/;

export const generateWaitReferenceName = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `wait_${suffix}`;
};

export const normalizeWaitMode = (mode?: unknown): WaitMode =>
  String(mode || "DURATION").toUpperCase() === "UNTIL" ? "UNTIL" : "DURATION";

export const normalizeDuration = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${numeric} seconds`;
  }
  return "1 minute";
};

export const isValidDuration = (value: unknown): boolean => {
  const normalized = normalizeDuration(value);
  const parts = normalized.match(new RegExp(`\\d+\\s*${DURATION_UNIT_PATTERN}`, "gi"));
  if (!parts || parts.length === 0) return false;
  const rebuilt = parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
  const candidate = normalized.replace(/\s+/g, " ").trim().toLowerCase();
  return rebuilt === candidate && parts.every((part) => DURATION_PART_PATTERN.test(part));
};

const padDatePart = (value: string | number): string => String(value).padStart(2, "0");

export const getCurrentDateTimeLocal = (): string => {
  const now = new Date();
  return [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
  ].join("-") + `T${padDatePart(now.getHours())}:${padDatePart(now.getMinutes())}`;
};

export const getCurrentTimezone = (): string => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const timezone = `GMT${sign}${padDatePart(hours)}:${padDatePart(minutes)}`;
  return TIMEZONE_OPTIONS.includes(timezone) ? timezone : "GMT+00:00";
};

export const normalizeUntilParts = (cfg: WaitActionConfig = {}): WaitUntilParts => {
  const explicitDateTime = String(cfg.untilDateTime ?? "").trim();
  const explicitTimezone = String(cfg.untilTimezone ?? "").trim();
  if (explicitDateTime || explicitTimezone) {
    return {
      untilDateTime: explicitDateTime || getCurrentDateTimeLocal(),
      untilTimezone: explicitTimezone || getCurrentTimezone(),
    };
  }

  const rawUntil = String(cfg.until ?? "").trim();
  const match = rawUntil.match(UNTIL_FORMAT_PATTERN);
  if (!match) {
    return {
      untilDateTime: getCurrentDateTimeLocal(),
      untilTimezone: getCurrentTimezone(),
    };
  }

  const date = match[1];
  const time = match[2] || "00:00";
  return {
    untilDateTime: `${date}T${time}`,
    untilTimezone: match[3] || getCurrentTimezone(),
  };
};

export const isValidWaitTimezone = (timezone: unknown): boolean =>
  TIMEZONE_OPTIONS.includes(String(timezone || "").trim());

export const formatUntil = (cfg: WaitActionConfig = {}): string => {
  const { untilDateTime, untilTimezone } = normalizeUntilParts(cfg);
  const normalizedDateTime = String(untilDateTime || "").trim();
  if (!normalizedDateTime) {
    const rawUntil = String(cfg.until ?? "").trim();
    return UNTIL_FORMAT_PATTERN.test(rawUntil) ? rawUntil : "";
  }

  const match = normalizedDateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (!match) return "";
  const timezone = isValidWaitTimezone(untilTimezone) ? untilTimezone : "GMT+00:00";
  return `${match[1]} ${match[2]} ${timezone}`;
};

export const isValidUntil = (cfg: WaitActionConfig = {}): boolean => {
  const formatted = formatUntil(cfg);
  if (!formatted) return false;
  return UNTIL_FORMAT_PATTERN.test(formatted);
};

export const buildWaitDraftData = (data?: WaitNodeData | null): WaitNodeData => {
  const existingRefName = String(
    data?.config?.name ?? data?.config?.referenceName ?? data?.config?.reference ?? ""
  ).trim();
  const referenceName = existingRefName || generateWaitReferenceName();

  return {
    ...(data ?? {}),
    name: data?.name || "Wait",
    config: {
      ...(data?.config ?? {}),
      name: referenceName,
      referenceName,
      reference: referenceName,
      mode: normalizeWaitMode(data?.config?.mode),
      duration: normalizeDuration(data?.config?.duration),
      ...normalizeUntilParts(data?.config ?? {}),
      until: formatUntil(data?.config ?? {}),
    },
  };
};

export const exportWaitActionData = (
  nodeData?: WaitNodeData | null,
  nodeId?: string,
  position: NodePosition = {}
) => {
  const cfg = nodeData?.config ?? {};
  const taskReferenceName =
    String(cfg.taskReferenceName ?? cfg.referenceName ?? cfg.reference ?? cfg.name ?? "wait").trim() ||
    "wait";
  const mode = normalizeWaitMode(cfg.mode);

  return {
    name: "wait",
    taskReferenceName,
    inputParameters: {
      mode,
      duration: mode === "DURATION" ? normalizeDuration(cfg.duration) : "",
      until: mode === "UNTIL" ? formatUntil(cfg) : "",
    },
    type: "WAIT",
  };
};
