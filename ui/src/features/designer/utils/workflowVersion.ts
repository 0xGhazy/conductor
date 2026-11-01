/** Normalizes a workflow version string to a number when numeric (empty -> 1). */
export function resolveWorkflowVersionValue(
  workflowVersion: string | number | null | undefined
): string | number {
  const normalized = String(workflowVersion ?? "").trim();
  const parsed = Number(normalized);
  if (normalized === "") return 1;
  if (Number.isFinite(parsed)) return parsed;
  return workflowVersion as string;
}
