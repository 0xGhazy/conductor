import { useMemo, type ReactNode } from "react";
import { buildExecutionTimeline, type ExecutionTimelineSegmentKind } from "@/features/monitoring/services/executionTimeline";
import { formatDurationMs, getExecutionTaskReferenceName } from "@/features/monitoring/services/executionsService";
import type { WorkflowExecutionTask } from "@/features/monitoring/types/executionTypes";
import styles from "./ExecutionTimeline.module.css";

export interface ExecutionTimelineProps {
  tasks: WorkflowExecutionTask[];
  workflowStartTime: unknown;
  workflowEndTime: unknown;
  renderStatus?: (status: string) => ReactNode;
}

const SEGMENT_LABELS: Record<ExecutionTimelineSegmentKind, string> = {
  execution: "Execution",
  queue: "Queue",
  gap: "Gap",
};

const SEGMENT_ORDER: ExecutionTimelineSegmentKind[] = ["execution", "queue", "gap"];

/** Task list with one bar per task showing its gap, queue and execution time on a shared axis. */
export function ExecutionTimeline({ tasks, workflowStartTime, workflowEndTime, renderStatus }: ExecutionTimelineProps) {
  const { rows, totalMs } = useMemo(
    () => buildExecutionTimeline(tasks, workflowStartTime, workflowEndTime),
    [tasks, workflowStartTime, workflowEndTime]
  );

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        <ul className={styles.legend} aria-label="Timeline legend">
          {SEGMENT_ORDER.map((kind) => (
            <li key={kind} className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles[kind]}`} aria-hidden="true" />
              {SEGMENT_LABELS[kind]} time
            </li>
          ))}
        </ul>
        <span className={styles.scale}>
          0ms — {formatDurationMs(totalMs)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>No executed tasks recorded for this workflow run.</p>
      ) : (
        <ol className={styles.list}>
          {rows.map((row, index) => {
            const refName = getExecutionTaskReferenceName(row.task) || `task_${index + 1}`;
            const status = String(row.task.status || "UNKNOWN").toUpperCase();
            const breakdown = `Execution ${formatDurationMs(row.executionMs)}, queue ${formatDurationMs(
              row.queueMs
            )}, gap ${formatDurationMs(row.gapMs)}`;

            return (
              <li key={row.task.taskId || `${refName}-${index}`} className={styles.row}>
                <div className={styles.meta}>
                  <span className={styles.step}>{index + 1}</span>
                  <div className={styles.metaText}>
                    <div className={styles.nameLine}>
                      <span className={styles.name} title={refName}>{refName}</span>
                      <span className={styles.type}>{row.task.taskType || row.task.taskDefName || "TASK"}</span>
                    </div>
                    {renderStatus ? renderStatus(status) : <span className={styles.type}>{status}</span>}
                  </div>
                </div>

                <div className={styles.track} role="img" aria-label={`${refName}: ${breakdown}`} title={breakdown}>
                  {row.segments.map((segment) => (
                    <span
                      key={segment.kind}
                      className={`${styles.segment} ${styles[segment.kind]}`}
                      style={{
                        left: `${(segment.startMs / totalMs) * 100}%`,
                        width: `${((segment.endMs - segment.startMs) / totalMs) * 100}%`,
                      }}
                    />
                  ))}
                </div>

                <dl className={styles.timings}>
                  {SEGMENT_ORDER.map((kind) => {
                    const value = kind === "execution" ? row.executionMs : kind === "queue" ? row.queueMs : row.gapMs;
                    return (
                      <div key={kind} className={styles.timing}>
                        <dt>
                          <span className={`${styles.swatch} ${styles[kind]}`} aria-hidden="true" />
                          {SEGMENT_LABELS[kind]}
                        </dt>
                        <dd>{formatDurationMs(value)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default ExecutionTimeline;
