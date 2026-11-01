const listeners = new Set<any>();
const LEVEL_LABELS: any = {
  info: "INFO",
  debug: "DEBUG",
  warn: "WARN",
  error: "ERROR",
  trace: "TRACE",
};

const LEVEL_WIDTH = 5;

function formatTimestamp(ts: any) {
  const d = new Date(ts);

  const pad = (n: any, size = 2) => n.toString().padStart(size, "0");

  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const millis = pad(d.getMilliseconds(), 3);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}`;
}

function formatLevel(level: any) {
  const label = LEVEL_LABELS[level] || level.toUpperCase();
  return `[${label.padEnd(LEVEL_WIDTH, " ")}]`;
}

function formatLogLine(level: any, message: any, timestamp: any) {
  const ts = formatTimestamp(timestamp);
  const lvl = formatLevel(level);
  return `${ts} - ${lvl} - ${message}`;
}

export function log(level: any, message: any) {
  const timestamp = Date.now();
  const formatted = formatLogLine(level, message, timestamp);

  const entry = {
    level,
    message,
    timestamp,
    formatted,
  };

  listeners.forEach((fn) => fn(entry));
}

export function logInfo(message: any) {
  log("info", message);
}

export function logDebug(message: any) {
  log("debug", message);
}

export function logWarn(message: any) {
  log("warn", message);
}

export function logError(message: any) {
  log("error", message);
}

export function subscribeLogs(listener: any) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

