import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/utils/error";
import { fetchTaskExecutionLogs } from "@/features/monitoring/services/executionsApi";
import { parseTaskLogLine } from "@/features/monitoring/services/executionsService";
import type { ParsedTaskLogLine } from "@/features/monitoring/types/executionTypes";

/**
 * Loads the worker log lines of a task execution.
 * Fetches when `enabled` is true (e.g. when the user clicks the Logs tab).
 * `revision` (e.g. the task's updateTime) triggers a reload, so logs stay current.
 */
export const useTaskExecutionLogs = (
  taskId: string | undefined,
  enabled: boolean = true,
  revision?: unknown
) => {
  const [logs, setLogs] = useState<ParsedTaskLogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!taskId || !enabled) {
      if (!taskId) setLogs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMessage("");

    fetchTaskExecutionLogs(taskId)
      .then((entries) => {
        if (!cancelled) setLogs(entries.map((entry) => parseTaskLogLine(entry)));
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(getErrorMessage(error, "Failed to load task logs."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, enabled, revision, reloadKey]);

  return { logs, loading, errorMessage, reload };
};
