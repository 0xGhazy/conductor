import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type {
  AuditEvent,
  AuditEventFilters,
  AuditEventPage,
  AuditFacets,
  AuditHistogram,
} from "../types/auditLogTypes";

export const AUDIT_API = `${config.apiBaseUrl}/api/admin/audit`;

interface Envelope<T> {
  data?: T;
  details?: { totalElements?: number };
}

/** Drops empty values; lists go as one comma-separated value, which the server splits. */
const toParams = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : value] as const)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

/** One page of audit events; `signal` cancels it when a newer request replaces it. */
export const fetchAuditEvents = async (
  filters: AuditEventFilters,
  page: number,
  size: number,
  signal?: AbortSignal
): Promise<AuditEventPage> => {
  const res = await apiClient.get<Envelope<AuditEvent[]>>(AUDIT_API, {
    params: toParams({ ...filters, page, size }),
    signal,
  });
  return {
    items: Array.isArray(res.data?.data) ? res.data.data : [],
    total: Number(res.data?.details?.totalElements ?? 0),
  };
};

/** Events per time bucket for the same filters (the sort does not apply). */
export const fetchAuditHistogram = async (
  filters: AuditEventFilters,
  signal?: AbortSignal
): Promise<AuditHistogram> => {
  const { sort: _sort, ...rest } = filters;
  const res = await apiClient.get<Envelope<AuditHistogram>>(`${AUDIT_API}/histogram`, {
    params: toParams(rest),
    signal,
  });
  const data = res.data?.data;
  if (!data) throw new Error("No activity was returned.");
  return { ...data, buckets: Array.isArray(data.buckets) ? data.buckets : [] };
};

/** One event, including its details. */
export const fetchAuditEvent = async (id: string): Promise<AuditEvent> => {
  const res = await apiClient.get<Envelope<AuditEvent>>(`${AUDIT_API}/${encodeURIComponent(id)}`);
  if (!res.data?.data) throw new Error("Audit event not found.");
  return res.data.data;
};

/** Filter values and whether the log is recorded and readable. */
export const fetchAuditFacets = async (): Promise<AuditFacets> => {
  const res = await apiClient.get<Envelope<AuditFacets>>(`${AUDIT_API}/facets`);
  const data = res.data?.data;
  return {
    enabled: data?.enabled ?? true,
    readable: data?.readable ?? false,
    resourceTypes: data?.resourceTypes ?? [],
    statuses: data?.statuses ?? [],
    actions: data?.actions ?? [],
  };
};
