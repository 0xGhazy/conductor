import { useEffect, useMemo, useState, useCallback } from "react";
import { computeDashboardRange, useDashboardSummary, useBackendHealthChecks } from "@/features/home";
import { getErrorMessage } from "@/utils/error";
import { DashboardHeader, KpiRibbon, StatusDistributionCard, QueueDepthCard, TopWorkflowsCard, WorkerPoolCard, DashboardSkeleton } from "@/features/home";
import type { PresetRangeKey } from "@/features/home";
import styles from "./HomeDashboardPage.module.css";

const DEFAULT_AUTO_REFRESH_MS = 30000;

const padDatePart = (val: number) => String(val).padStart(2, "0");

const toDateTimeLocalValue = (date: Date) => {
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    "-",
    padDatePart(date.getMonth() + 1),
    "-",
    padDatePart(date.getDate()),
    "T",
    padDatePart(date.getHours()),
    ":",
    padDatePart(date.getMinutes()),
  ].join("");
};

const createDefaultCustomRange = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    from: toDateTimeLocalValue(from),
    to: toDateTimeLocalValue(to),
  };
};

export default function HomeDashboardPage() {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  const [preset, setPreset] = useState<PresetRangeKey>("7d");
  const [customDates, setCustomDates] = useState(createDefaultCustomRange);
  const [autoRefreshMs, setAutoRefreshMs] = useState(DEFAULT_AUTO_REFRESH_MS);

  // Dashboard Telemetry API Query: keyed on the preset (custom bounds only for "custom");
  // the concrete from/to window is computed inside the query function on every fetch.
  const isCustomRange = preset === "custom";
  const customRangeValid = useMemo(() => {
    if (!isCustomRange) return true;
    const { fromIso, toIso } = computeDashboardRange("custom", customDates.from, customDates.to);
    return Boolean(fromIso && toIso && new Date(fromIso).getTime() <= new Date(toIso).getTime());
  }, [isCustomRange, customDates.from, customDates.to]);

  const dashboardQuery = useDashboardSummary({
    rangeDays: 7,
    topLimit: 10,
    preset,
    customFrom: isCustomRange ? customDates.from : undefined,
    customTo: isCustomRange ? customDates.to : undefined,
    refetchIntervalMs: autoRefreshMs > 0 ? autoRefreshMs : undefined,
    enabled: customRangeValid,
  });

  // Health Checks
  const { weaver: weaverHealth, conductor: conductorHealth } = useBackendHealthChecks();

  const isInitialLoading = dashboardQuery.isLoading && !dashboardQuery.data;
  const isRefreshing = dashboardQuery.isFetching && !isInitialLoading;

  const data = dashboardQuery.data;
  const executions = useMemo(
    () =>
      data?.executions || {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        successRate: 0,
      },
    [data?.executions]
  );
  const statuses = useMemo(() => data?.statuses || [], [data?.statuses]);
  const workers = useMemo(() => data?.workers || [], [data?.workers]);
  const taskQueues = useMemo(() => data?.taskQueues || [], [data?.taskQueues]);
  const topWorkflows = useMemo(() => data?.topWorkflows || [], [data?.topWorkflows]);

  const activeQueuesCount = useMemo(
    () => taskQueues.filter((q) => (q.size || 0) > 0).length,
    [taskQueues]
  );

  // Range used by drill-down links; follows the window of the latest fetch.
  const dataUpdatedAt = dashboardQuery.dataUpdatedAt;
  const dateFilterParams = useMemo(() => {
    const { fromIso, toIso } = computeDashboardRange(preset, customDates.from, customDates.to);
    return { from: fromIso, to: toIso };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute rolling window after each fetch
  }, [preset, customDates.from, customDates.to, dataUpdatedAt]);

  const handleCustomDateChange = useCallback((field: "from" | "to", val: string) => {
    setCustomDates((prev) => ({ ...prev, [field]: val }));
  }, []);

  const { refetch: refetchDashboard } = dashboardQuery;
  const { refetch: refetchWeaverHealth } = weaverHealth;
  const { refetch: refetchConductorHealth } = conductorHealth;
  const handleManualRefresh = useCallback(() => {
    refetchDashboard();
    refetchWeaverHealth();
    refetchConductorHealth();
  }, [refetchDashboard, refetchWeaverHealth, refetchConductorHealth]);

  const errorMessage = useMemo(() => {
    if (!dashboardQuery.error) return null;
    return getErrorMessage(dashboardQuery.error, "Failed to fetch cluster dashboard telemetry.");
  }, [dashboardQuery.error]);

  return (
    <main className={styles.pageContainer}>
      {/* Top Bar Header & Filter Controls */}
      <DashboardHeader
        preset={preset}
        onPresetChange={setPreset}
        customDates={customDates}
        onCustomDateChange={handleCustomDateChange}
        autoRefreshMs={autoRefreshMs}
        onAutoRefreshChange={setAutoRefreshMs}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        lastGeneratedAt={data?.generatedAt || null}
        isConductorHealthy={Boolean(conductorHealth.data?.healthy ?? true)}
        isWeaverHealthy={Boolean(weaverHealth.data?.healthy ?? true)}
      />

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => dashboardQuery.refetch()}
          >
            Retry Telemetry
          </button>
        </div>
      )}

      {/* Main Dashboard Workspace Content */}
      {isInitialLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Tier 1: Telemetry KPI Ribbon */}
          <KpiRibbon
            metrics={executions}
            activeQueuesCount={activeQueuesCount}
            dateFilterParams={dateFilterParams}
          />

          {/* Tier 2: Operational Health & Queue Backlog */}
          <div className={styles.tierSplit2}>
            <StatusDistributionCard
              statuses={statuses}
              totalExecutions={executions.total}
              dateFilterParams={dateFilterParams}
            />
            <QueueDepthCard queues={taskQueues} />
          </div>

          {/* Tier 3: Workload & Worker Infrastructure */}
          <div className={styles.tierSplit3}>
            <TopWorkflowsCard
              workflows={topWorkflows}
              dateFilterParams={dateFilterParams}
            />
            <WorkerPoolCard workers={workers} />
          </div>
        </>
      )}
    </main>
  );
}
