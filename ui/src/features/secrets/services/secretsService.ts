import { getErrorMessage } from "@/utils/error";
import type {
  SecretCreatePayload,
  SecretFormState,
  SecretUpdatePayload,
  SecretUsage,
  SecretUsageType,
} from "../types/secretTypes";

/** Same rule as the backend SecretPlaceholderParser.NAME_REGEX. */
export const SECRET_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/;
export const SECRET_DESCRIPTION_MAX = 500;
const PLACEHOLDER_ONLY_REGEX = /^\s*\$\{weaver\.secrets\.([A-Za-z][A-Za-z0-9_-]{0,99})\}\s*$/;

export const buildSecretPlaceholder = (name: string) => `\${weaver.secrets.${name}}`;

/** Returns the secret name when the whole value is a single ${weaver.secrets.<name>} reference. */
export const parseSecretPlaceholder = (value: unknown): string | null => {
  const match = typeof value === "string" ? PLACEHOLDER_ONLY_REGEX.exec(value) : null;
  return match ? match[1] : null;
};

export const buildEmptySecretForm = (): SecretFormState => ({ name: "", value: "", description: "" });

export const validateSecretForm = (
  form: SecretFormState,
  { isCreateMode, replacingValue }: { isCreateMode: boolean; replacingValue: boolean }
): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (isCreateMode) {
    const name = form.name.trim();
    if (!name) errors.name = "Name is required";
    else if (!SECRET_NAME_REGEX.test(name))
      errors.name = "Start with a letter; use only letters, digits, _ or - (max 100)";
  }
  if ((isCreateMode || replacingValue) && !form.value.trim()) {
    errors.value = isCreateMode ? "Value is required" : "Enter the new value or cancel replacing it";
  }
  if (form.description.length > SECRET_DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${SECRET_DESCRIPTION_MAX} characters`;
  }
  return errors;
};

export const buildCreatePayload = (form: SecretFormState): SecretCreatePayload => ({
  name: form.name.trim(),
  value: form.value,
  description: form.description.trim() || undefined,
});

/** The value is only sent when the user chose to replace it; otherwise the backend keeps the current one. */
export const buildUpdatePayload = (
  form: SecretFormState,
  { replacingValue, version }: { replacingValue: boolean; version?: number }
): SecretUpdatePayload => ({
  ...(replacingValue ? { value: form.value } : {}),
  description: form.description.trim(),
  version,
});

export const SECRET_USAGE_LABELS: Record<SecretUsageType, string> = {
  DATASOURCE: "Database",
  HTTP_CONNECTION: "HTTP connection",
};

export const secretUsagePath = (usage: SecretUsage): string =>
  usage.type === "DATASOURCE"
    ? `/databases/${encodeURIComponent(usage.id)}`
    : `/connections/${encodeURIComponent(usage.id)}`;

export interface SecretApiError {
  code?: string;
  message: string;
  details?: Record<string, unknown> | null;
}

/** Normalizes an axios error from /api/secrets into the backend error code plus a display message. */
export const toSecretApiError = (error: unknown, fallback: string): SecretApiError => {
  const data = (error as { response?: { data?: { code?: unknown; details?: unknown } } } | null)?.response?.data;
  return {
    code: typeof data?.code === "string" ? data.code : undefined,
    message: getErrorMessage(error, fallback),
    details: data?.details && typeof data.details === "object" ? (data.details as Record<string, unknown>) : null,
  };
};
