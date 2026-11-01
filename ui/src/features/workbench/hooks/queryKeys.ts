/** React Query keys for the workbench feature. */
export const workbenchKeys = {
  all: ["workbench"] as const,
  workflows: () => [...workbenchKeys.all, "workflows"] as const,
};
