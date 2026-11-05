import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
  WeaverSort,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import { WeaverDateTimeField, WeaverSelectField, WeaverTextField } from "@/components/common/fields";
import useDebounce from "@/hooks/useDebounce";
import { formatExactDateTime, formatRelativeTime } from "@/utils/dateTime";
import { getErrorMessage } from "@/utils/error";
import {
  SettingsNotice,
  SettingsPage,
  useAuditEvents,
  useAuditFacets,
  useAuditHistogram,
  type AuditEvent,
} from "@/features/settings";
import { AuditEventDrawer } from "./AuditEventDrawer";
import { AuditAdvancedFilters } from "./AuditAdvancedFilters";
import { AuditActivityStrip } from "./AuditActivityStrip";
import { AuditStatus } from "./AuditStatus";
import { actionSentence, hasResourceId } from "./auditEventFormat";
import {
  DEFAULT_RANGE,
  PAGE_SIZE_OPTIONS,
  TIME_RANGES,
  activeFilterCount,
  advancedCount,
  customRangeError,
  parseAuditLogState,
  pickAdvanced,
  toApiFilters,
  toSearchParams,
  type AuditLogState,
} from "./auditLogFilters";
import styles from "./SettingsPages.module.css";

const DEFAULT_VISIBLE_FIELDS = ["timestamp", "actor", "event", "status", "durationMs"];
const DEFAULT_SORT: WeaverSort[] = [{ field: "timestamp", direction: "desc" }];
const STATUS_LABELS: Record<string, string> = { SUCCESS: "Success", FAILED: "Failed" };

const getEventId = (event: AuditEvent) => event.id;
const actorLabel = (event: AuditEvent) => event.actorName || event.actorUsername || event.actorId || "Unknown";

/** "QUERY" → "Query", "SCHEDULER_JOB" → "Scheduler job". */
const typeLabel = (resourceType: string | null | undefined) => {
  const words = String(resourceType || "").toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** What the event acted on: its recorded name, else a real resource id. */
const eventSubject = (event: AuditEvent): { text: string; isId: boolean } | null => {
  if (event.resourceName?.trim()) return { text: event.resourceName.trim(), isId: false };
  if (hasResourceId(event)) return { text: String(event.resourceId), isId: true };
  return null;
};

const rangeTimeOf = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** A chip for one active filter that isn't visible in a field above. */
interface FilterChip {
  key: string;
  label: string;
  value: string;
  clear: Partial<AuditLogState>;
}

export default function SettingsAuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseAuditLogState(searchParams), [searchParams]);

  // A relative range ends at the moment it was picked (or Refresh was last pressed), so events
  // logged meanwhile don't shift the pages being read. Computed in the same render as the range
  // change, so no request goes out for the new anchor with the old range.
  const [refreshCount, setRefreshCount] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const anchor = useMemo(() => Date.now(), [state.range, refreshCount]);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  /** Applies a change to the URL; any filter change starts again at the first page. */
  const update = useCallback(
    (patch: Partial<AuditLogState>, { resetPage = true, replace = false } = {}) => {
      setSearchParams(
        (current) => {
          const next = { ...parseAuditLogState(current), ...patch };
          if (resetPage) next.page = 0;
          return toSearchParams(next);
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  // Search: typed here, sent to the URL (and so the server) once typing pauses.
  const [search, setSearch] = useState(state.search);
  const debouncedSearch = useDebounce(search, 300);
  useEffect(() => {
    if (debouncedSearch !== state.search) update({ search: debouncedSearch }, { replace: true });
    // Only typing drives this; URL changes to the search are mirrored by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => {
    setSearch((current) => (current === state.search ? current : state.search));
  }, [state.search]);

  // Custom range: edited here, applied once both ends are valid.
  const [customFrom, setCustomFrom] = useState<Dayjs | null>(state.from ? dayjs(state.from) : null);
  const [customTo, setCustomTo] = useState<Dayjs | null>(state.to ? dayjs(state.to) : null);
  const custom = state.range === "custom";
  const rangeError = custom ? customRangeError(state.from, state.to) : null;
  const applyCustom = (from: Dayjs | null, to: Dayjs | null) => {
    setCustomFrom(from);
    setCustomTo(to);
    update({
      range: "custom",
      from: from?.isValid() ? from.toISOString() : "",
      to: to?.isValid() ? to.toISOString() : "",
    });
  };

  const filters = useMemo(() => toApiFilters(state, anchor), [state, anchor]);
  const facetsQuery = useAuditFacets();
  const facets = facetsQuery.data;
  const readable = facets?.readable !== false;
  const eventsQuery = useAuditEvents(filters, state.page, state.size, !rangeError);
  const histogramQuery = useAuditHistogram(filters, !rangeError && readable);
  const { refetch: refetchEvents } = eventsQuery;
  const { refetch: refetchHistogram } = histogramQuery;

  const filterCount = activeFilterCount(state);
  const moreCount = advancedCount(state);
  const canReset = filterCount > 0 || state.range !== DEFAULT_RANGE;

  const resetFilters = () => {
    setSearch("");
    setCustomFrom(null);
    setCustomTo(null);
    setAdvancedOpen(false);
    setRefreshCount((count) => count + 1);
    // Page size and sort are view settings, not filters: they stay.
    const kept = new URLSearchParams();
    for (const key of ["size", "sort"]) {
      const value = searchParams.get(key);
      if (value) kept.set(key, value);
    }
    setSearchParams(kept);
  };

  const chips = useMemo<FilterChip[]>(() => {
    const list: FilterChip[] = [];
    if (state.actorId) {
      list.push({
        key: "actorId",
        label: "Actor",
        value: state.actorLabel || state.actorId,
        clear: { actorId: "", actorLabel: "" },
      });
    }
    if (state.actor) list.push({ key: "actor", label: "Actor contains", value: state.actor, clear: { actor: "" } });
    if (state.resourceId) {
      list.push({
        key: "resourceId",
        label: state.resourceTypes.length === 1 ? state.resourceTypes[0] : "Resource",
        value: state.resourceLabel || state.resourceId,
        clear: { resourceId: "", resourceLabel: "" },
      });
    }
    if (state.eventId) list.push({ key: "eventId", label: "Event", value: state.eventId, clear: { eventId: "" } });
    if (state.clientIp) {
      list.push({ key: "clientIp", label: "Client IP", value: state.clientIp, clear: { clientIp: "" } });
    }
    if (state.minDurationMs || state.maxDurationMs) {
      const value =
        state.minDurationMs && state.maxDurationMs
          ? `${state.minDurationMs}–${state.maxDurationMs} ms`
          : state.minDurationMs
            ? `at least ${state.minDurationMs} ms`
            : `at most ${state.maxDurationMs} ms`;
      list.push({ key: "duration", label: "Duration", value, clear: { minDurationMs: "", maxDurationMs: "" } });
    }
    return list;
  }, [state]);

  const fields = useMemo<WeaverDataField<AuditEvent>[]>(
    () => [
      {
        key: "timestamp",
        label: "Time",
        getValue: (event) => event.timestamp,
        width: 140,
        render: (value) =>
          value ? (
            <span title={formatExactDateTime(value)}>{formatRelativeTime(value)}</span>
          ) : (
            <span className={styles.muted}>—</span>
          ),
      },
      {
        key: "actor",
        label: "Actor",
        getValue: actorLabel,
        width: 220,
        render: (_value, event) => (
          <span className={styles.userText}>
            <span className={styles.userName}>{actorLabel(event)}</span>
            {event.actorEmail && <span className={styles.muted}>{event.actorEmail}</span>}
          </span>
        ),
      },
      {
        // Who did what to which resource reads as one line: the action as a sentence, then
        // what it acted on, then (for a failure) why.
        key: "event",
        label: "Event",
        getValue: (event) => event.action,
        width: 380,
        render: (_value, event) => {
          const sentence = actionSentence(event.action);
          const subject = eventSubject(event);
          const failed = event.status === "FAILED";
          const open = event.id === openEventId;
          return (
            <span className={styles.eventCell}>
              <button
                type="button"
                className={`${styles.eventButton} ${open ? styles.eventButtonOpen : ""}`}
                aria-current={open ? "true" : undefined}
                aria-label={subject ? `${sentence}, ${subject.text}` : sentence}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenEventId(event.id);
                }}
              >
                {sentence}
              </button>
              <span className={styles.eventSubject}>
                <span>{typeLabel(event.resourceType)}</span>
                {subject && (
                  <span className={subject.isId ? styles.eventSubjectId : styles.eventSubjectName} title={subject.text}>
                    {subject.text}
                  </span>
                )}
              </span>
              {failed && event.errorMessage && (
                <span className={styles.eventError} title={event.errorMessage}>
                  {event.errorMessage}
                </span>
              )}
            </span>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        getValue: (event) => event.status,
        width: 110,
        render: (value) => <AuditStatus status={String(value)} />,
      },
      {
        key: "durationMs",
        label: "Duration",
        getValue: (event) => event.durationMs,
        width: 100,
        render: (value) =>
          value === null || value === undefined ? (
            <span className={`${styles.muted} ${styles.numeric}`}>—</span>
          ) : (
            <span className={styles.numeric}>{String(value)} ms</span>
          ),
      },
      {
        key: "resource",
        label: "Resource type",
        getValue: (event) => event.resourceType,
        visibleByDefault: false,
        hideable: true,
        width: 150,
        render: (value) => typeLabel(String(value ?? "")),
      },
      {
        key: "clientIp",
        label: "Client IP",
        getValue: (event) => event.clientIp,
        visibleByDefault: false,
        hideable: true,
        sortable: false,
        width: 150,
      },
      {
        key: "id",
        label: "Event ID",
        getValue: (event) => event.id,
        visibleByDefault: false,
        hideable: true,
        sortable: false,
        width: 280,
      },
    ],
    [openEventId]
  );

  const toolbarActions = useMemo<WeaverDataAction<AuditEvent>[]>(
    () => [
      {
        id: "refresh",
        label: "Refresh",
        icon: <RefreshCw size={14} />,
        asButton: true,
        buttonVariant: "outlined",
        onClick: () => {
          // Moves a relative range up to now; a custom range is simply fetched again.
          if (state.range === "custom") {
            void refetchEvents();
            void refetchHistogram();
          } else {
            setRefreshCount((count) => count + 1);
          }
        },
      },
    ],
    [refetchEvents, refetchHistogram, state.range]
  );

  const sortModel = useMemo<WeaverSort[]>(
    () => (state.sort ? [{ field: state.sort.field, direction: state.sort.direction }] : DEFAULT_SORT),
    [state.sort]
  );
  const handleSortChange = useCallback(
    (next: WeaverSort[]) => {
      const sort = next[0];
      const isDefault = !sort || (sort.field === "timestamp" && sort.direction === "desc");
      update({ sort: isDefault ? null : { field: sort.field, direction: sort.direction } });
    },
    [update]
  );

  const handlePaginationChange = useCallback(
    ({ page, pageSize }: { page: number; pageSize: number }) => {
      update({ page, size: pageSize }, { resetPage: pageSize !== state.size });
    },
    [update, state.size]
  );

  const optionsFrom = (values: string[] | undefined, labelOf = (v: string) => v) =>
    (values ?? []).map((value) => ({ label: labelOf(value), value }));

  const items = rangeError ? [] : (eventsQuery.data?.items ?? []);
  const loading = !rangeError && (eventsQuery.isPending || (eventsQuery.isFetching && eventsQuery.isPlaceholderData));
  const errorMessage =
    !rangeError && eventsQuery.error ? getErrorMessage(eventsQuery.error, "Could not load the audit log.") : undefined;
  const rangeLabel = (TIME_RANGES.find((r) => r.value === state.range)?.label ?? "").toLowerCase();
  const rangeText = custom
    ? `${rangeTimeOf.format(Date.parse(state.from))} – ${rangeTimeOf.format(Date.parse(state.to))}`
    : `in the ${rangeLabel}`;

  return (
    <SettingsPage sectionId="audit-logs">
      {facets && !facets.enabled && (
        <SettingsNotice title="Audit logging is off">
          New events aren’t being recorded (<code>conductor.audit.enabled=false</code>). Events recorded earlier are
          still shown.
        </SettingsNotice>
      )}
      {facets && facets.enabled && !facets.readable && (
        <SettingsNotice title="Events go to the server log only">
          This server writes audit events to its log instead of the database (
          <code>conductor.audit.storage-type</code>), so they can’t be shown here.
        </SettingsNotice>
      )}

      <div className={styles.filterBar} role="group" aria-label="Audit log filters">
        <WeaverTextField
          label="Search"
          placeholder="Search action, resource, actor, event ID..."
          value={search}
          onChange={setSearch}
          clearable
          onClear={() => setSearch("")}
          startAdornment={<Search size={15} aria-hidden className={styles.searchIcon} />}
          inputProps={{ "aria-label": "Search action, resource, actor, event ID..." }}
          className={styles.searchField}
        />
        <WeaverSelectField
          label="Time"
          value={state.range}
          options={TIME_RANGES.map(({ label, value }) => ({ label, value }))}
          onChange={(value) => update({ range: String(value) })}
          width={170}
        />
        {custom && (
          <>
            <WeaverDateTimeField
              label="From"
              value={customFrom}
              onChange={(value) => applyCustom(value, customTo)}
              width={210}
            />
            <WeaverDateTimeField label="To" value={customTo} onChange={(value) => applyCustom(customFrom, value)} width={210} />
          </>
        )}
        <WeaverSelectField<string>
          label="Status"
          multiple
          value={state.statuses}
          options={optionsFrom(facets?.statuses, (v) => STATUS_LABELS[v] ?? v)}
          onChange={(value) => update({ statuses: value as string[] })}
          width={150}
        />
        <WeaverSelectField<string>
          label="Resource type"
          multiple
          value={state.resourceTypes}
          options={optionsFrom(facets?.resourceTypes)}
          onChange={(value) => update({ resourceTypes: value as string[] })}
          width={170}
        />
        <Autocomplete
          multiple
          size="small"
          limitTags={1}
          options={facets?.actions ?? []}
          value={state.actions}
          onChange={(_e, value) => update({ actions: value })}
          disableCloseOnSelect
          className={styles.actionFilter}
          // The selection as text, like the selects beside it, so the field keeps its height.
          renderTags={(value) => (
            <span className={styles.actionValue}>
              {value[0]}
              {value.length > 1 && <span className={styles.muted}> +{value.length - 1}</span>}
            </span>
          )}
          renderInput={(params) => (
            <TextField {...params} label="Action" placeholder={state.actions.length ? "" : "Search"} />
          )}
          noOptionsText="No recorded action matches"
        />
        <Button
          variant={advancedOpen || moreCount ? "contained" : "outlined"}
          disableElevation
          startIcon={<SlidersHorizontal size={14} aria-hidden />}
          aria-expanded={advancedOpen}
          aria-controls="audit-advanced-filters"
          onClick={() => setAdvancedOpen((isOpen) => !isOpen)}
          className={styles.filtersButton}
        >
          {moreCount ? `Filters (${moreCount})` : "Filters"}
        </Button>
      </div>

      {rangeError && (
        <p className={styles.rangeError} role="alert">
          {rangeError}
        </p>
      )}

      {advancedOpen && (
        <AuditAdvancedFilters
          value={pickAdvanced(state)}
          onClose={() => setAdvancedOpen(false)}
          onApply={(values) => {
            update({
              ...values,
              resourceLabel: values.resourceId === state.resourceId ? state.resourceLabel : "",
            });
            setAdvancedOpen(false);
          }}
        />
      )}

      {(chips.length > 0 || canReset) && (
        <div className={styles.filterActions}>
          {chips.length > 0 && (
            <ul className={styles.filterChips} aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.key} className={styles.filterChip}>
                  <span className={styles.filterChipLabel}>{chip.label}</span>
                  <span className={styles.filterChipValue} title={chip.value}>
                    {chip.value}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${chip.label.toLowerCase()} filter ${chip.value}`}
                    onClick={() => update(chip.clear)}
                  >
                    <X size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canReset && (
            <Button variant="text" size="small" onClick={resetFilters} className={styles.resetButton}>
              Reset filters
            </Button>
          )}
        </div>
      )}

      {!rangeError && readable && (
        <AuditActivityStrip
          histogram={histogramQuery.data}
          loading={histogramQuery.isFetching}
          error={Boolean(histogramQuery.error)}
          onRetry={() => void refetchHistogram()}
          rangeText={rangeText}
          onSelect={(from, to) => applyCustom(dayjs(from), dayjs(to))}
        />
      )}

      <WeaverDataExplorer<AuditEvent>
        records={items}
        getRecordId={getEventId}
        fields={fields}
        storageKey="settings_audit_logs_v2"
        defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
        dataMode="server"
        selectionMode="none"
        filterable={false}
        searchable={false}
        loading={loading}
        errorMessage={errorMessage}
        toolbarActions={toolbarActions}
        onRecordClick={(event) => setOpenEventId(event.id)}
        sortModel={sortModel}
        onSortChange={handleSortChange}
        pagination
        totalRecords={rangeError ? 0 : (eventsQuery.data?.total ?? 0)}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        paginationModel={{ page: state.page, pageSize: state.size }}
        onPaginationChange={handlePaginationChange}
        stickyHeader
        height="calc(100vh - 420px)"
        emptyTitle={
          rangeError
            ? "Choose a time range"
            : filterCount > 0
              ? "No events match these filters"
              : custom
                ? "No audit events in this period"
                : `No audit events in the ${rangeLabel}`
        }
        emptyDescription={
          rangeError
            ? "Pick when the custom range starts and ends."
            : filterCount > 0
              ? "Try another search or filter, a longer time range, or Reset filters."
              : "Try a longer time range. Audited operations (starting workflows, changing definitions, running SQL...) appear here."
        }
      />

      <AuditEventDrawer
        eventId={openEventId}
        events={items}
        onNavigate={setOpenEventId}
        onClose={() => setOpenEventId(null)}
        onFilterActor={(filter) => {
          update({ actorId: filter.actorId, actorLabel: filter.label });
          setOpenEventId(null);
        }}
        onFilterResource={(filter) => {
          update({
            resourceTypes: [filter.resourceType],
            resourceId: filter.resourceId,
            resourceLabel: filter.label,
          });
          setOpenEventId(null);
        }}
      />
    </SettingsPage>
  );
}
