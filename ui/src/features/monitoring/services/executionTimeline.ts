import type { WorkflowExecutionTask } from "@/features/monitoring/types/executionTypes";
import { toExecutionEpochMs } from "./executionsService";

export type ExecutionTimelineSegmentKind = "gap" | "queue" | "execution";

/** A span of one task's lifecycle, as offsets (ms) from the workflow start. */
export interface ExecutionTimelineSegment {
  kind: ExecutionTimelineSegmentKind;
  startMs: number;
  endMs: number;
}

export interface ExecutionTimelineRow {
  task: WorkflowExecutionTask;
  /** Idle time since the previous task finished, before this one was scheduled. */
  gapMs: number;
  /** Time between being scheduled and being picked up by a worker. */
  queueMs: number;
  /** Time the worker spent running the task. */
  executionMs: number;
  segments: ExecutionTimelineSegment[];
}

export interface ExecutionTimelineData {
  rows: ExecutionTimelineRow[];
  totalMs: number;
}

const getScheduledMs = (task: WorkflowExecutionTask): number =>
  toExecutionEpochMs(task.scheduledTime) || toExecutionEpochMs(task.startTime);

/**
 * Splits every task into gap (gray), queue (orange) and execution (green) segments on a shared
 * time axis. Unfinished spans run until the workflow end, or `nowMs` while it is still running.
 */
export const buildExecutionTimeline = (
  tasks: WorkflowExecutionTask[] = [],
  workflowStartTime: unknown,
  workflowEndTime: unknown,
  nowMs: number = Date.now()
): ExecutionTimelineData => {
  const ordered = [...tasks].sort(
    (a, b) => getScheduledMs(a) - getScheduledMs(b) || Number(a.seq ?? 0) - Number(b.seq ?? 0)
  );
  const firstScheduled = ordered.map(getScheduledMs).find((ms) => ms > 0) ?? 0;
  const originMs = toExecutionEpochMs(workflowStartTime) || firstScheduled || nowMs;
  const capMs = toExecutionEpochMs(workflowEndTime) || nowMs;

  let previousEndMs = originMs;
  let latestMs = capMs;

  const rows = ordered.map((task): ExecutionTimelineRow => {
    const scheduledMs = getScheduledMs(task);
    if (!scheduledMs) {
      return { task, gapMs: 0, queueMs: 0, executionMs: 0, segments: [] };
    }

    const startMs = toExecutionEpochMs(task.startTime);
    const queueEndMs = startMs || Math.max(scheduledMs, capMs);
    const endMs = startMs ? toExecutionEpochMs(task.endTime) || Math.max(startMs, capMs) : 0;

    const gapMs = Math.max(0, scheduledMs - previousEndMs);
    const queueMs = Math.max(0, queueEndMs - scheduledMs);
    const executionMs = startMs ? Math.max(0, endMs - startMs) : 0;

    const segments: ExecutionTimelineSegment[] = [];
    const offset = (ms: number) => ms - originMs;
    if (gapMs > 0) segments.push({ kind: "gap", startMs: offset(previousEndMs), endMs: offset(scheduledMs) });
    if (queueMs > 0) segments.push({ kind: "queue", startMs: offset(scheduledMs), endMs: offset(queueEndMs) });
    if (startMs) segments.push({ kind: "execution", startMs: offset(startMs), endMs: offset(endMs) });

    const taskEndMs = endMs || queueEndMs;
    previousEndMs = Math.max(previousEndMs, taskEndMs);
    latestMs = Math.max(latestMs, taskEndMs);

    return { task, gapMs, queueMs, executionMs, segments };
  });

  return { rows, totalMs: Math.max(1, latestMs - originMs) };
};
