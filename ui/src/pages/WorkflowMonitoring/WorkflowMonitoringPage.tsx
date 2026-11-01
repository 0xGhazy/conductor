import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiActivity,
  FiPlay,
  FiCheckCircle,
  FiAlertCircle,
  FiPauseCircle,
  FiSearch,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiSliders,
  FiX,
  FiChevronDown,
  FiPlus,
  FiRotateCcw,
  FiCalendar,
} from "react-icons/fi";
import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import {
  searchWorkflowExecutions,
  type WorkflowExecution,
  formatExecutionDateTime,
  formatExecutionElapsed,
} from "@/features/monitoring";
import styles from "./WorkflowMonitoringPage.module.css";

export type DateRangePreset =
  | "ALL"
  | "TODAY"
  | "YESTERDAY"
  | "LAST_48_HOURS"
  | "LAST_72_HOURS"
  | "LAST_WEEK"
  | "CUSTOM";

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "LAST_72_HOURS", label: "Last 72 Hour" },
  { id: "TODAY", label: "Today" },
  { id: "YESTERDAY", label: "Yesterday" },
  { id: "LAST_48_HOURS", label: "Last 48 hour" },
  { id: "LAST_WEEK", label: "Last week" },
  { id: "ALL", label: "All Time" },
  { id: "CUSTOM", label: "Custom Range" },
];

const STATUS_OPTIONS = [
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "TIMED_OUT",
  "TERMINATED",
  "PAUSED",
] as const;

/** Extracts the last segment of a workflow ID after splitting by '-' */
function getDisplayWorkflowId(id?: string | null): string {
  if (!id) return "—";
  const parts = id.split("-");
  return parts[parts.length - 1] || id;
}

/** Compute epoch millisecond bounds for date range presets */
function computeDateRangeEpochs(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): { from: number; to?: number } | null {
  const now = Date.now();

  if (preset === "TODAY") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { from: start.getTime() };
  }

  if (preset === "YESTERDAY") {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { from: start.getTime(), to: end.getTime() };
  }

  if (preset === "LAST_48_HOURS") {
    return { from: now - 48 * 3600 * 1000 };
  }

  if (preset === "LAST_72_HOURS") {
    return { from: now - 72 * 3600 * 1000 };
  }

  if (preset === "LAST_WEEK") {
    return { from: now - 7 * 24 * 3600 * 1000 };
  }

  if (preset === "CUSTOM") {
    if (!customStart) return null;
    const startEpoch = new Date(customStart).getTime();
    if (isNaN(startEpoch)) return null;
    const endEpoch = customEnd ? new Date(customEnd).getTime() : undefined;
    return { from: startEpoch, to: endEpoch && !isNaN(endEpoch) ? endEpoch : undefined };
  }

  return null;
}

/** Assembles the Conductor Lucene query according to user specifications */
function buildConductorSearchQuery(filters: {
  workflowNames: string[];
  workflowId: string;
  statuses: string[];
  correlationIds: string[];
  dateRange: { from: number; to?: number } | null;
}): string {
  const clauses: string[] = [];

  // 1. Workflow Name [multi select] -> workflowType IN (a,b)
  if (filters.workflowNames.length > 0) {
    const names = filters.workflowNames.map((n) => n.trim()).filter(Boolean);
    if (names.length > 0) {
      clauses.push(`workflowType IN (${names.join(",")})`);
    }
  }

  // 2. Workflow ID -> workflowId='asd'
  if (filters.workflowId.trim()) {
    clauses.push(`workflowId='${filters.workflowId.trim()}'`);
  }

  // 3. Status [multi select] -> status IN (RUNNING,FAILED)
  if (filters.statuses.length > 0) {
    const st = filters.statuses.map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (st.length > 0) {
      clauses.push(`status IN (${st.join(",")})`);
    }
  }

  // 4. Start Date & Date Options -> startTime>...
  if (filters.dateRange && filters.dateRange.from) {
    if (filters.dateRange.to) {
      clauses.push(`startTime>${filters.dateRange.from} AND startTime<${filters.dateRange.to}`);
    } else {
      clauses.push(`startTime>${filters.dateRange.from}`);
    }
  }

  // 5. Correlation ID [multi select] -> correlationId IN (qwe)
  if (filters.correlationIds.length > 0) {
    const corr = filters.correlationIds.map((c) => c.trim()).filter(Boolean);
    if (corr.length > 0) {
      clauses.push(`correlationId IN (${corr.join(",")})`);
    }
  }

  return clauses.join(" AND ");
}

const EMPTY_ROWS: WorkflowExecution[] = [];

function computeKpiCounts(list: WorkflowExecution[], total: number) {
  let running = 0;
  let completed = 0;
  let failed = 0;
  let paused = 0;

  list.forEach((row) => {
    const s = String(row.status || "").toUpperCase();
    if (s === "RUNNING") running++;
    else if (s === "COMPLETED") completed++;
    else if (s === "FAILED" || s === "TERMINATED" || s === "TIMED_OUT") failed++;
    else if (s === "PAUSED") paused++;
  });

  return {
    total,
    running,
    completed,
    failed,
    paused,
  };
}

export default function WorkflowMonitoringPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = "Executions";
  }, []);

  // Read initial pagination parameters directly from URL
  const initialStartFromUrl = useMemo(() => {
    const s = parseInt(searchParams.get("start") || "0", 10);
    return isNaN(s) || s < 0 ? 0 : s;
  }, []);

  const initialSizeFromUrl = useMemo(() => {
    const sz = parseInt(searchParams.get("size") || "15", 10);
    return isNaN(sz) || sz < 1 ? 15 : sz;
  }, []);

  // Search filter fields state
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>(() => {
    const wf = searchParams.get("workflowName") || searchParams.get("workflowType");
    return wf ? [wf] : [];
  });
  const [workflowIdQuery, setWorkflowIdQuery] = useState<string>(() => {
    return searchParams.get("workflowId") || "";
  });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    const st = searchParams.get("status");
    return st ? [st.toUpperCase()] : [];
  });
  const [selectedCorrelationIds, setSelectedCorrelationIds] = useState<string[]>([]);
  const [correlationIdInput, setCorrelationIdInput] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("LAST_72_HOURS");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedWorkflows.length > 0) count++;
    if (workflowIdQuery.trim()) count++;
    if (selectedStatuses.length > 0) count++;
    if (selectedCorrelationIds.length > 0) count++;
    if (datePreset !== "LAST_72_HOURS") count++;
    return count;
  }, [selectedWorkflows, workflowIdQuery, selectedStatuses, selectedCorrelationIds, datePreset]);

  // Percentage distribution helper (relative to executions on current page, or total)
  const getPercentage = (count: number) => {
    const denom = rows.length > 0 ? rows.length : kpiStats.total;
    if (!denom || denom === 0) return "0%";
    return `${Math.round((count / denom) * 100)}%`;
  };

  // Dropdown open states
  const [wfDropdownOpen, setWfDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [corrDropdownOpen, setCorrDropdownOpen] = useState(false);
  const [wfSearchTerm, setWfSearchTerm] = useState("");

  // Applied query tracked for pagination & refresh. Seeded once on mount from the
  // URL-derived filters and the default (72h) date preset.
  const [appliedQuery, setAppliedQuery] = useState<string>(() =>
    buildConductorSearchQuery({
      workflowNames: selectedWorkflows,
      workflowId: workflowIdQuery,
      statuses: selectedStatuses,
      correlationIds: selectedCorrelationIds,
      dateRange: computeDateRangeEpochs("LAST_72_HOURS"),
    })
  );

  // Pagination & auto-refresh (start = offset in Conductor API, size = limit in Conductor API)
  const [startOffset, setStartOffset] = useState<number>(initialStartFromUrl);
  const [pageSize, setPageSize] = useState<number>(initialSizeFromUrl);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // 30s default


  const wfDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const corrDropdownRef = useRef<HTMLDivElement>(null);

  // Helper to sync pagination offset and size to URL search params
  const syncUrlPagination = useCallback(
    (newStart: number, newSize: number = pageSize) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("start", String(newStart));
          next.set("size", String(newSize));
          return next;
        },
        { replace: true }
      );
    },
    [pageSize, setSearchParams]
  );

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wfDropdownRef.current && !wfDropdownRef.current.contains(e.target as Node)) {
        setWfDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (corrDropdownRef.current && !corrDropdownRef.current.contains(e.target as Node)) {
        setCorrDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Executions search via Conductor /api/workflow/search using start (offset) and size.
  // Cached per (query, start, size); the previous page stays on screen while the next loads.
  const executionsQuery = useQuery({
    queryKey: ["executions", "search", appliedQuery, startOffset, pageSize],
    queryFn: () =>
      searchWorkflowExecutions({
        start: startOffset,
        size: pageSize,
        sort: "startTime:DESC",
        freeText: "*",
        query: appliedQuery || undefined,
        classifier: "workflow",
      }),
    placeholderData: keepPreviousData,
    refetchInterval: autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : false,
    retry: false,
  });
  const { refetch: refetchExecutions } = executionsQuery;

  // Workflow names for the multi-select (changes rarely)
  const workflowNamesQuery = useQuery({
    queryKey: ["metadata", "workflow", "names"],
    queryFn: () =>
      apiClient
        .get<Array<string | { name?: string }>>(`${config.apiBaseUrl}/api/metadata/workflow/names`)
        .then((r) => r.data || []),
    staleTime: 10 * 60 * 1000,
  });

  const rows: WorkflowExecution[] = executionsQuery.data?.results ?? EMPTY_ROWS;
  const totalHits = executionsQuery.data?.totalHits ?? 0;
  const loading = executionsQuery.isPending;
  const isFetching = executionsQuery.isFetching;
  const error = executionsQuery.isError
    ? (executionsQuery.error as Error | null)?.message || "Could not retrieve executions from Conductor search."
    : null;

  const kpiStats = useMemo(() => computeKpiCounts(rows, totalHits), [rows, totalHits]);

  const currentPage = Math.floor(startOffset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(totalHits / pageSize));

  const availableWorkflows = useMemo(() => {
    const wfSet = new Set<string>();
    rows.forEach((row) => {
      const wName = String(row.workflowName || row.workflowType || "").trim();
      if (wName) wfSet.add(wName);
    });
    const names = workflowNamesQuery.data;
    if (Array.isArray(names)) {
      names.forEach((name) => {
        if (typeof name === "string" && name.trim()) wfSet.add(name.trim());
        else if (typeof name === "object" && name?.name) wfSet.add(String(name.name).trim());
      });
    }
    return Array.from(wfSet).sort();
  }, [rows, workflowNamesQuery.data]);

  const availableCorrelationIds = useMemo(() => {
    const corrSet = new Set<string>();
    rows.forEach((row) => {
      const cId = String(row.correlationId || (row as { correlation_id?: string }).correlation_id || "").trim();
      if (cId) corrSet.add(cId);
    });
    return Array.from(corrSet).sort();
  }, [rows]);

  const selectedCorrelationIdSet = useMemo(() => new Set(selectedCorrelationIds), [selectedCorrelationIds]);

  const filteredCorrelationSuggestions = useMemo(() => {
    const q = correlationIdInput.toLowerCase();
    if (!q) return availableCorrelationIds;
    return availableCorrelationIds.filter((c) => c.toLowerCase().includes(q));
  }, [availableCorrelationIds, correlationIdInput]);

  // Applies a query/page combination; forces a refetch when nothing changed so that
  // explicit "Search" / page clicks still hit the server like before.
  const runSearch = useCallback(
    (queryToRun: string, start: number, size: number) => {
      if (queryToRun === appliedQuery && start === startOffset && size === pageSize) {
        void refetchExecutions();
        return;
      }
      setAppliedQuery(queryToRun);
      setStartOffset(start);
      setPageSize(size);
    },
    [appliedQuery, startOffset, pageSize, refetchExecutions]
  );

  // Apply Search
  const handleApplySearch = useCallback(() => {
    // If user has typed an un-added correlation ID, include it
    let corrs = [...selectedCorrelationIds];
    if (correlationIdInput.trim() && !corrs.includes(correlationIdInput.trim())) {
      corrs.push(correlationIdInput.trim());
      setSelectedCorrelationIds(corrs);
      setCorrelationIdInput("");
    }

    const dateBounds = computeDateRangeEpochs(datePreset, customStartDate, customEndDate);
    const builtQuery = buildConductorSearchQuery({
      workflowNames: selectedWorkflows,
      workflowId: workflowIdQuery,
      statuses: selectedStatuses,
      correlationIds: corrs,
      dateRange: dateBounds,
    });

    syncUrlPagination(0, pageSize);
    runSearch(builtQuery, 0, pageSize);
  }, [
    selectedWorkflows,
    workflowIdQuery,
    selectedStatuses,
    selectedCorrelationIds,
    correlationIdInput,
    datePreset,
    customStartDate,
    customEndDate,
    pageSize,
    syncUrlPagination,
    runSearch,
  ]);

  // Reset Filters
  const handleResetFilters = useCallback(() => {
    setSelectedWorkflows([]);
    setWorkflowIdQuery("");
    setSelectedStatuses([]);
    setSelectedCorrelationIds([]);
    setCorrelationIdInput("");
    setDatePreset("LAST_72_HOURS");
    setCustomStartDate("");
    setCustomEndDate("");
    const defaultRange = computeDateRangeEpochs("LAST_72_HOURS");
    const defaultQuery = buildConductorSearchQuery({
      workflowNames: [],
      workflowId: "",
      statuses: [],
      correlationIds: [],
      dateRange: defaultRange,
    });
    syncUrlPagination(0, pageSize);
    runSearch(defaultQuery, 0, pageSize);
  }, [pageSize, syncUrlPagination, runSearch]);

  // Pagination slice & controls
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const nextStart = (newPage - 1) * pageSize;
    syncUrlPagination(nextStart, pageSize);
    runSearch(appliedQuery, nextStart, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    syncUrlPagination(0, newSize);
    runSearch(appliedQuery, 0, newSize);
  };

  // KPI card click: sets status filter & triggers search
  const handleKpiCardClick = (targetStatus: "ALL" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED") => {
    let nextStatuses: string[] = [];
    if (targetStatus === "ALL") {
      nextStatuses = [];
    } else if (targetStatus === "FAILED") {
      nextStatuses = ["FAILED", "TERMINATED", "TIMED_OUT"];
    } else {
      nextStatuses = [targetStatus];
    }
    setSelectedStatuses(nextStatuses);

    const dateBounds = computeDateRangeEpochs(datePreset, customStartDate, customEndDate);
    const builtQuery = buildConductorSearchQuery({
      workflowNames: selectedWorkflows,
      workflowId: workflowIdQuery,
      statuses: nextStatuses,
      correlationIds: selectedCorrelationIds,
      dateRange: dateBounds,
    });

    syncUrlPagination(0, pageSize);
    runSearch(builtQuery, 0, pageSize);
  };

  // Add correlation ID from input
  const handleAddCorrelationId = () => {
    const val = correlationIdInput.trim();
    if (val && !selectedCorrelationIds.includes(val)) {
      setSelectedCorrelationIds((prev) => [...prev, val]);
      setCorrelationIdInput("");
    }
  };

  // Remove correlation ID
  const handleRemoveCorrelationId = (idToRemove: string) => {
    setSelectedCorrelationIds((prev) => prev.filter((id) => id !== idToRemove));
  };

  // Toggle workflow selection
  const handleToggleWorkflow = (name: string) => {
    setSelectedWorkflows((prev) =>
      prev.includes(name) ? prev.filter((w) => w !== name) : [...prev, name]
    );
  };

  // Toggle status selection
  const handleToggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  // Launch in Workbench
  const handleTestInWorkbench = (wfName: string, version?: number | string) => {
    const query = new URLSearchParams();
    if (wfName) query.set("workflow", wfName);
    if (version) query.set("version", String(version));
    navigate(`/workbench?${query.toString()}`);
  };

  // Filtered workflows for multi-select dropdown
  const filteredAvailableWorkflows = useMemo(() => {
    const q = wfSearchTerm.trim().toLowerCase();
    if (!q) return availableWorkflows;
    return availableWorkflows.filter((w) => w.toLowerCase().includes(q));
  }, [availableWorkflows, wfSearchTerm]);

  // Status Pill renderer
  const renderStatusPill = (statusRaw?: string) => {
    const s = String(statusRaw || "UNKNOWN").toUpperCase();
    if (s === "COMPLETED") {
      return (
        <span className={`${styles.statusPill} ${styles.completed}`}>
          <FiCheckCircle size={12} />
          <span>Completed</span>
        </span>
      );
    }
    if (s === "RUNNING") {
      return (
        <span className={`${styles.statusPill} ${styles.running}`}>
          <span className={styles.pulseDot} style={{ width: 6, height: 6 }} />
          <span>Running</span>
        </span>
      );
    }
    if (s === "FAILED" || s === "TERMINATED" || s === "TIMED_OUT") {
      return (
        <span className={`${styles.statusPill} ${styles.failed}`}>
          <FiAlertCircle size={12} />
          <span>{s}</span>
        </span>
      );
    }
    if (s === "PAUSED") {
      return (
        <span className={`${styles.statusPill} ${styles.paused}`}>
          <FiPauseCircle size={12} />
          <span>Paused</span>
        </span>
      );
    }
    return (
      <span className={styles.statusPill} style={{ background: "var(--color-surface-soft)" }}>
        <span>{s}</span>
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* 1. Header & Controls */}
      <div className={styles.headerSection}>
        <div className={styles.titleGroup}>
          <h1 className={styles.pageTitle}>Workflow Executions</h1>
          <div className={styles.pageSubtitle}>
            Live orchestration telemetry, execution states, and task runtimes from Conductor engine.
          </div>
        </div>

        <div className={styles.headerControls}>
          {/* Auto Refresh Dropdown */}
          <div className={styles.autoRefreshGroup} title="Configurable background refresh interval">
            {autoRefreshInterval > 0 ? <span className={styles.pulseDot} /> : null}
            <select
              className={styles.autoRefreshSelect}
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            >
              <option value={0}>Auto: Off</option>
              <option value={10}>Auto: 10s</option>
              <option value={30}>Auto: 30s</option>
              <option value={60}>Auto: 60s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            type="button"
            className={styles.btnRefresh}
            onClick={() => void refetchExecutions()}
            disabled={isFetching}
            title="Refresh executions now"
          >
            <FiRefreshCw size={15} className={isFetching ? styles.spinning : ""} />
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error ? (
        <div className={styles.errorBanner}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiAlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void refetchExecutions()}
            style={{ color: "inherit", borderColor: "currentColor" }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* 2. Interactive KPI Metric Ribbon */}
      <div className={styles.kpiRibbon}>
        {/* Total Executions */}
        <div
          className={`${styles.kpiCard} ${selectedStatuses.length === 0 ? styles.activeTotal : ""}`}
          onClick={() => handleKpiCardClick("ALL")}
          title="Filter all runs (click to clear status filters)"
        >
          <div className={styles.kpiTopRow}>
            <div className={styles.kpiLabelGroup}>
              <span className={styles.kpiLabel}>Total Executions</span>
              <span className={styles.kpiPercentBadge}>
                {totalPages > 1 ? `Page ${currentPage}/${totalPages}` : "100%"}
              </span>
            </div>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: "color-mix(in srgb, var(--hue-indigo, #6366f1) 14%, transparent)",
                color: "var(--hue-indigo, #6366f1)",
              }}
            >
              <FiActivity size={15} />
            </div>
          </div>
          <div className={styles.kpiValue}>{totalHits}</div>
          <div className={styles.kpiSub}>
            {totalPages > 1
              ? `Showing ${totalHits === 0 ? 0 : startOffset + 1}–${Math.min(startOffset + rows.length, totalHits)} of ${totalHits}`
              : "Across all matching workflows"}
          </div>
        </div>

        {/* Running */}
        <div
          className={`${styles.kpiCard} ${selectedStatuses.includes("RUNNING") && selectedStatuses.length === 1 ? styles.activeRunning : ""}`}
          onClick={() => handleKpiCardClick("RUNNING")}
          title="Filter running workflows"
        >
          <div className={styles.kpiTopRow}>
            <div className={styles.kpiLabelGroup}>
              <span className={styles.kpiLabel}>Running</span>
              <span className={styles.kpiPercentBadge}>{getPercentage(kpiStats.running)}</span>
            </div>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: "color-mix(in srgb, var(--color-status-info, #2563eb) 14%, transparent)",
                color: "var(--color-status-info, #2563eb)",
              }}
            >
              <span className={styles.pulseDot} style={{ width: 8, height: 8 }} />
            </div>
          </div>
          <div className={styles.kpiValue}>{kpiStats.running}</div>
          <div className={styles.kpiSub}>
            {totalPages > 1
              ? `${kpiStats.running} on page ${currentPage} (${getPercentage(kpiStats.running)})`
              : "Active executing pipelines"}
          </div>
        </div>

        {/* Completed */}
        <div
          className={`${styles.kpiCard} ${selectedStatuses.includes("COMPLETED") && selectedStatuses.length === 1 ? styles.activeCompleted : ""}`}
          onClick={() => handleKpiCardClick("COMPLETED")}
          title="Filter completed workflows"
        >
          <div className={styles.kpiTopRow}>
            <div className={styles.kpiLabelGroup}>
              <span className={styles.kpiLabel}>Completed</span>
              <span className={styles.kpiPercentBadge}>{getPercentage(kpiStats.completed)}</span>
            </div>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: "color-mix(in srgb, var(--color-status-success, #16a34a) 14%, transparent)",
                color: "var(--color-status-success, #16a34a)",
              }}
            >
              <FiCheckCircle size={15} />
            </div>
          </div>
          <div className={styles.kpiValue}>{kpiStats.completed}</div>
          <div className={styles.kpiSub}>
            {totalPages > 1
              ? `${kpiStats.completed} on page ${currentPage} (${getPercentage(kpiStats.completed)})`
              : "Finished successfully"}
          </div>
        </div>

        {/* Failed / Terminated */}
        <div
          className={`${styles.kpiCard} ${selectedStatuses.includes("FAILED") ? styles.activeFailed : ""}`}
          onClick={() => handleKpiCardClick("FAILED")}
          title="Filter failed workflows"
        >
          <div className={styles.kpiTopRow}>
            <div className={styles.kpiLabelGroup}>
              <span className={styles.kpiLabel}>Failed / Terminated</span>
              <span className={styles.kpiPercentBadge}>{getPercentage(kpiStats.failed)}</span>
            </div>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: "color-mix(in srgb, var(--color-status-danger, #dc2626) 14%, transparent)",
                color: "var(--color-status-danger, #dc2626)",
              }}
            >
              <FiAlertCircle size={15} />
            </div>
          </div>
          <div className={styles.kpiValue}>{kpiStats.failed}</div>
          <div className={styles.kpiSub}>
            {totalPages > 1
              ? `${kpiStats.failed} on page ${currentPage} (${getPercentage(kpiStats.failed)})`
              : "Requires operational triage"}
          </div>
        </div>

        {/* Paused */}
        <div
          className={`${styles.kpiCard} ${selectedStatuses.includes("PAUSED") && selectedStatuses.length === 1 ? styles.activePaused : ""}`}
          onClick={() => handleKpiCardClick("PAUSED")}
          title="Filter paused workflows"
        >
          <div className={styles.kpiTopRow}>
            <div className={styles.kpiLabelGroup}>
              <span className={styles.kpiLabel}>Paused</span>
              <span className={styles.kpiPercentBadge}>{getPercentage(kpiStats.paused)}</span>
            </div>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: "color-mix(in srgb, var(--color-status-warn, #d97706) 14%, transparent)",
                color: "var(--color-status-warn, #d97706)",
              }}
            >
              <FiPauseCircle size={15} />
            </div>
          </div>
          <div className={styles.kpiValue}>{kpiStats.paused}</div>
          <div className={styles.kpiSub}>
            {totalPages > 1
              ? `${kpiStats.paused} on page ${currentPage} (${getPercentage(kpiStats.paused)})`
              : "Temporarily suspended"}
          </div>
        </div>
      </div>

      {/* 3. Collapsible Command Bar & Advanced Filter Drawer */}
      <div className={styles.commandBarCard}>
        {/* Fast Command Bar Row */}
        <div className={styles.commandBarRow}>
          {/* Fast Search Input */}
          <div className={styles.commandSearchWrap}>
            <FiSearch size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.commandSearchInput}
              placeholder="Search by Workflow ID or keyword... (Press Enter)"
              value={workflowIdQuery}
              onChange={(e) => setWorkflowIdQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplySearch();
              }}
            />
            {workflowIdQuery ? (
              <button
                type="button"
                className={styles.clearIconBtn}
                onClick={() => setWorkflowIdQuery("")}
                title="Clear search text"
              >
                <FiX size={13} />
              </button>
            ) : (
              <kbd className={styles.kbdHint}>↵</kbd>
            )}
          </div>

          {/* Quick Date Presets Segmented Bar */}
          <div className={styles.dateSegmentGroup}>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`${styles.dateSegmentBtn} ${datePreset === preset.id ? styles.activeSegment : ""}`}
                onClick={() => {
                  setDatePreset(preset.id);
                  if (preset.id === "CUSTOM" && !isDrawerOpen) {
                    setIsDrawerOpen(true);
                  }
                }}
                title={`Filter by ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Actions & Drawer Trigger */}
          <div className={styles.commandActions}>
            <button
              type="button"
              className={`${styles.btnDrawerTrigger} ${isDrawerOpen ? styles.drawerOpen : ""} ${activeFiltersCount > 0 ? styles.hasActiveFilters : ""}`}
              onClick={() => setIsDrawerOpen((o) => !o)}
              title={isDrawerOpen ? "Collapse advanced filter stations" : "Expand advanced filter stations"}
            >
              <FiSliders size={13} />
              <span>Filters</span>
              {activeFiltersCount > 0 ? (
                <span className={styles.filterCountBadge}>{activeFiltersCount}</span>
              ) : null}
              <FiChevronDown
                size={13}
                className={`${styles.drawerChevron} ${isDrawerOpen ? styles.chevronRotated : ""}`}
              />
            </button>

            {(activeFiltersCount > 0 || appliedQuery) ? (
              <button
                type="button"
                className={styles.btnResetCmd}
                onClick={handleResetFilters}
                title="Reset all search filters"
              >
                <FiRotateCcw size={12} />
                <span>Reset</span>
              </button>
            ) : null}

            <button
              type="button"
              className={styles.btnPrimarySearch}
              onClick={handleApplySearch}
              disabled={isFetching}
              title="Execute Conductor search query"
            >
              {isFetching ? <FiRefreshCw size={13} className={styles.spinning} /> : <FiSearch size={13} />}
              <span>Search</span>
            </button>
          </div>
        </div>

        {/* Advanced Filter Drawer (Slide-down) */}
        {isDrawerOpen ? (
          <div className={styles.advancedDrawer}>
            <div className={styles.drawerDivider} />

            {/* 4 Search Field Stations in Grid */}
            <div className={styles.searchFieldsGrid}>
              {/* Field 1: Workflow Name [multi select] */}
              <div className={styles.fieldGroup} ref={wfDropdownRef}>
                <div className={styles.fieldLabel}>
                  <span>Workflow Name</span>
                  {selectedWorkflows.length > 0 ? (
                    <span className={styles.fieldBadge}>{selectedWorkflows.length} selected</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={styles.selectTrigger}
                  onClick={() => setWfDropdownOpen((o) => !o)}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedWorkflows.length === 0
                      ? "All workflows..."
                      : `${selectedWorkflows.length} workflow${selectedWorkflows.length > 1 ? "s" : ""} selected`}
                  </span>
                  <FiChevronDown size={14} color="var(--color-fg-muted)" />
                </button>

                {wfDropdownOpen ? (
                  <div className={styles.dropdownPopover}>
                    <div className={styles.dropdownSearch}>
                      <FiSearch size={13} color="var(--color-fg-muted)" />
                      <input
                        type="text"
                        className={styles.dropdownSearchInput}
                        placeholder="Search workflows..."
                        value={wfSearchTerm}
                        onChange={(e) => setWfSearchTerm(e.target.value)}
                        autoFocus
                      />
                      {wfSearchTerm ? (
                        <button
                          type="button"
                          className={styles.clearIconBtn}
                          onClick={() => setWfSearchTerm("")}
                        >
                          <FiX size={12} />
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.dropdownList}>
                      {filteredAvailableWorkflows.length === 0 ? (
                        <div style={{ padding: "10px", fontSize: 12, color: "var(--color-fg-muted)", textAlign: "center" }}>
                          No workflows found
                        </div>
                      ) : (
                        filteredAvailableWorkflows.map((wName) => {
                          const isSelected = selectedWorkflows.includes(wName);
                          return (
                            <div
                              key={wName}
                              className={`${styles.dropdownItem} ${isSelected ? styles.selected : ""}`}
                              onClick={() => handleToggleWorkflow(wName)}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ cursor: "pointer", accentColor: "var(--color-accent-fg)" }}
                              />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{wName}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className={styles.dropdownFooter}>
                      <button
                        type="button"
                        className={styles.dropdownActionBtn}
                        onClick={() => setSelectedWorkflows([...availableWorkflows])}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={styles.dropdownActionBtn}
                        onClick={() => setSelectedWorkflows([])}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Selected workflow chips tray */}
                {selectedWorkflows.length > 0 ? (
                  <div className={styles.chipTray}>
                    {selectedWorkflows.map((w) => (
                      <span key={w} className={styles.filterChip}>
                        <span>{w}</span>
                        <button
                          type="button"
                          className={styles.chipCloseBtn}
                          onClick={() => handleToggleWorkflow(w)}
                          title={`Remove ${w}`}
                        >
                          <FiX size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Field 2: Workflow ID */}
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  <span>Workflow ID</span>
                  {workflowIdQuery ? <span className={styles.fieldBadge}>Set</span> : null}
                </div>
                <div className={styles.inputControl}>
                  <FiSearch size={14} color="var(--color-fg-muted)" />
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Workflow ID (e.g. asd)..."
                    value={workflowIdQuery}
                    onChange={(e) => setWorkflowIdQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApplySearch();
                    }}
                  />
                  {workflowIdQuery ? (
                    <button
                      type="button"
                      className={styles.clearIconBtn}
                      onClick={() => setWorkflowIdQuery("")}
                      title="Clear Workflow ID"
                    >
                      <FiX size={13} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Field 3: Status [multi select] */}
              <div className={styles.fieldGroup} ref={statusDropdownRef}>
                <div className={styles.fieldLabel}>
                  <span>Status</span>
                  {selectedStatuses.length > 0 ? (
                    <span className={styles.fieldBadge}>{selectedStatuses.length} selected</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={styles.selectTrigger}
                  onClick={() => setStatusDropdownOpen((o) => !o)}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedStatuses.length === 0
                      ? "All statuses..."
                      : `${selectedStatuses.length} status${selectedStatuses.length > 1 ? "es" : ""} selected`}
                  </span>
                  <FiChevronDown size={14} color="var(--color-fg-muted)" />
                </button>

                {statusDropdownOpen ? (
                  <div className={styles.dropdownPopover}>
                    <div className={styles.dropdownList} style={{ maxHeight: 220 }}>
                      {STATUS_OPTIONS.map((status) => {
                        const isSelected = selectedStatuses.includes(status);
                        return (
                          <div
                            key={status}
                            className={`${styles.dropdownItem} ${isSelected ? styles.selected : ""}`}
                            onClick={() => handleToggleStatus(status)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: "pointer", accentColor: "var(--color-accent-fg)" }}
                            />
                            <span>{status}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.dropdownFooter}>
                      <button
                        type="button"
                        className={styles.dropdownActionBtn}
                        onClick={() => setSelectedStatuses([...STATUS_OPTIONS])}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className={styles.dropdownActionBtn}
                        onClick={() => setSelectedStatuses([])}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Selected status chips tray */}
                {selectedStatuses.length > 0 ? (
                  <div className={styles.chipTray}>
                    {selectedStatuses.map((s) => (
                      <span key={s} className={styles.filterChip}>
                        <span>{s}</span>
                        <button
                          type="button"
                          className={styles.chipCloseBtn}
                          onClick={() => handleToggleStatus(s)}
                          title={`Remove ${s}`}
                        >
                          <FiX size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Field 4: Correlation ID [multi select] */}
              <div className={styles.fieldGroup} ref={corrDropdownRef}>
                <div className={styles.fieldLabel}>
                  <span>Correlation ID</span>
                  {selectedCorrelationIds.length > 0 ? (
                    <span className={styles.fieldBadge}>{selectedCorrelationIds.length} added</span>
                  ) : null}
                </div>
                <div className={styles.inputControl}>
                  <input
                    type="text"
                    className={styles.textInput}
                    placeholder="Type ID and press Enter..."
                    value={correlationIdInput}
                    onChange={(e) => setCorrelationIdInput(e.target.value)}
                    onFocus={() => {
                      if (availableCorrelationIds.length > 0) setCorrDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddCorrelationId();
                      }
                    }}
                  />
                  {correlationIdInput ? (
                    <button
                      type="button"
                      className={styles.clearIconBtn}
                      onClick={handleAddCorrelationId}
                      title="Add Correlation ID"
                    >
                      <FiPlus size={14} color="var(--color-accent-fg)" />
                    </button>
                  ) : availableCorrelationIds.length > 0 ? (
                    <button
                      type="button"
                      className={styles.clearIconBtn}
                      onClick={() => setCorrDropdownOpen((o) => !o)}
                      title="Show known correlation IDs"
                    >
                      <FiChevronDown size={14} />
                    </button>
                  ) : null}
                </div>

                {/* Suggestion popover for known correlation IDs */}
                {corrDropdownOpen && availableCorrelationIds.length > 0 ? (
                  <div className={styles.dropdownPopover}>
                    <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "var(--color-fg-muted)", borderBottom: "1px solid var(--color-border-default)" }}>
                      Recent Correlation IDs:
                    </div>
                    <div className={styles.dropdownList} style={{ maxHeight: 160 }}>
                      {filteredCorrelationSuggestions
                        .map((cId) => {
                          const isSelected = selectedCorrelationIdSet.has(cId);
                          return (
                            <div
                              key={cId}
                              className={`${styles.dropdownItem} ${isSelected ? styles.selected : ""}`}
                              onClick={() => {
                                if (!isSelected) {
                                  setSelectedCorrelationIds((prev) => [...prev, cId]);
                                } else {
                                  handleRemoveCorrelationId(cId);
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ cursor: "pointer", accentColor: "var(--color-accent-fg)" }}
                              />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{cId}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : null}

                {/* Selected correlation ID chips tray */}
                {selectedCorrelationIds.length > 0 ? (
                  <div className={styles.chipTray}>
                    {selectedCorrelationIds.map((c) => (
                      <span key={c} className={styles.filterChip}>
                        <span>{c}</span>
                        <button
                          type="button"
                          className={styles.chipCloseBtn}
                          onClick={() => handleRemoveCorrelationId(c)}
                          title={`Remove ${c}`}
                        >
                          <FiX size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Custom Date Pickers inside Drawer */}
            {datePreset === "CUSTOM" ? (
              <div className={styles.customDateDrawerRow}>
                <div className={styles.customDateLabel}>
                  <FiCalendar size={13} />
                  <span>Custom Date Range Bounds:</span>
                </div>
                <div className={styles.customDatePickers}>
                  <div className={styles.dateInputWrapper}>
                    <span className={styles.dateLabelSmall}>From:</span>
                    <input
                      type="datetime-local"
                      className={styles.dateFieldInput}
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.dateInputWrapper}>
                    <span className={styles.dateLabelSmall}>To:</span>
                    <input
                      type="datetime-local"
                      className={styles.dateFieldInput}
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : null}


          </div>
        ) : null}
      </div>

      {/* 4. Main Table Card */}
      <div className={styles.tableCard}>
        {/* Status Filter Tabs Bar */}
        <div className={styles.filterBar}>
          <div className={styles.tabGroup}>
            {(["ALL", "RUNNING", "COMPLETED", "FAILED", "PAUSED"] as const).map((tab) => {
              const count =
                tab === "ALL"
                  ? totalHits
                  : tab === "RUNNING"
                  ? kpiStats.running
                  : tab === "COMPLETED"
                  ? kpiStats.completed
                  : tab === "FAILED"
                  ? kpiStats.failed
                  : kpiStats.paused;
              const isActive =
                tab === "ALL"
                  ? selectedStatuses.length === 0
                  : tab === "FAILED"
                  ? selectedStatuses.includes("FAILED")
                  : selectedStatuses.includes(tab) && selectedStatuses.length === 1;

              return (
                <button
                  key={tab}
                  type="button"
                  className={`${styles.filterTab} ${isActive ? styles.active : ""}`}
                  onClick={() => handleKpiCardClick(tab)}
                >
                  <span>{tab === "ALL" ? "All Runs" : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                  <span className={`${styles.tabBadge} ${isActive ? styles.activeBadge : ""}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.resultCount}>
            Showing <strong>{rows.length}</strong> of {totalHits} executions
          </div>
        </div>

        {/* Table Content */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyContainer}>
              <FiRefreshCw size={28} className={styles.spinning} style={{ color: "var(--color-accent-fg)", marginBottom: 12 }} />
              <div className={styles.emptyTitle}>Searching Executions...</div>
              <div className={styles.emptySubtitle}>Fetching orchestration telemetry from Conductor search service.</div>
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.emptyContainer}>
              <FiSliders className={styles.emptyIcon} />
              <div className={styles.emptyTitle}>No matching executions found</div>
              <div className={styles.emptySubtitle}>
                {appliedQuery
                  ? `No runs matched your query: ${appliedQuery}`
                  : "No workflow executions found in this category."}
              </div>
              {appliedQuery || selectedStatuses.length > 0 ? (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              ) : null}
            </div>
          ) : (
            <table
              className={styles.table}
              style={executionsQuery.isPlaceholderData ? { opacity: 0.6, transition: "opacity 120ms" } : undefined}
            >
              <thead>
                <tr>
                  <th className={styles.th}>Workflow</th>
                  <th className={styles.th} style={{ width: 140 }}>Workflow ID</th>
                  <th className={styles.th} style={{ width: 130 }}>Status</th>
                  <th className={styles.th}>Correlation ID</th>
                  <th className={styles.th}>Start Time</th>
                  <th className={styles.th} style={{ width: 110 }}>Duration</th>
                  <th className={styles.th} style={{ width: 100, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const wfId = row.workflowId || "";
                  const displayWfId = getDisplayWorkflowId(wfId);
                  const wfName = row.workflowName || row.workflowType || "Unknown Workflow";
                  const corrId = row.correlationId || (row as any).correlation_id || "";
                  const elapsedText = formatExecutionElapsed(row.startTime, row.endTime);
                  const version = row.workflowVersion ?? row.version;

                  return (
                    <tr key={wfId || `row-${rowIndex}`} className={styles.tr}>
                      {/* Workflow Name Link */}
                      <td className={styles.td}>
                        <Link
                          to={`/executions/${wfId}`}
                          className={styles.workflowNameLink}
                          title={`View execution details for ${wfName}`}
                        >
                          <span>{wfName}</span>
                          {version ? <span className={styles.versionChip}>v{version}</span> : null}
                        </Link>
                      </td>

                      {/* Workflow ID */}
                      <td className={styles.td}>
                        <span className={styles.cellMonospace} title={wfId}>
                          {displayWfId}
                        </span>
                      </td>

                      {/* Status */}
                      <td className={styles.td}>
                        {renderStatusPill(row.status)}
                      </td>

                      {/* Correlation ID */}
                      <td className={styles.td}>
                        {corrId ? (
                          <span className={styles.cellMonospace} title={corrId}>
                            {corrId}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-fg-muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Start Time */}
                      <td className={styles.td} style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {formatExecutionDateTime(row.startTime)}
                      </td>

                      {/* Duration */}
                      <td className={styles.td} style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {elapsedText}
                      </td>

                      {/* Actions */}
                      <td className={styles.td} style={{ textAlign: "right" }}>
                        <div className={styles.actionGroup} style={{ justifyContent: "flex-end" }}>
                          {/* Test in Workbench */}
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => handleTestInWorkbench(wfName, row.version)}
                            title="Test this workflow in Workbench"
                          >
                            <FiPlay size={11} />
                            <span>Workbench</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 5. Pagination Footer */}
        {!loading && totalHits > 0 ? (
          <div className={styles.paginationFooter}>
            <div className={styles.pageSizeGroup}>
              <span>Rows per page:</span>
              <select
                className={styles.pageSizeSelect}
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className={styles.pageInfo}>
              Showing {totalHits === 0 ? 0 : startOffset + 1}–
              {Math.min(startOffset + rows.length, totalHits)} of {totalHits}
            </div>

            <div className={styles.pageControls}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || startOffset <= 0}
                title="Previous page"
              >
                <FiChevronLeft size={14} />
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || startOffset + pageSize >= totalHits}
                title="Next page"
              >
                <FiChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
