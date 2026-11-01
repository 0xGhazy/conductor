/** React Query keys for the scripts feature. Invalidate `scriptKeys.all` after mutations. */
export const scriptKeys = {
  all: ["scripts"] as const,
  lists: () => [...scriptKeys.all, "list"] as const,
  list: (params: object) => [...scriptKeys.lists(), params] as const,
  details: () => [...scriptKeys.all, "detail"] as const,
  detail: (id: string) => [...scriptKeys.details(), id] as const,
};
