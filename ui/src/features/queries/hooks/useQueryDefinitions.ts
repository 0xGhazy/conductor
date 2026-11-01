import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginationParams } from "@/types/api";
import { fetchQueries, fetchQueryById } from "@/features/queries/services/queriesApi";
import { queryDefinitionKeys } from "@/features/queries/hooks/queryKeys";

/** Paged list of query definitions. Keeps the previous page visible while the next one loads. */
export function useQueryDefinitionsList(params: PaginationParams & Record<string, unknown>) {
  return useQuery({
    queryKey: queryDefinitionKeys.list(params),
    queryFn: () => fetchQueries(params),
    placeholderData: keepPreviousData,
  });
}

/** Single query definition (including its SQL). Disabled when `enabled` is false or no id. */
export function useQueryDefinition(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryDefinitionKeys.detail(String(id ?? "")),
    queryFn: () => fetchQueryById(String(id), true),
    enabled: enabled && !!id,
  });
}
