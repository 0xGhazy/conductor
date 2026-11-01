import { useCallback } from "react";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { getErrorMessage } from "@/utils/error";
import { fetchTaskExecutionLogs } from "@/features/monitoring/services/executionsApi";
import {
  getExecutionTaskReferenceName,
  parseTaskLogLine,
  toExecutionEpochMs,
} from "@/features/monitoring/services/executionsService";
import type { ParsedTaskLogLine, WorkflowExecutionTask } from "@/features/monitoring/types/executionTypes";

const TASK_LOGS_QUERY_ROOT = "executionTaskLogs";

const TERMINAL_TASK_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "FAILED_WITH_TERMINAL_ERROR",
  "TIMED_OUT",
  "CANCELED",
  "SKIPPED",
]);

const EMPTY_LOGS: ParsedTaskLogLine[] = [];

interface CombinedLogsResult {
  logs: ParsedTaskLogLine[];
  loading: boolean;
  errorMessage: string;
}

/** Merges per-task log queries into one chronologically sorted list (stable function => memoized by react-query). */
const combineTaskLogs = (results: UseQueryResult<ParsedTaskLogLine[]>[]): CombinedLogsResult => {
  if (results.length === 0) {
    return { logs: EMPTY_LOGS, loading: false, errorMessage: "" };
  }
  const merged: ParsedTaskLogLine[] = [];
  let anyFailed = false;
  let firstError: unknown = null;
  let loading = false;

  for (const res of results) {
    if (res.isFetching) loading = true;
    if (res.data) merged.push(...res.data);
    if (res.isError) {
      anyFailed = true;
      if (!firstError) firstError = res.error;
    }
  }

  // Chronological sort: by timestamp epoch (stable, so per-task order is preserved for ties)
  merged.sort((a, b) => toExecutionEpochMs(a.timestamp) - toExecutionEpochMs(b.timestamp));

  let errorMessage = "";
  if (anyFailed && merged.length === 0) {
    errorMessage =
      results.every((r) => r.isError) && firstError
        ? getErrorMessage(firstError, "Some task logs could not be retrieved from the agent service.")
        : "Some task logs could not be retrieved from the agent service.";
  }

  return { logs: merged, loading, errorMessage };
};

/**
 * Loads and aggregates worker logs from all executed tasks in a workflow execution run.
 * Fetches when `enabled` is true (e.g. when the user switches to the workflow Logs tab).
 *
 * Each task's logs are cached individually, keyed on the task id plus its own
 * status/updateTime, so polling the execution only refetches tasks that actually changed.
 * Non-terminal tasks additionally follow the workflow `revision`, so in-flight task logs
 * stay current. `reload()` refetches every task's logs.
 */
export const useWorkflowExecutionLogs = (
  tasks: WorkflowExecutionTask[] = [],
  enabled: boolean = true,
  revision?: unknown
) => {
  const queryClient = useQueryClient();

  const getLatestCachedTaskLogs = (taskId: string): ParsedTaskLogLine[] | undefined => {
    let latest: { updatedAt: number; data: ParsedTaskLogLine[] } | undefined;
    for (const query of queryClient.getQueryCache().findAll({ queryKey: [TASK_LOGS_QUERY_ROOT, taskId] })) {
      const data = query.state.data as ParsedTaskLogLine[] | undefined;
      if (data && (!latest || query.state.dataUpdatedAt > latest.updatedAt)) {
        latest = { updatedAt: query.state.dataUpdatedAt, data };
      }
    }
    return latest?.data;
  };

  const descriptors = tasks
    .map((t) => {
      const id = ((t as any).taskExecutionId || t.taskId || (t as any).id) as string | undefined;
      const refName = getExecutionTaskReferenceName(t) || id || "task";
      return { task: t, id, refName };
    })
    .filter((item): item is { task: WorkflowExecutionTask; id: string; refName: string } => Boolean(item.id));

  const { logs, loading, errorMessage } = useQueries({
    queries: descriptors.map(({ task, id, refName }) => {
      const status = String(task.status || "").toUpperCase();
      const isTerminal = TERMINAL_TASK_STATUSES.has(status);
      const taskRevision = `${status}|${String(task.updateTime ?? task.endTime ?? "")}${
        isTerminal ? "" : `|${String(revision ?? "")}`
      }`;
      const taskName = task.taskDefName || task.taskType || "Task";
      const taskType = task.taskType || task.taskDefName || "Task";
      return {
        queryKey: [TASK_LOGS_QUERY_ROOT, id, refName, taskRevision],
        queryFn: async () => {
          const entries = await fetchTaskExecutionLogs(id);
          return entries.map((entry) => parseTaskLogLine(entry, refName, taskName, taskType));
        },
        enabled,
        staleTime: Infinity,
        // While a changed task refetches, keep showing its last known logs (from any revision).
        placeholderData: () => getLatestCachedTaskLogs(id),
        retry: false,
      };
    }),
    combine: combineTaskLogs,
  });

  const reload = useCallback(() => {
    void queryClient.refetchQueries({ queryKey: [TASK_LOGS_QUERY_ROOT], type: "active" });
  }, [queryClient]);

  return { logs, loading, errorMessage, reload };
};

export default useWorkflowExecutionLogs;
