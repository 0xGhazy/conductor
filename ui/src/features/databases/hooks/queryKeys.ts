/** React Query keys for the databases (datasources) feature. Invalidate `datasourceKeys.all` after mutations. */
export const datasourceKeys = {
  all: ["datasources"] as const,
  lists: () => [...datasourceKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...datasourceKeys.lists(), params] as const,
  fleetStats: () => [...datasourceKeys.all, "fleetStats"] as const,
  details: () => [...datasourceKeys.all, "detail"] as const,
  detail: (id: string) => [...datasourceKeys.details(), id] as const,
};
