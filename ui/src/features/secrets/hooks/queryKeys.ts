/** React Query keys for the secrets feature. Invalidate `secretKeys.all` after mutations. */
export const secretKeys = {
  all: ["secrets"] as const,
  lists: () => [...secretKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...secretKeys.lists(), params] as const,
  picker: (search: string) => [...secretKeys.all, "picker", search] as const,
  details: () => [...secretKeys.all, "detail"] as const,
  detail: (id: string) => [...secretKeys.details(), id] as const,
  usages: (id: string) => [...secretKeys.all, "usages", id] as const,
};
