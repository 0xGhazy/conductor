import type { AuditEvent } from "@/features/settings";
import { formatExactDateTime, parseDate } from "@/utils/dateTime";

/** One recorded field change: `from` is absent for a create. */
export interface AuditChange {
  field: string;
  label: string;
  from?: unknown;
  to?: unknown;
  hasFrom: boolean;
  /** A secret: only that it was set or changed is known. */
  secret: boolean;
  /** Multi-line or long values are shown as stacked blocks. */
  long: boolean;
  /** SQL, JSON and similar are shown in the code face; prose is not. */
  code: boolean;
  /** Only names are shown (driver properties): the values changed but are never recorded. */
  valuesHidden: boolean;
}

const VERBS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  remove: "Removed",
  execute: "Ran",
  run: "Ran",
  start: "Started",
  restart: "Restarted",
  terminate: "Terminated",
  pause: "Paused",
  resume: "Resumed",
  retry: "Retried",
  rerun: "Re-ran",
  register: "Registered",
  unregister: "Unregistered",
  skip: "Skipped",
  requeue: "Requeued",
};

const WORDS: Record<string, string> = {
  sql: "SQL",
  id: "ID",
  ip: "IP",
  jdbc: "JDBC",
  url: "URL",
};

const splitWords = (identifier: string) =>
  identifier
    .replace(/[_.-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

const wordOf = (word: string) => WORDS[word] ?? word;

/** "updateQuery" → "Updated query"; "executeSql" → "Ran SQL"; "getAllPollData" → "Get all poll data". */
export function actionSentence(action: string | null | undefined): string {
  const words = splitWords(String(action || ""));
  if (!words.length) return "Event";
  const [first, ...rest] = words;
  const verb = VERBS[first];
  const text = verb
    ? [verb, ...rest.map(wordOf)]
    : [wordOf(first), ...rest.map(wordOf)];
  const sentence = text.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  sql: "SQL",
  timeout: "Timeout (ms)",
  parameters: "Parameters",
  datasourceId: "Database",
  type: "Engine",
  "connection.url": "JDBC URL",
  "connection.username": "Username",
  "connection.password": "Password",
  "connection.schema": "Schema",
  "connection.minimumIdle": "Minimum idle connections",
  "connection.maxPoolSize": "Max pool size",
  "connection.idleTimeout": "Idle timeout (ms)",
  "connection.maxLifetime": "Max lifetime (ms)",
  "connection.connectionTimeout": "Connection timeout (ms)",
  "connection.properties": "Driver properties",
};

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const words = splitWords(field.split(".").pop() || field).map(wordOf);
  const label = words.join(" ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const SECRET_FIELDS = new Set(["connection.password"]);
const CODE_FIELDS = new Set(["sql", "connection.url"]);

const isCode = (field: string, ...values: unknown[]) =>
  CODE_FIELDS.has(field) ||
  values.some(
    (value) =>
      value !== null && typeof value === "object" && !Array.isArray(value),
  );

/** Text for one value; objects become indented JSON. Empty values return "". */
export function valueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

// The server records driver properties by key name only; same keys with new values arrive
// as "sslmode, ssl (values changed)".
const VALUES_CHANGED = /\s*\(values changed\)$/;

const isLong = (value: unknown) => {
  const text = valueText(value);
  return text.includes("\n") || text.length > 48;
};

/** The field changes an event recorded, in recorded order; null when it recorded none. */
export function eventChanges(
  event: AuditEvent | undefined | null,
): AuditChange[] | null {
  const raw = event?.details?.changes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return Object.entries(raw as Record<string, unknown>).map(
    ([field, change]) => {
      const record = (
        change && typeof change === "object" ? change : {}
      ) as Record<string, unknown>;
      const hasFrom = Object.prototype.hasOwnProperty.call(record, "from");
      if (typeof record.to === "string" && VALUES_CHANGED.test(record.to)) {
        return {
          field,
          label: fieldLabel(field),
          to: record.to.replace(VALUES_CHANGED, ""),
          hasFrom,
          secret: false,
          long: false,
          code: false,
          valuesHidden: true,
        };
      }
      return {
        field,
        label: fieldLabel(field),
        from: record.from,
        to: record.to,
        hasFrom,
        secret: SECRET_FIELDS.has(field),
        long: isLong(record.from) || isLong(record.to),
        code: isCode(field, record.from, record.to),
        valuesHidden: false,
      };
    },
  );
}

/** True for a create: no change has a "from". */
export const isCreation = (changes: AuditChange[]) =>
  changes.length > 0 && changes.every((c) => !c.hasFrom);

/** Raw argument strings recorded by older events (arg0, arg1, ...). */
export function recordedArguments(
  event: AuditEvent | undefined | null,
): Array<[string, string]> {
  const details = event?.details;
  if (!details) return [];
  return Object.entries(details)
    .filter(([key]) => /^arg\d+$/.test(key))
    .sort(([a], [b]) => Number(a.slice(3)) - Number(b.slice(3)))
    .map(([key, value]) => [
      `Argument ${Number(key.slice(3)) + 1}`,
      valueText(value),
    ]);
}

// Read calls record their arguments (a sort order, a page) where a resource id would be.
const READ_VERBS = new Set(["search", "get", "list", "find", "count", "fetch"]);

/** True when the event names one real resource: an id that isn't "unknown", on a non-read action. */
export function hasResourceId(event: AuditEvent): boolean {
  const id = event.resourceId;
  if (!id || id === "unknown") return false;
  return !READ_VERBS.has(splitWords(String(event.action || ""))[0] ?? "");
}

const typeWord = (resourceType: string | null | undefined) => {
  const word = String(resourceType || "").toLowerCase();
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
};

/**
 * What the event is about: the recorded name; else the resource type when the sentence doesn't
 * already say it. Never a raw id: that lives in Context.
 */
export function eventSubject(event: AuditEvent): string | null {
  const name = event.details?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  const type = typeWord(event.resourceType);
  if (!type) return null;
  return actionSentence(event.action).toLowerCase().includes(type.toLowerCase())
    ? null
    : type;
}

/** The exact time with its UTC offset, e.g. "5 Nov 2026, 14:03:12 (UTC+02:00)". */
export function exactTimeWithZone(value: unknown): string {
  const date = parseDate(value);
  if (!date) return formatExactDateTime(value);
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const offset = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${formatExactDateTime(date)} (UTC${sign}${offset})`;
}

export const actorName = (event: AuditEvent) =>
  event.actorName || event.actorUsername || event.actorId || "Unknown actor";
