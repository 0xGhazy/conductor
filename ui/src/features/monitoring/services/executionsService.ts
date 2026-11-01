import type {
  ParsedTaskLogLine,
  TaskExecutionLog,
  TaskLogLevel,
  WorkflowExecutionTask,
} from "@/features/monitoring/types/executionTypes";

export const formatExecutionDateTime = (value: string | number | null | undefined): string => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

/** Elapsed seconds between two timestamps; a missing end means "still running" (now). */
export const formatExecutionElapsed = (
  startTime: string | number | null | undefined,
  endTime?: string | number | null
): string => {
  if (!startTime) return "-";
  try {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    if (isNaN(start) || isNaN(end) || end < start) return "-";
    return `${((end - start) / 1000).toFixed(1)} s`;
  } catch {
    return "-";
  }
};

export const formatDurationMs = (ms: number | null | undefined): string => {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const getExecutionStatusColor = (status: unknown): string => {
  switch (String(status).toUpperCase()) {
    case "COMPLETED":
      return "var(--color-status-success, #2C8C84)";
    case "FAILED":
    case "TERMINATED":
    case "TIMED_OUT":
      return "var(--color-status-danger, #C93136)";
    case "RUNNING":
      return "var(--color-status-running, #E5484D)";
    case "PAUSED":
      return "var(--color-status-warn, #B66A00)";
    default:
      return "var(--color-fg-muted, #667085)";
  }
};

/** Epoch milliseconds of a timestamp (number or date string); 0 when missing or invalid. */
export const toExecutionEpochMs = (value: unknown): number => {
  if (!value) return 0;
  const ms = typeof value === "number" ? value : new Date(String(value)).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/** Reference name of an executed task, without the `__N` suffix loop iterations add. */
export const getExecutionTaskReferenceName = (task: WorkflowExecutionTask): string =>
  String(task?.referenceTaskName || task?.taskReferenceName || "").replace(/__\d+$/, "");

/**
 * Indexes executed tasks by reference name. Retries and loop iterations share a reference
 * name, so the latest attempt (by sequence, then start time) represents the task.
 */
export const indexExecutionTasksByReference = (
  tasks: WorkflowExecutionTask[] = []
): Map<string, WorkflowExecutionTask> => {
  const index = new Map<string, WorkflowExecutionTask>();
  tasks.forEach((task) => {
    const refName = getExecutionTaskReferenceName(task);
    if (!refName) return;
    const current = index.get(refName);
    const isLater =
      !current ||
      Number(task.seq ?? 0) > Number(current.seq ?? 0) ||
      (Number(task.seq ?? 0) === Number(current.seq ?? 0) && toExecutionEpochMs(task.startTime) >= toExecutionEpochMs(current.startTime));
    if (isLater) index.set(refName, task);
  });
  return index;
};

/** Duration of an executed task in ms, or undefined when it has not finished. */
export const getExecutionTaskDurationMs = (task: WorkflowExecutionTask): number | undefined => {
  const start = toExecutionEpochMs(task?.startTime);
  const end = toExecutionEpochMs(task?.endTime);
  return start && end && end >= start ? end - start : undefined;
};

/** Pretty-prints task input/output params that may arrive as objects or JSON strings. */
export const formatExecutionParams = (params: unknown): string => {
  if (params == null) return "{}";
  if (typeof params === "object") return JSON.stringify(params, null, 2);
  const str = String(params).trim();
  if (str.startsWith("{") && str.endsWith("}")) {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }
  return str;
};

/** Full date and time with milliseconds, e.g. "Oct 20, 2026, 14:05:09.123". */
export const formatExecutionTimestamp = (value: unknown): string => {
  const ms = toExecutionEpochMs(value);
  if (!ms) return "—";
  const date = new Date(ms);
  const dateTime = date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${dateTime}.${String(date.getMilliseconds()).padStart(3, "0")}`;
};

/**
 * Formats a timestamp in ISO format with comma for milliseconds:
 * `YYYY-MM-DDTHH:mm:ss,SSS` (e.g. `2026-10-20T23:16:28,947`).
 */
export const formatLogTimestampIso = (value: unknown): string => {
  const ms = toExecutionEpochMs(value);
  if (!ms) return "—";
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const millis = String(d.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds},${millis}`;
};

/**
 * Formats a log level token padded to 5 characters in brackets:
 * `[INFO ]`, `[WARN ]`, `[ERROR]`, `[DEBUG]`, `[TRACE]`.
 */
export const formatLogLevelToken = (level: TaskLogLevel | string): string => {
  const upper = String(level || "INFO").toUpperCase();
  const padded = upper.padEnd(5, " ");
  return `[${padded}]`;
};

/**
 * Formats a complete log line in the standard Weaver log pattern:
 * `2026-10-20T23:16:28,947 [INFO ] weaver.action.<TaskName> (taskReferenceName) - <message>`
 */
export const formatExecutionLogLine = (item: ParsedTaskLogLine): string => {
  const time = formatLogTimestampIso(item.timestamp);
  const level = formatLogLevelToken(item.level);
  const taskName =
    typeof item.taskName === "string" && item.taskName
      ? item.taskName
      : typeof item.taskType === "string" && item.taskType
      ? item.taskType
      : "Task";
  const ref =
    typeof item.taskReferenceName === "string" && item.taskReferenceName
      ? item.taskReferenceName
      : typeof item.taskId === "string" && item.taskId
      ? item.taskId
      : "task";
  const message = typeof item.message === "string" ? item.message : JSON.stringify(item.message);
  return `${time} ${level} weaver.action.${taskName} (${ref}) - ${message}`;
};

const WEAVER_LOG_LINE =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[,\.]\d{3})?)\s+\[(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|SEVERE)\s*\]\s+weaver\.action\.([\w.-]+)\s+\(([^)]+)\)\s+-\s+(.*)$/i;
const LOG_LEVEL_PREFIX = /^\s*[[(]?\s*(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|SEVERE)\b\s*[\])]?\s*(?:::|[:|-])?\s*/i;
const LOG_LEVEL_ALIASES: Record<string, TaskLogLevel> = { WARNING: "WARN", FATAL: "ERROR", SEVERE: "ERROR" };
const LOOKS_LIKE_ERROR = /exception|\berror\b|^\s*at\s+[\w.$]+\(/i;

/**
 * Task logs are stored as plain text or structured prefix (e.g. "error::Worker input is missing").
 * The level comes from a leading level token when present; otherwise exception-looking lines
 * are errors and the rest are info.
 */
export const parseTaskLogLine = (
  entry: TaskExecutionLog,
  taskReferenceName?: string,
  taskName?: string,
  taskType?: string
): ParsedTaskLogLine => {
  const safeRef = typeof taskReferenceName === "string" ? taskReferenceName : undefined;
  const safeName = typeof taskName === "string" ? taskName : undefined;
  const safeType = typeof taskType === "string" ? taskType : undefined;

  const raw =
    typeof entry?.log === "string"
      ? entry.log
      : entry?.log != null
      ? typeof entry.log === "object"
        ? JSON.stringify(entry.log)
        : String(entry.log)
      : "";
  const taskId = typeof entry?.taskId === "string" ? entry.taskId : undefined;

  // 0. Check if raw line already matches the Weaver standard log line pattern
  const weaverMatch = raw.match(WEAVER_LOG_LINE);
  if (weaverMatch) {
    const rawTime = weaverMatch[1].replace(",", ".");
    const timeMs = new Date(rawTime).getTime();
    const token = weaverMatch[2].toUpperCase();
    return {
      taskId,
      taskReferenceName: weaverMatch[4] || safeRef,
      taskName: weaverMatch[3] || safeName || safeType,
      taskType: safeType || weaverMatch[3],
      level: LOG_LEVEL_ALIASES[token] ?? (token as TaskLogLevel),
      message: weaverMatch[5].trim(),
      timestamp: !Number.isNaN(timeMs) ? timeMs : entry?.createdTime,
    };
  }

  // 1. Check double-colon pattern first: e.g. "error::Message" or "info::Message"
  const dblColonIdx = raw.indexOf("::");
  if (dblColonIdx !== -1) {
    const prefix = raw.substring(0, dblColonIdx).trim().toUpperCase();
    const recognized = LOG_LEVEL_ALIASES[prefix] ?? (prefix as TaskLogLevel);
    if (["ERROR", "WARN", "INFO", "DEBUG", "TRACE"].includes(recognized)) {
      return {
        taskId,
        taskReferenceName: safeRef,
        taskName: safeName || safeType,
        taskType: safeType,
        level: recognized,
        message: raw.substring(dblColonIdx + 2).trim(),
        timestamp: entry?.createdTime,
      };
    }
  }

  // 2. Check standard level prefix: "[WARN] message", "ERROR: message", etc.
  const match = raw.match(LOG_LEVEL_PREFIX);
  if (match) {
    const token = match[1].toUpperCase();
    return {
      taskId,
      taskReferenceName: safeRef,
      taskName: safeName || safeType,
      taskType: safeType,
      level: LOG_LEVEL_ALIASES[token] ?? (token as TaskLogLevel),
      message: raw.slice(match[0].length).trim(),
      timestamp: entry?.createdTime,
    };
  }

  return {
    taskId,
    taskReferenceName: safeRef,
    taskName: safeName || safeType,
    taskType: safeType,
    level: LOOKS_LIKE_ERROR.test(raw) ? "ERROR" : "INFO",
    message: raw.trim(),
    timestamp: entry?.createdTime,
  };
};
