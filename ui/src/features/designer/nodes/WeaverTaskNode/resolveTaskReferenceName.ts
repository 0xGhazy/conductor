interface TaskConfigLike {
  taskReferenceName?: unknown;
  referenceName?: unknown;
  name?: unknown;
  reference?: unknown;
}

/**
 * Picks the task reference name from a node config, checking the keys
 * different task types have historically used.
 */
export function resolveTaskReferenceName(
  config: TaskConfigLike | null | undefined,
  fallback = ""
): string {
  const value =
    config?.taskReferenceName ||
    config?.referenceName ||
    config?.name ||
    config?.reference;
  return value ? String(value) : fallback;
}
