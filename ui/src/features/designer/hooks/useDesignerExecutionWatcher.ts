import { useEffect, useRef } from "react";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import { fetchWorkflowExecutionStatus } from "@/features/designer/services/designerApi";

const parseRefreshIntervalMs = (intervalStr?: string): number => {
  if (!intervalStr) return 2000;
  const num = parseInt(intervalStr, 10);
  if (isNaN(num) || num <= 0) return 2000;
  if (intervalStr.endsWith("s")) return num * 1000;
  if (intervalStr.endsWith("m")) return num * 60000;
  return num * 1000;
};

/**
 * Monitors live workflow execution progress directly from Conductor /api/workflow/{workflowId}.
 * Synchronizes task statuses, durations, and completion states to the execution store.
 */
export function useDesignerExecutionWatcher() {
  const status = useWorkflowExecutionStore((state) => state.status);
  const workflowId = useWorkflowExecutionStore((state) => state.workflowId);
  const startTime = useWorkflowExecutionStore((state) => state.startTime);
  const refreshEvery = useWorkflowExecutionStore((state) => state.options.refreshEvery);
  const updateExecutionProgress = useWorkflowExecutionStore(
    (state) => state.updateExecutionProgress
  );

  const isPollingRef = useRef(false);

  useEffect(() => {
    // Only poll when actively running or paused
    if (!workflowId || (status !== "running" && status !== "paused")) {
      return;
    }

    const intervalMs = parseRefreshIntervalMs(refreshEvery);

    const pollExecution = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const data = await fetchWorkflowExecutionStatus(workflowId);
        if (!data) return;

        const conductorStatus = String(data?.status || "").toUpperCase();
        const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
        const rawEndTime = data?.endTime ? Number(data.endTime) : undefined;
        const rawStartTime = data?.startTime ? Number(data.startTime) : startTime;
        const durationMs =
          rawEndTime && rawStartTime && rawEndTime >= rawStartTime
            ? rawEndTime - rawStartTime
            : undefined;

        let mappedStatus: "running" | "paused" | "completed" | "failed" | "terminated" = "running";

        if (conductorStatus === "COMPLETED") {
          mappedStatus = "completed";
        } else if (conductorStatus === "FAILED" || conductorStatus === "TIMED_OUT") {
          mappedStatus = "failed";
        } else if (conductorStatus === "PAUSED") {
          mappedStatus = "paused";
        } else if (conductorStatus === "TERMINATED") {
          mappedStatus = "terminated";
        } else {
          mappedStatus = "running";
        }

        updateExecutionProgress({
          status: mappedStatus,
          workflowId,
          tasks,
          endTime: rawEndTime,
          durationMs,
          errorMessage: data?.reasonForIncompletion || undefined,
        });
      } catch (err) {
        // Soft-fail polling to tolerate temporary network blips
        console.warn("[ExecutionWatcher] Poll tick failed:", err);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Immediate first tick
    pollExecution();

    const interval = setInterval(pollExecution, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [workflowId, status, startTime, refreshEvery, updateExecutionProgress]);
}
