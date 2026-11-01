import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginationParams } from "@/types/api";
import { fetchConnectionById, fetchConnections } from "@/features/connections/services/connectionsApi";
import { connectionKeys } from "@/features/connections/hooks/queryKeys";

/** Paged list of HTTP connections (raw API response). Keeps previous page data while fetching. */
export const useConnectionsList = (params: PaginationParams) =>
  useQuery({
    queryKey: connectionKeys.list(params),
    queryFn: () => fetchConnections(params),
    placeholderData: keepPreviousData,
  });

/** Single HTTP connection by id (raw API response). */
export const useConnection = (id: string | undefined, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: connectionKeys.detail(String(id ?? "")),
    queryFn: () => fetchConnectionById(String(id)),
    enabled: (options.enabled ?? true) && Boolean(id),
  });
