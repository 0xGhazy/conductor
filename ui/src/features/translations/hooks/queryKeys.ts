/** React Query keys for the translations feature. Invalidate `translationKeys.all` after mutations. */
export const translationKeys = {
  all: ["translations"] as const,
  lists: () => [...translationKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...translationKeys.lists(), params] as const,
};
