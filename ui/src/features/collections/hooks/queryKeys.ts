/** React Query keys for the API collections feature. Invalidate `collectionKeys.all` after mutations. */
export const collectionKeys = {
  all: ["collections"] as const,
  lists: () => [...collectionKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...collectionKeys.lists(), params] as const,
  details: () => [...collectionKeys.all, "detail"] as const,
  detail: (id: string) => [...collectionKeys.details(), id] as const,
  endpoints: (collectionId: string) => [...collectionKeys.all, "endpoints", collectionId] as const,
  endpoint: (collectionId: string, endpointId: string) =>
    [...collectionKeys.all, "endpoint", collectionId, endpointId] as const,
};
