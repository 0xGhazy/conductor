import { useMemo, useState, type ReactNode } from "react";
import { FiCheck, FiCopy, FiX } from "react-icons/fi";
import { WeaverCodeEditor } from "@/components/common/editors";
import {
  formatDurationMs,
  formatExecutionParams,
  formatExecutionTimestamp,
  getExecutionTaskDurationMs,
  getExecutionTaskReferenceName,
} from "@/features/monitoring/services/executionsService";
import type { WorkflowExecutionTask } from "@/features/monitoring/types/executionTypes";
import styles from "./ExecutionTaskDetails.module.css";

type TaskDetailsTabId = "summary" | "input" | "output" | "definition";

const TABS: Array<{ id: TaskDetailsTabId; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
  { id: "definition", label: "Definition" },
];

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  wordWrap: "on",
} as const;

export interface ExecutionTaskDetailsProps {
  /** Reference name of the clicked node; shown even when the task never ran. */
  referenceName: string;
  task?: WorkflowExecutionTask;
  onClose: () => void;
  renderStatus?: (status: string) => ReactNode;
}

const display = (value: unknown): string =>
  value === undefined || value === null || value === "" ? "—" : String(value);

const displayMs = (value: unknown): string => {
  const ms = Number(value);
  return Number.isFinite(ms) && ms >= 0 ? formatDurationMs(ms) : "—";
};

function JsonView({ value, label }: { value: unknown; label: string }) {
  const text = useMemo(() => formatExecutionParams(value), [value]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.jsonView}>
      <div className={styles.jsonToolbar}>
        <span>{label}</span>
        <button type="button" className={styles.iconButton} onClick={handleCopy} title={`Copy ${label}`}>
          {copied ? <FiCheck size={12} color="var(--color-status-success)" /> : <FiCopy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className={styles.jsonEditor}>
        <WeaverCodeEditor language="json" value={text} readOnly={true} height="100%" options={EDITOR_OPTIONS} />
      </div>
    </div>
  );
}

/** Tabbed details of one executed task: summary, input, output, and the raw task object. */
export function ExecutionTaskDetails({ referenceName, task, onClose, renderStatus }: ExecutionTaskDetailsProps) {
  const [activeTab, setActiveTab] = useState<TaskDetailsTabId>("summary");
  const status = String(task?.status || "UNKNOWN").toUpperCase();
  const inputData = (task?.inputData ?? task?.input) as Record<string, unknown> | undefined;

  const summaryRows: Array<[string, ReactNode]> = task
    ? [
        ["Task type", display(task.taskType)],
        ["Status", renderStatus ? renderStatus(status) : status],
        ["Task name", display(task.taskDefName)],
        ["Reference", display(getExecutionTaskReferenceName(task) || referenceName)],
        ["Node name", display(inputData && typeof inputData === "object" ? inputData._nodeName : undefined)],
        ["Task execution ID", display(task.taskId)],
        ["Retry count", display(task.retryCount)],
        ["Scheduled time", formatExecutionTimestamp(task.scheduledTime)],
        ["Start time", formatExecutionTimestamp(task.startTime)],
        ["End time", formatExecutionTimestamp(task.endTime)],
        ["Duration", displayMs(getExecutionTaskDurationMs(task))],
        ["Worker", display(task.workerId)],
        ["Poll count", display(task.pollCount)],
        ["Sequence", display(task.seq)],
        ["Queue wait time", displayMs(task.queueWaitTime)],
      ]
    : [];

  const isTaskFailed =
    status === "FAILED" ||
    status === "FAILED_WITH_TERMINAL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CANCELED";

  return (
    <aside className={styles.panel} aria-label="Selected task details">
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.referenceName} title={referenceName}>{referenceName}</span>
          {task ? (
            <div className={styles.headerMeta}>
              <span className={styles.typeTag}>{task.taskType || task.taskDefName || "TASK"}</span>
              {renderStatus ? renderStatus(status) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close task details"
          title="Close task details"
        >
          <FiX size={13} />
        </button>
      </header>

      {!task ? (
        <div className={styles.message}>This task was not executed in this run.</div>
      ) : (
        <>
          <div className={styles.tabBar} role="tablist" aria-label="Task details">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.tabPanel} role="tabpanel">
            {activeTab === "summary" ? (
              <div className={styles.summary}>
                {isTaskFailed && task.reasonForIncompletion ? (
                  <div className={styles.errorBox}>{task.reasonForIncompletion}</div>
                ) : null}
                <dl className={styles.summaryList}>
                  {summaryRows.map(([label, value]) => (
                    <div key={label} className={styles.summaryRow}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {activeTab === "input" ? <JsonView label="Task input" value={inputData ?? {}} /> : null}
            {activeTab === "output" ? <JsonView label="Task outputData" value={task.outputData ?? task.output ?? {}} /> : null}
            {activeTab === "definition" ? <JsonView label="Task object" value={task} /> : null}
          </div>
        </>
      )}
    </aside>
  );
}

export default ExecutionTaskDetails;
