/**
 * Task reference name pattern:
 * - Must start with a letter (a-z, A-Z)
 * - May contain letters, numbers, and underscores
 * - No spaces or special characters
 */
export const TASK_REFERENCE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const TASK_REFERENCE_NAME_ERROR_MESSAGE =
  "Reference name must start with a letter and contain only letters, numbers, and underscores (no spaces).";

/**
 * Validates whether a given task reference name is valid according to system rules:
 * Must start with a letter, contain only letters, numbers, and underscores, without spaces.
 */
export function isValidTaskReferenceName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const value = name.trim();
  if (!value) return false;
  return TASK_REFERENCE_NAME_PATTERN.test(value);
}

export function isValidJavaVariableName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const value = name.trim();
  if (!value) return false;
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}
