import type { AuditEventFilters } from "@/features/settings";

/**
 * The audit log page's filter state, kept in the URL so a filtered view can be shared or
 * bookmarked. Defaults are left out of the URL.
 */

export interface AuditTimeRange {
  value: string;
  label: string;
  ms?: number;
}

export const TIME_RANGES: AuditTimeRange[] = [
  { value: "15m", label: "Last 15 minutes", ms: 15 * 60_000 },
  { value: "1h", label: "Last hour", ms: 3_600_000 },
  { value: "24h", label: "Last 24 hours", ms: 86_400_000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 86_400_000 },
  { value: "30d", label: "Last 30 days", ms: 30 * 86_400_000 },
  { value: "custom", label: "Custom range" },
];

export const DEFAULT_RANGE = "24h";
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

/** Table columns the server can sort by, and the name it knows each by. */
export const SORTABLE: Record<string, string> = {
  timestamp: "timestamp",
  durationMs: "durationMs",
  status: "status",
  actor: "actor",
  action: "action",
  /** The Event column sorts by the recorded action. */
  event: "action",
  resource: "resourceType",
};

export interface AuditSort {
  field: string;
  direction: "asc" | "desc";
}

/** The "Filters" panel: exact identifiers, the actor text and the duration range. */
export interface AdvancedFilters {
  actor: string;
  resourceId: string;
  eventId: string;
  clientIp: string;
  minDurationMs: string;
  maxDurationMs: string;
}

export const EMPTY_ADVANCED: AdvancedFilters = {
  actor: "",
  resourceId: "",
  eventId: "",
  clientIp: "",
  minDurationMs: "",
  maxDurationMs: "",
};

export interface AuditLogState extends AdvancedFilters {
  search: string;
  range: string;
  /** Custom range only; ISO-8601. */
  from: string;
  to: string;
  statuses: string[];
  resourceTypes: string[];
  actions: string[];
  /** Set from the event panel: everything by one actor. */
  actorId: string;
  actorLabel: string;
  /** Label for a resource id set from the event panel (its name). */
  resourceLabel: string;
  sort: AuditSort | null;
  page: number;
  size: number;
}

const list = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const text = (params: URLSearchParams, key: string) => params.get(key)?.trim() ?? "";

const nonNegativeInt = (value: string | null, fallback: number) => {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number >= 0 ? number : fallback;
};

export function parseAuditLogState(params: URLSearchParams): AuditLogState {
  const range = TIME_RANGES.some((r) => r.value === params.get("range")) ? String(params.get("range")) : DEFAULT_RANGE;
  const [sortField, sortDirection] = (params.get("sort") ?? "").split(",");
  const size = nonNegativeInt(params.get("size"), DEFAULT_PAGE_SIZE);
  return {
    search: params.get("search") ?? "",
    range,
    from: range === "custom" ? text(params, "from") : "",
    to: range === "custom" ? text(params, "to") : "",
    statuses: list(params.get("status")),
    resourceTypes: list(params.get("resourceType")),
    actions: list(params.get("action")),
    actorId: text(params, "actorId"),
    actorLabel: text(params, "actorLabel"),
    resourceLabel: text(params, "resourceLabel"),
    actor: text(params, "actor"),
    resourceId: text(params, "resourceId"),
    eventId: text(params, "eventId"),
    clientIp: text(params, "clientIp"),
    minDurationMs: text(params, "minDurationMs"),
    maxDurationMs: text(params, "maxDurationMs"),
    sort:
      SORTABLE[sortField] !== undefined
        ? { field: sortField, direction: sortDirection === "asc" ? "asc" : "desc" }
        : null,
    page: nonNegativeInt(params.get("page"), 0),
    size: PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

export function toSearchParams(state: AuditLogState): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | null | undefined, skip?: string | number) => {
    if (value === null || value === undefined || value === "" || value === skip) return;
    params.set(key, String(value));
  };
  set("search", state.search.trim() ? state.search : "");
  set("range", state.range, DEFAULT_RANGE);
  if (state.range === "custom") {
    set("from", state.from);
    set("to", state.to);
  }
  set("status", state.statuses.join(","));
  set("resourceType", state.resourceTypes.join(","));
  set("action", state.actions.join(","));
  set("actorId", state.actorId);
  set("actorLabel", state.actorId ? state.actorLabel : "");
  set("resourceId", state.resourceId);
  set("resourceLabel", state.resourceId ? state.resourceLabel : "");
  set("actor", state.actor);
  set("eventId", state.eventId);
  set("clientIp", state.clientIp);
  set("minDurationMs", state.minDurationMs);
  set("maxDurationMs", state.maxDurationMs);
  if (state.sort) set("sort", `${state.sort.field},${state.sort.direction}`);
  set("page", state.page, 0);
  set("size", state.size, DEFAULT_PAGE_SIZE);
  return params;
}

/**
 * The API filters. A relative range is fixed at `anchor` (when it was picked or last refreshed),
 * so events logged meanwhile don't shift the pages being read; Refresh moves the anchor.
 */
export function toApiFilters(state: AuditLogState, anchor: number): AuditEventFilters {
  const range = TIME_RANGES.find((r) => r.value === state.range);
  const relative = range?.ms !== undefined;
  return {
    search: state.search.trim() || undefined,
    resourceType: state.resourceTypes.length ? state.resourceTypes : undefined,
    status: state.statuses.length ? state.statuses : undefined,
    action: state.actions.length ? state.actions : undefined,
    actorId: state.actorId || undefined,
    actor: state.actor || undefined,
    resourceId: state.resourceId || undefined,
    eventId: state.eventId || undefined,
    clientIp: state.clientIp || undefined,
    minDurationMs: state.minDurationMs || undefined,
    maxDurationMs: state.maxDurationMs || undefined,
    from: relative ? new Date(anchor - (range?.ms ?? 0)).toISOString() : state.from || undefined,
    to: relative ? new Date(anchor).toISOString() : state.to || undefined,
    sort: state.sort ? `${SORTABLE[state.sort.field]},${state.sort.direction}` : undefined,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]{2,39}(:(\d{1,3}\.){3}\d{1,3})?$/i;

const isIp = (value: string) =>
  (IPV4.test(value) && value.split(".").every((part) => Number(part) <= 255)) ||
  (value.includes(":") && IPV6.test(value));

const isDuration = (value: string) => /^\d+$/.test(value);

/** Field errors for the Filters panel; an empty object means it can be applied. */
export function validateAdvanced(values: AdvancedFilters): Partial<Record<keyof AdvancedFilters, string>> {
  const errors: Partial<Record<keyof AdvancedFilters, string>> = {};
  const v = (key: keyof AdvancedFilters) => values[key].trim();
  if (v("eventId") && !UUID.test(v("eventId"))) errors.eventId = "An event ID looks like 6f1c2a7e-0d2b-4b8e-…";
  if (v("clientIp") && !isIp(v("clientIp"))) errors.clientIp = "Enter an IPv4 or IPv6 address.";
  if (v("minDurationMs") && !isDuration(v("minDurationMs"))) errors.minDurationMs = "Enter 0 or more.";
  if (v("maxDurationMs") && !isDuration(v("maxDurationMs"))) errors.maxDurationMs = "Enter 0 or more.";
  if (
    !errors.minDurationMs &&
    !errors.maxDurationMs &&
    v("minDurationMs") &&
    v("maxDurationMs") &&
    Number(v("maxDurationMs")) < Number(v("minDurationMs"))
  ) {
    errors.maxDurationMs = "Must be at least the minimum.";
  }
  if (v("resourceId").length > 255) errors.resourceId = "At most 255 characters.";
  if (v("actor").length > 255) errors.actor = "At most 255 characters.";
  return errors;
}

/** Error for a custom range, or null when it is complete and valid. */
export function customRangeError(from: string, to: string): string | null {
  if (!from || !to) return "Choose a start and an end.";
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return "Choose a valid start and end.";
  if (end <= start) return "The end must be after the start.";
  return null;
}

/** How many filters beyond the time range are set (for the Filters button and Reset). */
export function activeFilterCount(state: AuditLogState): number {
  return (
    (state.search.trim() ? 1 : 0) +
    (state.statuses.length ? 1 : 0) +
    (state.resourceTypes.length ? 1 : 0) +
    (state.actions.length ? 1 : 0) +
    advancedCount(state) +
    (state.actorId ? 1 : 0)
  );
}

export const advancedCount = (state: AdvancedFilters) =>
  (Object.keys(EMPTY_ADVANCED) as Array<keyof AdvancedFilters>).filter((key) => state[key].trim()).length;

export const pickAdvanced = (state: AdvancedFilters): AdvancedFilters => ({
  actor: state.actor,
  resourceId: state.resourceId,
  eventId: state.eventId,
  clientIp: state.clientIp,
  minDurationMs: state.minDurationMs,
  maxDurationMs: state.maxDurationMs,
});
