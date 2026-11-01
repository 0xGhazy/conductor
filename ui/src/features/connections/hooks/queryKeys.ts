/** React Query keys for the connections feature. Invalidate `connectionKeys.all` after mutations. */
export const connectionKeys = {
  all: ["connections"] as const,
  lists: () => [...connectionKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...connectionKeys.lists(), params] as const,
  details: () => [...connectionKeys.all, "detail"] as const,
  detail: (id: string) => [...connectionKeys.details(), id] as const,
};
