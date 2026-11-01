import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { extractList, extractTotal } from "@/utils/data";
import type { PaginationParams } from "@/types/api";
import { fetchDatasourceById, fetchDatasources } from "../services/databasesApi";
import { normalizeDatasource } from "../services/databasesService";
import type { Datasource } from "../types/databaseTypes";
import { datasourceKeys } from "./queryKeys";

export interface DatasourceListParams {
  page: number;
  size: number;
  search?: string;
}

export interface DatasourceListResult {
  items: Datasource[];
  total: number;
}

/** Paged datasource list (normalized), cached per {page,size,search}. */
export const useDatasourcesList = ({ page, size, search }: DatasourceListParams) => {
  const trimmedSearch = (search || "").trim();
  return useQuery({
    queryKey: datasourceKeys.list({ page, size, search: trimmedSearch }),
    queryFn: async (): Promise<DatasourceListResult> => {
      const params: Record<string, unknown> = { page, size, sort: "createdAt,DESC" };
      if (trimmedSearch) params.search = trimmedSearch;
      const response = await fetchDatasources(params as PaginationParams);
      const body = response?.data ?? {};
      const normalized = extractList(body).map(normalizeDatasource) as Datasource[];
      return {
        items: normalized,
        total: extractTotal(response, extractTotal(body, normalized.length)),
      };
    },
    placeholderData: keepPreviousData,
  });
};

export interface DatasourceFleetStats {
  total: number;
  active: number;
  postgres: number;
  mysql: number;
  oracle: number;
}

const FLEET_STATS_STALE_TIME = 5 * 60 * 1000;

/**
 * Fleet-wide counters for the Databases stat cards. Fetches up to 1000 records,
 * so it is cached under its own key with a long staleTime instead of refetching per visit.
 */
export const useDatasourceFleetStats = () =>
  useQuery({
    queryKey: datasourceKeys.fleetStats(),
    queryFn: async (): Promise<DatasourceFleetStats> => {
      const response = await fetchDatasources({ size: 1000 } as PaginationParams);
      const body = response?.data ?? response ?? {};
      const list = extractList<Record<string, unknown>>(body);
      const stats: DatasourceFleetStats = { total: list.length, active: 0, postgres: 0, mysql: 0, oracle: 0 };
      list.forEach((item) => {
        const status = item?.status as { status?: unknown } | string | undefined;
        const rawStatus = String(
          typeof status === "object" && status ? status.status : status || ""
        ).toUpperCase();
        if (rawStatus === "ACTIVE") stats.active++;
        const type = String(item?.type || "").toUpperCase();
        if (type.includes("POSTGRES")) stats.postgres++;
        else if (type.includes("MYSQL")) stats.mysql++;
        else if (type.includes("ORACLE")) stats.oracle++;
      });
      return stats;
    },
    staleTime: FLEET_STATS_STALE_TIME,
  });

/** Raw datasource record (API `data` payload, un-normalized) for the detail page. */
export const useDatasource = (id: string | undefined, enabled = true) =>
  useQuery({
    queryKey: datasourceKeys.detail(id || ""),
    queryFn: async () => {
      const response = await fetchDatasourceById(id as string);
      const body = response?.data ?? {};
      return ((body as { data?: unknown })?.data ?? body ?? {}) as Record<string, unknown>;
    },
    enabled: enabled && !!id,
  });
