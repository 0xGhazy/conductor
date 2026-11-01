/** React Query keys for the queries feature. Invalidate `queryDefinitionKeys.all` after mutations. */
export const queryDefinitionKeys = {
  all: ["queries"] as const,
  lists: () => [...queryDefinitionKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...queryDefinitionKeys.lists(), params] as const,
  byDatasource: (datasourceId: string) => [...queryDefinitionKeys.all, "byDatasource", datasourceId] as const,
  details: () => [...queryDefinitionKeys.all, "detail"] as const,
  detail: (id: string) => [...queryDefinitionKeys.details(), id] as const,
};
