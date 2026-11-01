import { SidecarError } from "./errors.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  host: string;
  port: number;
  weaverBaseUrl: string;
  requestTimeoutMs: number;
  executionTimeoutMs: number;
  listMaxPages: number;
  allowedHosts: ReadonlySet<string>;
  allowedOrigins: ReadonlySet<string>;
  logLevel: LogLevel;
}

const positiveInteger = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new SidecarError(
      "INVALID_INPUT",
      `${name} must be a positive integer`,
    );
  }
  return value;
};

const csvSet = (
  raw: string | undefined,
  fallback: string[],
): ReadonlySet<string> =>
  new Set(
    (raw === undefined ? fallback : raw.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

const logLevel = (raw: string | undefined): LogLevel => {
  const value = (raw ?? "info").toLowerCase();
  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  ) {
    return value;
  }
  throw new SidecarError(
    "INVALID_INPUT",
    "LOG_LEVEL must be debug, info, warn, or error",
  );
};

export const loadConfig = (): Config => {
  const baseUrl =
    process.env.WEAVER_BASE_URL ?? "http://host.docker.internal:9090";
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new SidecarError(
      "INVALID_INPUT",
      "WEAVER_BASE_URL must be an absolute URL",
    );
  }

  if (
    parsedBaseUrl.protocol !== "http:" &&
    parsedBaseUrl.protocol !== "https:"
  ) {
    throw new SidecarError(
      "INVALID_INPUT",
      "WEAVER_BASE_URL must use http or https",
    );
  }

  return {
    host: process.env.MCP_HOST ?? "0.0.0.0",
    port: positiveInteger("MCP_PORT", 3000),
    weaverBaseUrl: parsedBaseUrl.toString().replace(/\/$/, ""),
    requestTimeoutMs: positiveInteger("WEAVER_REQUEST_TIMEOUT_MS", 10_000),
    executionTimeoutMs: positiveInteger("WEAVER_EXECUTION_TIMEOUT_MS", 130_000),
    listMaxPages: positiveInteger("WEAVER_LIST_MAX_PAGES", 100),
    allowedHosts: csvSet(process.env.MCP_ALLOWED_HOSTS, [
      "localhost",
      "127.0.0.1",
      "[::1]",
    ]),
    allowedOrigins: csvSet(process.env.MCP_ALLOWED_ORIGINS, []),
    logLevel: logLevel(process.env.LOG_LEVEL),
  };
};
