export const DEFAULT_SCRIPT_LANGUAGE = "JEXL";
export const DEFAULT_SCRIPT_TIMEOUT_MS = 30000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export type ScriptLanguage = "PYTHON" | "JAVASCRIPT" | "JEXL";
export type ScriptingEngineLanguage = "PYTHON" | "JAVA_SCRIPT" | "JEXL";
export type VariablesMap = Record<string, unknown>;

export interface ScriptActionConfig extends Record<string, unknown> {
  id?: string | null;
  name?: string | null;
  reference?: string | null;
  referenceName?: string | null;
  taskReferenceName?: string | null;
  expression?: string | null;
  variables?: unknown;
  language?: string | null;
  scriptLanguage?: string | null;
  timeout?: number | string | null;
  timeoutMs?: number | string | null;
  timeoutMilliseconds?: number | string | null;
  timeoutSeconds?: number | string | null;
}

export interface ScriptNodeData {
  id?: string | null;
  name?: string | null;
  config?: ScriptActionConfig | null;
}

export interface ScriptDtoPayload {
  id: string;
  name: string;
  reference: string;
  script: string;
  variables: VariablesMap;
  language: ScriptingEngineLanguage;
  timeout: number;
}

interface BuildScriptDtoPayloadOptions {
  defaultName?: string;
}

export const normalizeScriptLanguage = (value: unknown): ScriptLanguage => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

  if (normalized === "PYTHON" || normalized === "PYTHON3") return "PYTHON";
  if (normalized === "JS" || normalized === "JAVASCRIPT") return "JAVASCRIPT";
  if (normalized === "JAVA" || normalized === "JEXL") return "JEXL";
  return DEFAULT_SCRIPT_LANGUAGE;
};

export const toScriptingEngineLanguage = (value: unknown): ScriptingEngineLanguage => {
  const language = normalizeScriptLanguage(value);
  if (language === "PYTHON") return "PYTHON";
  if (language === "JAVASCRIPT") return "JAVA_SCRIPT";
  return "JEXL";
};

export const normalizeScriptTimeoutMs = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SCRIPT_TIMEOUT_MS;
};

export const resolveScriptTimeoutMs = (cfg: ScriptActionConfig = {}): number => {
  if (cfg.timeout != null && cfg.timeout !== "") {
    return normalizeScriptTimeoutMs(cfg.timeout);
  }

  if (cfg.timeoutMs != null && cfg.timeoutMs !== "") {
    return normalizeScriptTimeoutMs(cfg.timeoutMs);
  }

  if (cfg.timeoutMilliseconds != null && cfg.timeoutMilliseconds !== "") {
    return normalizeScriptTimeoutMs(cfg.timeoutMilliseconds);
  }

  if (cfg.timeoutSeconds != null && cfg.timeoutSeconds !== "") {
    return normalizeScriptTimeoutMs(Number(cfg.timeoutSeconds) * 1000);
  }

  return DEFAULT_SCRIPT_TIMEOUT_MS;
};

export const getScriptTimeoutInputValue = (cfg: ScriptActionConfig = {}): number | string => {
  if (cfg.timeout != null) return cfg.timeout;
  if (cfg.timeoutMs != null) return cfg.timeoutMs;
  if (cfg.timeoutMilliseconds != null) return cfg.timeoutMilliseconds;
  if (cfg.timeoutSeconds === "") return "";
  if (cfg.timeoutSeconds != null) {
    const parsed = Number(cfg.timeoutSeconds);
    return Number.isFinite(parsed) ? parsed * 1000 : cfg.timeoutSeconds;
  }
  return DEFAULT_SCRIPT_TIMEOUT_MS;
};

export const normalizeVariablesMap = (value: unknown): VariablesMap =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as VariablesMap) : {};

export const parseVariablesMap = (value: unknown, fallback: VariablesMap = {}): VariablesMap => {
  if (value == null || value === "") return fallback;
  if (typeof value === "object" && !Array.isArray(value)) return value as VariablesMap;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return normalizeVariablesMap(parsed);
  } catch {
    return fallback;
  }
};

export const getStableUuid = (seed: string): string => {
  if (!seed) return "00000000-0000-4000-8000-000000000000";

  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash1 = (hash1 << 5) - hash1 + char;
    hash1 = hash1 & hash1;

    hash2 = (hash2 << 7) - hash2 + char;
    hash2 = hash2 & hash2;
  }

  const h1 = Math.abs(hash1).toString(16).padStart(8, "0");
  const h2 = Math.abs(hash2).toString(16).padStart(8, "0");

  const rawHex = (h1 + h2 + h1 + h2).slice(0, 32);

  const part1 = rawHex.slice(0, 8);
  const part2 = rawHex.slice(8, 12);
  const part3 = "4" + rawHex.slice(13, 16);
  const part4 = ((parseInt(rawHex.charAt(16), 16) & 0x3) | 0x8).toString(16) + rawHex.slice(17, 20);
  const part5 = rawHex.slice(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

export const resolveScriptDtoId = (
  nodeId: string | null | undefined,
  cfg: ScriptActionConfig = {}
): string => {
  const candidate = String(cfg.id ?? cfg.scriptId ?? nodeId ?? "").trim();
  return UUID_PATTERN.test(candidate) ? candidate : getStableUuid(candidate);
};

export const buildScriptDtoPayload = (
  nodeId: string | null | undefined,
  nodeData: ScriptNodeData | null | undefined,
  { defaultName = "Script" }: BuildScriptDtoPayloadOptions = {}
): ScriptDtoPayload => {
  const cfg = nodeData?.config ?? {};
  return {
    id: resolveScriptDtoId(nodeId, cfg),
    name: String(nodeData?.name || defaultName).trim(),
    reference: String(
      cfg.name ??
      cfg.referenceName ??
      cfg.reference ??
      cfg.taskReferenceName ??
      ""
    ).trim(),
    script: String(cfg.expression ?? ""),
    variables: parseVariablesMap(cfg.variables, {}),
    language: toScriptingEngineLanguage(cfg.language ?? cfg.scriptLanguage),
    timeout: resolveScriptTimeoutMs(cfg),
  };
};
