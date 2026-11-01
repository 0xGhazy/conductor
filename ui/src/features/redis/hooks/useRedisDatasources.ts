import { useQuery } from "@tanstack/react-query";
import {
  fetchRedisDatasourceById,
  fetchRedisDatasources,
} from "@/features/redis/services/redisDatasourcesApi";
import { redisDatasourceKeys } from "@/features/redis/hooks/queryKeys";

const NO_PARAMS: Record<string, unknown> = {};

/** All Redis datasources (raw API response; the endpoint is not paged). */
export const useRedisDatasourcesList = () =>
  useQuery({
    queryKey: redisDatasourceKeys.list(NO_PARAMS),
    queryFn: () => fetchRedisDatasources(),
  });

/** Single Redis datasource by id (raw API response). */
export const useRedisDatasource = (id: string | undefined, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: redisDatasourceKeys.detail(String(id ?? "")),
    queryFn: () => fetchRedisDatasourceById(String(id)),
    enabled: (options.enabled ?? true) && Boolean(id),
  });
