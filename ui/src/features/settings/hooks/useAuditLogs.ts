import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchAuditEvent,
  fetchAuditEvents,
  fetchAuditFacets,
  fetchAuditHistogram,
} from "../services/auditLogsApi";
import type { AuditEventFilters } from "../types/auditLogTypes";

export const auditLogKeys = {
  all: ["auditLogs"] as const,
  list: (filters: AuditEventFilters, page: number, size: number) =>
    [...auditLogKeys.all, "list", filters, page, size] as const,
  histogram: (filters: AuditEventFilters) => [...auditLogKeys.all, "histogram", filters] as const,
  detail: (id: string) => [...auditLogKeys.all, "detail", id] as const,
  facets: () => [...auditLogKeys.all, "facets"] as const,
};

/**
 * A page of audit events; keeps showing the previous page while the next one loads. Each filter
 * set has its own cache key and a superseded request is cancelled, so a slow older response
 * never replaces a newer one.
 */
export const useAuditEvents = (filters: AuditEventFilters, page: number, size: number, enabled = true) =>
  useQuery({
    queryKey: auditLogKeys.list(filters, page, size),
    queryFn: ({ signal }) => fetchAuditEvents(filters, page, size, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

/** Events over time for the same filters; keeps the previous bars while new ones load. */
export const useAuditHistogram = (filters: AuditEventFilters, enabled = true) => {
  const { sort: _sort, ...withoutSort } = filters;
  return useQuery({
    queryKey: auditLogKeys.histogram(withoutSort),
    queryFn: ({ signal }) => fetchAuditHistogram(withoutSort, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
};

export const useAuditEvent = (id: string | null) =>
  useQuery({
    queryKey: auditLogKeys.detail(id ?? ""),
    queryFn: () => fetchAuditEvent(id as string),
    enabled: Boolean(id),
  });

export const useAuditFacets = () =>
  useQuery({ queryKey: auditLogKeys.facets(), queryFn: fetchAuditFacets, staleTime: 60_000 });
