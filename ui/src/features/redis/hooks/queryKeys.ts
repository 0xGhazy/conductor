/** React Query keys for the redis datasources feature. Invalidate `redisDatasourceKeys.all` after mutations. */
export const redisDatasourceKeys = {
  all: ["redisDatasources"] as const,
  lists: () => [...redisDatasourceKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...redisDatasourceKeys.lists(), params] as const,
  details: () => [...redisDatasourceKeys.all, "detail"] as const,
  detail: (id: string) => [...redisDatasourceKeys.details(), id] as const,
};
