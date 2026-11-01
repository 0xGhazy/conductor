import type { WeaverEditorLanguage } from "@/components/common/editors";
import type {
  ScriptDefinition,
  ScriptDefinitionPayload,
  ScriptLanguage,
  ScriptLanguageOption,
  VariablesMap,
} from "@/features/scripts/types/scriptTypes";

export const DEFAULT_SCRIPT_LANGUAGE: ScriptLanguage = "JEXL";
export const DEFAULT_SCRIPT_TIMEOUT_MS = 3000;

export const SCRIPT_LANGUAGE_OPTIONS: ScriptLanguageOption[] = [
  { value: "JEXL", label: "JEXL", editorLanguage: "jexl" },
  { value: "JAVA_SCRIPT", label: "JavaScript", editorLanguage: "javascript" },
  { value: "PYTHON", label: "Python", editorLanguage: "python" },
];

export const normalizeScriptLanguage = (value: unknown): ScriptLanguage => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "JAVASCRIPT" || normalized === "JS") return "JAVA_SCRIPT";
  if (normalized === "PYTHON" || normalized === "JAVA_SCRIPT" || normalized === "JEXL") {
    return normalized;
  }
  return DEFAULT_SCRIPT_LANGUAGE;
};

export const getEditorLanguage = (language: unknown): WeaverEditorLanguage =>
  SCRIPT_LANGUAGE_OPTIONS.find((option) => option.value === normalizeScriptLanguage(language))?.editorLanguage ||
  "jexl";

export const normalizeVariablesMap = (value: unknown): VariablesMap =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as VariablesMap) : {};

export const parseVariablesText = (text: string): VariablesMap | null => {
  try {
    return normalizeVariablesMap(JSON.parse(text || "{}"));
  } catch {
    return null;
  }
};

export const formatVariablesText = (variables: unknown): string =>
  JSON.stringify(normalizeVariablesMap(variables), null, 2);

export const normalizeTimeout = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SCRIPT_TIMEOUT_MS;
};

interface ScriptPayloadForm {
  name: string;
  description?: string;
  script: string;
  language: unknown;
  timeout?: unknown;
}

export const buildScriptPayload = (
  form: ScriptPayloadForm,
  variables: VariablesMap
): ScriptDefinitionPayload => ({
  name: String(form.name || "").trim(),
  description: form.description || "",
  script: form.script || "",
  language: normalizeScriptLanguage(form.language),
  variables,
  timeout: normalizeTimeout(form.timeout),
});

export const filterScripts = (scripts: ScriptDefinition[], search: string): ScriptDefinition[] => {
  const query = search.trim().toLowerCase();
  if (!query) return scripts;

  return scripts.filter((script) => {
    const name = script.name?.toLowerCase() || "";
    const description = script.description?.toLowerCase() || "";
    const language = script.language?.toLowerCase() || "";
    const variables = Object.keys(script.variables || {}).join(",").toLowerCase();
    return name.includes(query) || description.includes(query) || language.includes(query) || variables.includes(query);
  });
};
