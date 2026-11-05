/** One audit event as returned by /api/admin/audit. */
export interface AuditEvent {
  id: string;
  /** Milliseconds since the epoch. */
  timestamp: number | null;
  actorId?: string | null;
  actorUsername?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  status: "SUCCESS" | "FAILED" | string;
  durationMs?: number | null;
  errorMessage?: string | null;
  /** Only in the single-event response. */
  details?: Record<string, unknown> | null;
  clientIp?: string | null;
  /** The resource's recorded name, when the event recorded one. */
  resourceName?: string | null;
}

/** Query parameters of GET /api/admin/audit; see AuditLogResource. */
export interface AuditEventFilters {
  /** Part of the action, actor, resource name or error; start of a resource id; exact event id or IP. */
  search?: string;
  /** Any of these (OR). */
  resourceType?: string[];
  status?: string[];
  action?: string[];
  /** Exact Keycloak user id. */
  actorId?: string;
  /** Part of the actor's username, name or email. */
  actor?: string;
  /** Exact resource id. */
  resourceId?: string;
  /** Exact event id. */
  eventId?: string;
  /** Exact client IP. */
  clientIp?: string;
  minDurationMs?: string;
  maxDurationMs?: string;
  /** ISO-8601 time. */
  from?: string;
  to?: string;
  /** e.g. "durationMs,asc"; newest first when absent. */
  sort?: string;
}

export interface AuditFacets {
  /** conductor.audit.enabled */
  enabled: boolean;
  /** False when events are only written to the server log. */
  readable: boolean;
  resourceTypes: string[];
  statuses: string[];
  actions: string[];
}

/** Matching events per time bucket; see GET /api/admin/audit/histogram. */
export interface AuditHistogram {
  /** Window, epoch milliseconds. */
  from: number;
  to: number;
  bucketMs: number;
  total: number;
  failed: number;
  /** Every bucket in the window, oldest first; start is epoch milliseconds. */
  buckets: Array<{ start: number; total: number; failed: number }>;
}

export interface AuditEventPage {
  items: AuditEvent[];
  total: number;
}
