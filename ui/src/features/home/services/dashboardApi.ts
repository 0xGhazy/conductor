import { useQuery } from "@tanstack/react-query";
import { config } from "@/config/appConfig";
import apiClient from "@/services/apiClient";
import type {
  DashboardData,
  ExecutionMetrics,
  StatusCount,
  TaskQueueInfo,
  TopWorkflowInfo,
  WorkerInfo,
} from "../types";

/**
 * Conductor Base URLs & Direct Endpoints
 * Primary APIs requested:
 *  - GET http://localhost:8080/api/tasks/queue/all
 *  - GET http://localhost:8080/api/tasks/queue/polldata/all
 *  - GET http://localhost:8080/health
 */
const WEAVER_BASE: string = config.weaverApiBaseUrl ?? "";
const WEAVER_BASE = config.apiBaseUrl || "";

export const DASHBOARD_ENDPOINTS = {
  queueAll: `${WEAVER_BASE}/api/tasks/queue/all`,
  queuePollDataAll: `${WEAVER_BASE}/api/tasks/queue/polldata/all`,
  conductorHealth: `${WEAVER_BASE}/health`,
  workflowSearch: `${WEAVER_BASE}/api/workflow/search`,
  weaverHealth: `${WEAVER_BASE}/health`,

  // Same-origin proxied fallbacks for environments with cross-origin restrictions
  fallbackQueueAll: "/api/tasks/queue/all",
  fallbackQueuePollDataAll: "/api/tasks/queue/polldata/all",
  fallbackConductorHealth: "/conductor-health",
  fallbackWorkflowSearch: "/api/workflow/search",
  fallbackWeaverHealth: "/health",
};

export const DEFAULT_RANGE_DAYS = 7;
export const DEFAULT_TOP_LIMIT = 10;
export const DEFAULT_REFETCH_INTERVAL_MS = 30000;
export const HEALTH_REFETCH_INTERVAL_MS = 10000;
export const DASHBOARD_STATUS_ORDER = [
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "TIMED_OUT",
  "TERMINATED",
  "FAILED",
];

const toNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

/**
 * Executes a GET request with automatic fallback to the proxied route if direct cross-origin fails.
 * In browser environments, if directUrl is cross-origin, it prefers the same-origin fallback first
 * to avoid browser-level CORS preflight rejections.
 */
async function fetchEndpoint<T>(directUrl: string, fallbackUrl?: string): Promise<T> {
  const isCrossOrigin =
    typeof window !== "undefined" &&
    directUrl.startsWith("http") &&
    !directUrl.startsWith(window.location.origin);

  const primaryUrl = isCrossOrigin && fallbackUrl ? fallbackUrl : directUrl;
  const secondaryUrl = primaryUrl === directUrl ? fallbackUrl : directUrl;

  try {
    const res = await apiClient.get<T>(primaryUrl, { timeout: 10000 });
    return res.data;
  } catch (primaryErr) {
    if (secondaryUrl && secondaryUrl !== primaryUrl) {
      try {
        const secondaryRes = await apiClient.get<T>(secondaryUrl, { timeout: 10000 });
        return secondaryRes.data;
      } catch {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
}

/**
 * Normalizes Conductor's task queue size map + poll data into TaskQueueInfo[]
 * Source: GET http://localhost:8080/api/tasks/queue/all
 * Intersected with: GET http://localhost:8080/api/tasks/queue/polldata/all
 */
export const normalizeTaskQueues = (
  queueMap: Record<string, number> = {},
  pollData: Array<{ queueName?: string }> = []
): TaskQueueInfo[] => {
  const activeWorkerQueues = new Set(
    (pollData || []).map((p) => String(p?.queueName || "").trim()).filter(Boolean)
  );

  const queues: TaskQueueInfo[] = [];
  const seenQueues = new Set<string>();

  if (queueMap && typeof queueMap === "object") {
    for (const [rawName, rawSize] of Object.entries(queueMap)) {
      const name = String(rawName || "").trim();
      if (!name) continue;
      seenQueues.add(name);

      const size = toNumber(rawSize, 0);
      const isInternal =
        name.startsWith("_") ||
        name.startsWith("conductor_") ||
        name.startsWith("search_");
      const hasRegisteredWorker = activeWorkerQueues.has(name);

      queues.push({
        name,
        size,
        registeredWorker: hasRegisteredWorker,
        internalQueue: isInternal,
      });
    }
  }

  // Include any worker queues present in poll data not yet in queueMap
  activeWorkerQueues.forEach((workerQueue) => {
    if (!seenQueues.has(workerQueue)) {
      queues.push({
        name: workerQueue,
        size: 0,
        registeredWorker: true,
        internalQueue:
          workerQueue.startsWith("_") ||
          workerQueue.startsWith("conductor_") ||
          workerQueue.startsWith("search_"),
      });
    }
  });

  // Sort: queues with backlog first (descending), then active worker queues, then name
  return queues.sort((a, b) => {
    if (b.size !== a.size) return b.size - a.size;
    if (b.registeredWorker !== a.registeredWorker) {
      return Number(b.registeredWorker) - Number(a.registeredWorker);
    }
    return a.name.localeCompare(b.name);
  });
};

/**
 * Normalizes worker poll data from Conductor
 * Source: GET http://localhost:8080/api/tasks/queue/polldata/all
 */
export const normalizeWorkers = (pollData: any[] = []): WorkerInfo[] => {
  if (!Array.isArray(pollData)) return [];

  const now = Date.now();
  // Group by queueName; keep track of active worker status and most recent poll time
  const workerMap = new Map<string, WorkerInfo>();

  pollData.forEach((item) => {
    const queueName = String(item?.queueName || "Unknown worker").trim();
    if (!queueName) return;

    const workerId = String(item?.workerId || "").trim();
    const lastPollTime = toNumber(item?.lastPollTime, 0);
    // Worker is considered active if it polled within the last 2 minutes
    const isRecentlyActive = lastPollTime > 0 && now - lastPollTime < 120000;

    const existing = workerMap.get(queueName);
    if (!existing) {
      workerMap.set(queueName, {
        name: queueName,
        workerId: workerId || undefined,
        lastPollTime: lastPollTime || undefined,
        threadCount: 1,
        registered: isRecentlyActive,
        configuredThreadCount: true,
      });
    } else {
      existing.threadCount = (existing.threadCount || 1) + 1;
      if (isRecentlyActive) {
        existing.registered = true;
      }
      if (lastPollTime > (existing.lastPollTime || 0)) {
        existing.lastPollTime = lastPollTime;
        if (workerId) existing.workerId = workerId;
      }
    }
  });

  // Sort active workers first, then by last poll time descending
  return Array.from(workerMap.values()).sort((a, b) => {
    if (b.registered !== a.registered) return Number(b.registered) - Number(a.registered);
    return (b.lastPollTime || 0) - (a.lastPollTime || 0);
  });
};

/**
 * Health normalizer for both Conductor (GET http://localhost:8080/health) and Weaver (/health)
 */
export const normalizeHealth = (payload: any, httpStatus?: number) => {
  const status = String(payload?.status || "").trim().toUpperCase();
  const hasSuccessfulHttpStatus = Number(httpStatus) >= 200 && Number(httpStatus) < 300;
  const healthy =
    payload?.healthy === true ||
    payload?.data?.healthy === true ||
    status === "UP" ||
    status === "OK" ||
    String(payload?.data?.status || "").trim().toUpperCase() === "UP" ||
    (hasSuccessfulHttpStatus && payload?.suppressedHealthResults !== undefined);

  return {
    healthy: Boolean(healthy),
    checkedAt: new Date().toISOString(),
  };
};

/**
 * Fetches Conductor health from GET http://localhost:8080/health
 */
export async function fetchConductorHealth() {
  try {
    const data = await fetchEndpoint<any>(
      DASHBOARD_ENDPOINTS.conductorHealth,
      DASHBOARD_ENDPOINTS.fallbackConductorHealth
    );
    return normalizeHealth(data, 200);
  } catch {
    return {
      healthy: false,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Fetches Weaver backend health
 */
export async function fetchWeaverHealth() {
  try {
    const data = await fetchEndpoint<any>(
      DASHBOARD_ENDPOINTS.weaverHealth,
      DASHBOARD_ENDPOINTS.fallbackWeaverHealth
    );
    return normalizeHealth(data, 200);
  } catch {
    return {
      healthy: false,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Generic health fetcher for backwards compatibility
 */
export async function fetchBackendHealth(url: string) {
  if (url.includes("conductor") || url.includes("8080")) {
    return fetchConductorHealth();
  }
  return fetchWeaverHealth();
}

/**
 * Health check hook querying Conductor (8080/health) and Weaver (health)
 */
export function useBackendHealthChecks({
  refetchIntervalMs = HEALTH_REFETCH_INTERVAL_MS,
} = {}) {
  const weaver = useQuery({
    queryKey: ["dashboard", "health", "weaver"],
    queryFn: () => fetchWeaverHealth(),
    refetchInterval: refetchIntervalMs,
    retry: false,
    staleTime: 5000,
  });

  const conductor = useQuery({
    queryKey: ["dashboard", "health", "conductor"],
    queryFn: () => fetchConductorHealth(),
    refetchInterval: refetchIntervalMs,
    retry: false,
    staleTime: 5000,
  });

  return { weaver, conductor };
}

/**
 * Fetches Conductor task queue size map from GET http://localhost:8080/api/tasks/queue/all
 */
export async function fetchTaskQueues(): Promise<Record<string, number>> {
  try {
    const data = await fetchEndpoint<Record<string, number>>(
      DASHBOARD_ENDPOINTS.queueAll,
      DASHBOARD_ENDPOINTS.fallbackQueueAll
    );
    if (data && typeof data === "object") {
      return data;
    }
    return {};
  } catch (err) {
    console.warn("Failed to fetch task queues from Conductor API", err);
    return {};
  }
}

/**
 * Fetches Conductor poll data from GET http://localhost:8080/api/tasks/queue/polldata/all
 */
export async function fetchQueuePollData(): Promise<any[]> {
  try {
    const data = await fetchEndpoint<any[]>(
      DASHBOARD_ENDPOINTS.queuePollDataAll,
      DASHBOARD_ENDPOINTS.fallbackQueuePollDataAll
    );
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray((data as any)?.data)) {
      return (data as any).data;
    }
    return [];
  } catch (err) {
    console.warn("Failed to fetch queue polldata from Conductor API", err);
    return [];
  }
}

/**
 * Queries Conductor workflow search for the execution window
 */
export async function fetchWorkflowExecutions(
  from?: string,
  to?: string,
  limit = 250
): Promise<any[]> {
  const queryParams = new URLSearchParams();
  queryParams.set("start", "0");
  queryParams.set("size", String(limit));
  queryParams.set("sort", "startTime:DESC");

  const fromMs = from ? new Date(from).getTime() : NaN;
  const toMs = to ? new Date(to).getTime() : NaN;

  if (!Number.isNaN(fromMs) && !Number.isNaN(toMs)) {
    queryParams.set("query", `startTime > ${fromMs} AND startTime < ${toMs}`);
  } else if (!Number.isNaN(fromMs)) {
    queryParams.set("query", `startTime > ${fromMs}`);
  } else {
    queryParams.set("freeText", "*");
  }

  try {
    const searchUrl = `${DASHBOARD_ENDPOINTS.workflowSearch}?${queryParams.toString()}`;
    const fallbackUrl = `${DASHBOARD_ENDPOINTS.fallbackWorkflowSearch}?${queryParams.toString()}`;
    const data = await fetchEndpoint<any>(searchUrl, fallbackUrl);

    if (Array.isArray(data?.results)) {
      return data.results;
    }
    if (Array.isArray(data?.data?.results)) {
      return data.data.results;
    }
    return [];
  } catch (err) {
    console.warn("Failed to fetch workflow executions for dashboard telemetry", err);
    return [];
  }
}

export interface FetchDashboardSummaryParams {
  rangeDays?: number;
  topLimit?: number;
  from?: string;
  to?: string;
}

/**
 * Aggregates live cluster data using:
 *  - GET http://localhost:8080/api/tasks/queue/all
 *  - GET http://localhost:8080/api/tasks/queue/polldata/all
 *  - GET http://localhost:8080/api/workflow/search
 */
export async function fetchDashboardSummary({
  topLimit = DEFAULT_TOP_LIMIT,
  from,
  to,
}: FetchDashboardSummaryParams = {}): Promise<DashboardData> {
  const [queuesResult, pollDataResult, workflowResults] = await Promise.allSettled([
    fetchTaskQueues(),
    fetchQueuePollData(),
    fetchWorkflowExecutions(from, to, 250),
  ]);

  const queueMap = queuesResult.status === "fulfilled" ? queuesResult.value : {};
  const pollData = pollDataResult.status === "fulfilled" ? pollDataResult.value : [];
  const workflows = workflowResults.status === "fulfilled" ? workflowResults.value : [];

  // 1. Process Task Queues & Workers
  const taskQueues = normalizeTaskQueues(queueMap, pollData);
  const workers = normalizeWorkers(pollData);

  // 2. Process Workflow Executions Telemetry
  const statusCounts: Record<string, number> = {
    RUNNING: 0,
    PAUSED: 0,
    COMPLETED: 0,
    TIMED_OUT: 0,
    TERMINATED: 0,
    FAILED: 0,
  };

  const workflowGroups = new Map<
    string,
    { executionCount: number; completedCount: number; failedCount: number }
  >();

  workflows.forEach((wf: any) => {
    const rawStatus = String(wf?.status || "").toUpperCase();
    if (Object.prototype.hasOwnProperty.call(statusCounts, rawStatus)) {
      statusCounts[rawStatus]++;
    }

    const wfName = String(wf?.workflowType || wf?.workflowName || "Unknown workflow").trim();
    const group = workflowGroups.get(wfName) || {
      executionCount: 0,
      completedCount: 0,
      failedCount: 0,
    };
    group.executionCount++;
    if (rawStatus === "COMPLETED") group.completedCount++;
    if (rawStatus === "FAILED" || rawStatus === "TIMED_OUT" || rawStatus === "TERMINATED") {
      group.failedCount++;
    }
    workflowGroups.set(wfName, group);
  });

  const total = workflows.length;
  const completed = statusCounts.COMPLETED;
  const failed = statusCounts.FAILED + statusCounts.TIMED_OUT + statusCounts.TERMINATED;
  const running = statusCounts.RUNNING;
  const successRate = total > 0 ? (completed / total) * 100 : 100;

  const executions: ExecutionMetrics = {
    total,
    completed,
    failed,
    running,
    successRate: Math.round(successRate * 10) / 10,
  };

  const statuses: StatusCount[] = DASHBOARD_STATUS_ORDER.map((status) => ({
    status,
    count: statusCounts[status] || 0,
  }));

  const topWorkflows: TopWorkflowInfo[] = Array.from(workflowGroups.entries())
    .map(([workflowName, g]) => ({
      workflowName,
      executionCount: g.executionCount,
      completedCount: g.completedCount,
      failedCount: g.failedCount,
      successRate:
        g.executionCount > 0
          ? Math.round((g.completedCount / g.executionCount) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, topLimit);

  return {
    executions,
    statuses,
    workers,
    taskQueues,
    topWorkflows,
    generatedAt: new Date().toISOString(),
    from: from || null,
    to: to || null,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves a dashboard range preset to concrete ISO bounds at call time
 */
export function computeDashboardRange(
  preset: string,
  customFrom?: string,
  customTo?: string
): { fromIso: string | null; toIso: string | null } {
  const now = new Date();
  if (preset === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return { fromIso: startOfDay.toISOString(), toIso: now.toISOString() };
  }
  if (preset === "24h") {
    return { fromIso: new Date(now.getTime() - DAY_MS).toISOString(), toIso: now.toISOString() };
  }
  if (preset === "7d") {
    return { fromIso: new Date(now.getTime() - 7 * DAY_MS).toISOString(), toIso: now.toISOString() };
  }
  if (preset === "30d") {
    return { fromIso: new Date(now.getTime() - 30 * DAY_MS).toISOString(), toIso: now.toISOString() };
  }

  // Custom
  const fromDate = new Date(customFrom ?? "");
  const toDate = new Date(customTo ?? "");
  return {
    fromIso: !Number.isNaN(fromDate.getTime()) ? fromDate.toISOString() : null,
    toIso: !Number.isNaN(toDate.getTime()) ? toDate.toISOString() : null,
  };
}

export interface UseDashboardSummaryOptions extends FetchDashboardSummaryParams {
  preset?: string;
  customFrom?: string;
  customTo?: string;
  refetchIntervalMs?: number;
  enabled?: boolean;
}

export function useDashboardSummary({
  rangeDays = DEFAULT_RANGE_DAYS,
  topLimit = DEFAULT_TOP_LIMIT,
  from,
  to,
  preset,
  customFrom,
  customTo,
  refetchIntervalMs = DEFAULT_REFETCH_INTERVAL_MS,
  enabled = true,
}: UseDashboardSummaryOptions = {}) {
  const isCustomPreset = preset === "custom";
  const queryKey = preset
    ? [
        "dashboard",
        "summary",
        topLimit,
        preset,
        isCustomPreset ? customFrom || null : null,
        isCustomPreset ? customTo || null : null,
      ]
    : ["dashboard", "summary", rangeDays, topLimit, from || null, to || null];

  return useQuery({
    queryKey,
    queryFn: () => {
      if (preset) {
        const { fromIso, toIso } = computeDashboardRange(preset, customFrom, customTo);
        return fetchDashboardSummary({
          rangeDays,
          topLimit,
          from: fromIso || undefined,
          to: toIso || undefined,
        });
      }
      return fetchDashboardSummary({ rangeDays, topLimit, from, to });
    },
    enabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: refetchIntervalMs,
    staleTime: 15000,
  });
}
