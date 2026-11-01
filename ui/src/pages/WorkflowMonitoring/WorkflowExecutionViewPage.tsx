import { Suspense, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import {
  FiArrowLeft,
  FiCopy,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiCode,
  FiTerminal,
  FiFileText,
  FiActivity,
  FiPauseCircle,
  FiGitBranch,
  FiDatabase,
  FiRotateCw,
  FiRefreshCw,
  FiSquare,
  FiPlayCircle,
} from "react-icons/fi";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useWeaverNotification } from "@/components/common/notifications";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import { getErrorMessage } from "@/utils/error";
import {
  ExecutionLogsConsole,
  ExecutionTaskDetails,
  ExecutionTimeline,
  fetchExecutionById,
  retryExecution,
  restartExecution,
  terminateExecution,
  pauseExecution,
  resumeExecution,
  useWorkflowExecutionLogs,
  type WorkflowExecution,
  formatDurationMs,
  getExecutionTaskDurationMs,
  indexExecutionTasksByReference,
} from "@/features/monitoring";
import { LazyWorkflowExecutionDiagram, type ExecutionDiagramTaskState } from "@/features/designer";
import styles from "./WorkflowExecutionViewPage.module.css";

type TabId = "diagram" | "timeline" | "io" | "variables" | "logs" | "json";

const isRunningStatus = (status: unknown): boolean => {
  const s = String(status || "").toUpperCase();
  return s === "RUNNING" || s === "IN_PROGRESS";
};

type TaskRefLike = {
  workflowTask?: { taskReferenceName?: unknown };
  taskReferenceName?: unknown;
  referenceTaskName?: unknown;
} | null | undefined;

const taskRefOf = (t: TaskRefLike): string =>
  String(t?.workflowTask?.taskReferenceName || t?.taskReferenceName || t?.referenceTaskName || "");

/**
 * Cheap signature of the definition the diagram is built from. The diagram re-runs its
 * layout whenever `fallbackDefinition` changes identity, so we only hand it a new object
 * when this signature changes (not on every 3s poll).
 */
const getDiagramDefinitionSignature = (execution: WorkflowExecution | null | undefined): string => {
  if (!execution) return "";
  const def = execution.workflowDefinition as
    | { name?: unknown; version?: unknown; tasks?: TaskRefLike[] }
    | null
    | undefined;
  if (def && typeof def === "object") {
    const refs = Array.isArray(def.tasks) ? def.tasks.map(taskRefOf).join(",") : "";
    return `def:${def.name ?? ""}@${def.version ?? ""}:${refs}`;
  }
  const tasks: TaskRefLike[] = Array.isArray(execution.tasks) ? (execution.tasks as TaskRefLike[]) : [];
  return `exec:${execution.workflowName ?? execution.workflowType ?? ""}@${
    execution.workflowVersion ?? execution.version ?? ""
  }:${tasks.map(taskRefOf).join(",")}`;
};

const READ_ONLY_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  wordWrap: "on",
} as const;

const formatFullDateTime = (val: string | number | null | undefined): string => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(val);
  }
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

interface JsonPanelProps {
  title: string;
  icon: ReactNode;
  value: string;
}

/** Titled read-only JSON editor with its own copy button. */
function JsonPanel({ title, icon, value }: JsonPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <div className={styles.ioPanel}>
      <div className={styles.ioPanelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon}
          <span>{title}</span>
        </div>
        <button type="button" className={styles.iconBtn} onClick={handleCopy} title={`Copy ${title}`}>
          {copied ? <FiCheck size={12} color="var(--color-status-success)" /> : <FiCopy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className={styles.ioEditorWrap}>
        <WeaverCodeEditor language="json" value={value} readOnly={true} height="100%" options={READ_ONLY_EDITOR_OPTIONS} />
      </div>
    </div>
  );
}



export default function WorkflowExecutionViewPage() {
  const { workflowId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>("diagram");

  const [copiedCorrId, setCopiedCorrId] = useState(false);

  const [selectedDiagramTaskRef, setSelectedDiagramTaskRef] = useState<string | null>(null);

  // Execution data: cached per id, polled every 3s only while the run is active.
  // Background refetches never unmount the page.
  const executionQuery = useQuery({
    queryKey: ["execution", workflowId],
    queryFn: () => fetchExecutionById(workflowId as string),
    enabled: Boolean(workflowId),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (isRunningStatus(query.state.data?.status) ? 3000 : false),
  });
  const { refetch: refetchExecution } = executionQuery;
  const data: WorkflowExecution | null = executionQuery.data ?? null;
  const loading = Boolean(workflowId) && executionQuery.isPending;
  const error = executionQuery.isError
    ? getErrorMessage(executionQuery.error, "Failed to load execution details. It may not exist.")
    : null;

  const loadData = useCallback(async () => {
    await refetchExecution();
  }, [refetchExecution]);

  useEffect(() => {
    const title = data?.workflowName || data?.workflowType || (workflowId ? `Execution: ${workflowId}` : "Execution Details");
    document.title = title;
  }, [data?.workflowName, data?.workflowType, workflowId]);

  const notify = useWeaverNotification();
  const [actionLoading, setActionLoading] = useState<"retry" | "pause" | "resume" | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "restart" | "terminate" | null;
    loading: boolean;
  }>({
    open: false,
    type: null,
    loading: false,
  });

  const currentStatus = String(data?.status || "").toUpperCase();
  const isRunning = isRunningStatus(currentStatus);
  const isPaused = currentStatus === "PAUSED";
  const isFailed = currentStatus === "FAILED" || currentStatus === "TERMINATED" || currentStatus === "TIMED_OUT";
  const canRetry = isFailed;
  const canRestart = !isRunning && (currentStatus === "COMPLETED" || isFailed);

  // Stable definition input for the diagram (identity changes only when the definition does)
  const diagramDefinitionSignature = getDiagramDefinitionSignature(data);
  const diagramFallbackDefinition = useMemo(
    () => (data ? data.workflowDefinition || data : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the definition signature on purpose
    [diagramDefinitionSignature]
  );

  const handleRetry = async () => {
    if (!data?.workflowId) return;
    setActionLoading("retry");
    try {
      await retryExecution(data.workflowId, false);
      notify.success({
        title: "Retry Triggered",
        message: `Workflow retried from last failed task.`,
      });
      await loadData();
    } catch (err) {
      notify.error({
        title: "Retry Failed",
        message: getErrorMessage(err, "Failed to retry workflow from failed task."),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseResume = async () => {
    if (!data?.workflowId) return;
    setActionLoading(isPaused ? "resume" : "pause");
    try {
      if (isPaused) {
        await resumeExecution(data.workflowId);
        notify.success({
          title: "Workflow Resumed",
          message: `Execution has resumed.`,
        });
      } else {
        await pauseExecution(data.workflowId);
        notify.success({
          title: "Workflow Paused",
          message: `Execution has been paused.`,
        });
      }
      await loadData();
    } catch (err) {
      notify.error({
        title: isPaused ? "Resume Failed" : "Pause Failed",
        message: getErrorMessage(err, `Failed to ${isPaused ? "resume" : "pause"} workflow.`),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!data?.workflowId || !confirmModal.type) return;
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      if (confirmModal.type === "restart") {
        await restartExecution(data.workflowId, false);
        notify.success({
          title: "Workflow Restarted",
          message: `Execution restarted with original input arguments.`,
        });
      } else if (confirmModal.type === "terminate") {
        await terminateExecution(data.workflowId, "Terminated by user from Execution View");
        notify.success({
          title: "Workflow Terminated",
          message: `Execution has been terminated.`,
        });
      }
      setConfirmModal({ open: false, type: null, loading: false });
      await loadData();
    } catch (err) {
      setConfirmModal((prev) => ({ ...prev, loading: false }));
      notify.error({
        title: confirmModal.type === "restart" ? "Restart Failed" : "Termination Failed",
        message: getErrorMessage(err, `Failed to ${confirmModal.type} workflow.`),
      });
    }
  };

  const handleCopy = async (text: string, setter: (val: boolean) => void) => {
    if (await copyToClipboard(text)) {
      setter(true);
      setTimeout(() => setter(false), 1400);
    }
  };



  // Workflow summary attributes
  const workflowName = data?.workflowName || data?.workflowType || "Unknown Workflow";
  const executionVersion = data?.workflowVersion ?? data?.version;
  const version = executionVersion ? `v${executionVersion}` : null;
  const startTime = data?.createTime || data?.startTime || null;
  const endTime = data?.endTime && data.endTime !== 0 ? data.endTime : null;

  // Calculate total duration in ms
  const totalDurationMs = useMemo(() => {
    const s = startTime ? (typeof startTime === "number" ? startTime : new Date(startTime).getTime()) : null;
    const e = endTime ? (typeof endTime === "number" ? endTime : new Date(endTime).getTime()) : (isRunning ? Date.now() : null);
    if (s && e && e >= s) {
      return e - s;
    }
    return data?.duration || 1000;
  }, [startTime, endTime, isRunning, data?.duration]);

  // Tasks sorted chronologically by start time
  const sortedTasks = useMemo(() => {
    if (!data?.tasks || !Array.isArray(data.tasks)) return [];
    return [...data.tasks].sort((a, b) => {
      const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
      return aStart - bStart;
    });
  }, [data?.tasks]);

  const [selectedLogTaskRef, setSelectedLogTaskRef] = useState<string | null>(null);

  const {
    logs: workflowLogs,
    loading: workflowLogsLoading,
    errorMessage: workflowLogsError,
    reload: reloadWorkflowLogs,
  } = useWorkflowExecutionLogs(
    sortedTasks,
    activeTab === "logs",
    data?.updateTime ?? data?.endTime ?? data?.status
  );

  const failedTasksCount = useMemo(() => {
    return sortedTasks.filter((t) => {
      const s = String(t.status || "").toUpperCase();
      return s === "FAILED" || s === "TERMINATED" || s === "TIMED_OUT";
    }).length;
  }, [sortedTasks]);

  // Latest attempt of every task, keyed by reference name, for the workflow diagram
  const tasksByReference = useMemo(() => indexExecutionTasksByReference(sortedTasks), [sortedTasks]);

  const diagramTaskStates = useMemo(() => {
    const states: Record<string, ExecutionDiagramTaskState> = {};
    tasksByReference.forEach((task, refName) => {
      const taskStatus = String(task.status || "UNKNOWN").toUpperCase();
      const isTaskError =
        taskStatus === "FAILED" ||
        taskStatus === "FAILED_WITH_TERMINAL_ERROR" ||
        taskStatus === "TIMED_OUT" ||
        taskStatus === "CANCELED";
      states[refName] = {
        status: taskStatus,
        durationMs: getExecutionTaskDurationMs(task),
        errorMessage: isTaskError ? (task.reasonForIncompletion || undefined) : undefined,
      };
    });
    return states;
  }, [tasksByReference]);

  const selectedDiagramTask = selectedDiagramTaskRef ? tasksByReference.get(selectedDiagramTaskRef) : undefined;

  // Workflow input, output and variables payloads: serialized only for the visible tab
  const workflowInputText = useMemo(() => {
    if (activeTab !== "io") return "";
    const input = data?.input ?? data?.workflowInput ?? {};
    return JSON.stringify(input, null, 2);
  }, [activeTab, data?.input, data?.workflowInput]);

  const workflowOutputText = useMemo(() => {
    if (activeTab !== "io") return "";
    const output = data?.output ?? data?.workflowOutput ?? {};
    return JSON.stringify(output, null, 2);
  }, [activeTab, data?.output, data?.workflowOutput]);

  const workflowVariablesText = useMemo(
    () => (activeTab === "variables" ? JSON.stringify(data?.variables ?? {}, null, 2) : ""),
    [activeTab, data?.variables]
  );

  const executionJsonText = useMemo(
    () => (activeTab === "json" ? JSON.stringify(data ?? {}, null, 2) : ""),
    [activeTab, data]
  );

  const handleNavigateToTask = useCallback((taskRef: string) => {
    setSelectedDiagramTaskRef(taskRef);
    setActiveTab("diagram");
  }, []);

  const handleCloseTaskDetails = useCallback(() => setSelectedDiagramTaskRef(null), []);

  // Status Pill renderer
  const renderStatusPill = (st: string) => {
    if (st === "COMPLETED") {
      return (
        <span className={`${styles.statusPill} ${styles.completed}`}>
          <FiCheckCircle size={12} />
          <span>Completed</span>
        </span>
      );
    }
    if (st === "RUNNING" || st === "IN_PROGRESS") {
      return (
        <span className={`${styles.statusPill} ${styles.running}`}>
          <span className={styles.pulseDot} />
          <span>Running</span>
        </span>
      );
    }
    if (st === "FAILED" || st === "TERMINATED" || st === "TIMED_OUT") {
      return (
        <span className={`${styles.statusPill} ${styles.failed}`}>
          <FiAlertCircle size={12} />
          <span>{st}</span>
        </span>
      );
    }
    if (st === "PAUSED") {
      return (
        <span className={`${styles.statusPill} ${styles.paused}`}>
          <FiPauseCircle size={12} />
          <span>Paused</span>
        </span>
      );
    }
    return (
      <span className={`${styles.statusPill} ${styles.defaultStatus}`}>
        <span>{st}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 100px)" }}>
        <CircularProgress size={36} style={{ color: "var(--color-accent-fg)", marginBottom: 16 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-fg-default)" }}>
          Loading Execution Details...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.topNav}>
          <button type="button" className={styles.btnBack} onClick={() => navigate("/executions")}>
            <FiArrowLeft size={15} />
            <span>Back to Executions</span>
          </button>
        </div>
        <div
          style={{
            padding: "24px 20px",
            background: "color-mix(in srgb, var(--color-status-danger) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-status-danger) 25%, transparent)",
            borderRadius: 8,
            color: "var(--color-status-danger)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
            <FiAlertCircle size={18} />
            <span>{error || "Execution details not found."}</span>
          </div>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: TabId; label: string; icon: ReactNode; badge?: number }> = [
    { id: "diagram", label: "Diagram", icon: <FiGitBranch size={14} /> },
    { id: "timeline", label: "Timeline", icon: <FiActivity size={14} />, badge: sortedTasks.length },
    { id: "io", label: "Input & Output", icon: <FiCode size={14} /> },
    { id: "variables", label: "Variables", icon: <FiDatabase size={14} /> },
    { id: "logs", label: "Logs", icon: <FiTerminal size={14} />, badge: workflowLogs.length > 0 ? workflowLogs.length : undefined },
    { id: "json", label: "JSON", icon: <FiFileText size={14} /> },
  ];

  return (
    <div className={styles.container}>
      {/* Top Nav & Controls */}
      <div className={styles.topNav}>
        <button type="button" className={styles.btnBack} onClick={() => navigate("/executions")}>
          <FiArrowLeft size={15} />
          <span>Back to Executions</span>
        </button>

        <div className={styles.navActions}>
          {/* Workflow Lifecycle Action Controls */}
          {canRetry ? (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={handleRetry}
              disabled={actionLoading !== null}
              title="Retry workflow execution from last failed task"
            >
              {actionLoading === "retry" ? (
                <CircularProgress size={13} color="inherit" />
              ) : (
                <FiRotateCw size={13} />
              )}
              <span>Retry</span>
            </button>
          ) : null}

          {canRestart ? (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setConfirmModal({ open: true, type: "restart", loading: false })}
              disabled={actionLoading !== null}
              title="Restart entire workflow execution with original inputs"
            >
              <FiRefreshCw size={13} />
              <span>Restart</span>
            </button>
          ) : null}

          {isRunning ? (
            <>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={handlePauseResume}
                disabled={actionLoading !== null}
                title="Pause active workflow execution"
              >
                {actionLoading === "pause" ? (
                  <CircularProgress size={13} color="inherit" />
                ) : (
                  <FiPauseCircle size={13} />
                )}
                <span>Pause</span>
              </button>

              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => setConfirmModal({ open: true, type: "terminate", loading: false })}
                disabled={actionLoading !== null}
                title="Terminate active workflow execution"
              >
                <FiSquare size={13} />
                <span>Terminate</span>
              </button>
            </>
          ) : null}

          {isPaused ? (
            <>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={handlePauseResume}
                disabled={actionLoading !== null}
                title="Resume paused workflow execution"
              >
                {actionLoading === "resume" ? (
                  <CircularProgress size={13} color="inherit" />
                ) : (
                  <FiPlayCircle size={13} />
                )}
                <span>Resume</span>
              </button>

              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => setConfirmModal({ open: true, type: "terminate", loading: false })}
                disabled={actionLoading !== null}
                title="Terminate paused workflow execution"
              >
                <FiSquare size={13} />
                <span>Terminate</span>
              </button>
            </>
          ) : null}

          {isRunning ? (
            <div className={styles.livePollingBadge} title="Auto-refreshing execution state every 3 seconds">
              <span className={styles.pulseDot} />
              <span>Live Polling (3s)</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 1. Title Header */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div className={styles.titleArea}>
            <h1 className={styles.workflowTitle}>{workflowName}</h1>
            {version ? <span className={styles.versionBadge}>{version}</span> : null}
            {renderStatusPill(currentStatus)}
          </div>
        </div>

        {isFailed ? (
          <div className={styles.failureBanner} role="alert">
            <FiAlertCircle size={16} className={styles.failureBannerIcon} />
            <div className={styles.failureBannerText}>
              <span className={styles.failureBannerTitle}>
                {currentStatus === "TERMINATED"
                  ? "Execution Terminated"
                  : currentStatus === "TIMED_OUT"
                  ? "Execution Timed Out"
                  : "Execution Failed"}
              </span>
              <span className={styles.failureBannerMessage}>
                {data.reasonForIncompletion || `The workflow execution ended with status ${currentStatus}.`}
              </span>
            </div>
          </div>
        ) : null}

        {data.workflowDefinition?.description ? (
          <p className={styles.workflowDesc}>{data.workflowDefinition.description}</p>
        ) : null}

        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Start Time</span>
            <span className={styles.summaryValue}>{formatFullDateTime(startTime)}</span>
          </div>

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>End Time</span>
            <span className={styles.summaryValue}>
              {endTime ? formatFullDateTime(endTime) : (isRunning ? "Still Executing..." : "—")}
            </span>
          </div>

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Duration</span>
            <span className={styles.summaryValue} style={{ color: "var(--color-accent-fg)", fontWeight: 700 }}>
              {formatDurationMs(totalDurationMs)}
            </span>
          </div>

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Tasks Traced</span>
            <span className={styles.summaryValue}>
              {sortedTasks.length} {failedTasksCount > 0 ? (
                <span style={{ color: "var(--color-status-danger)", fontSize: 12 }}>({failedTasksCount} failed)</span>
              ) : null}
            </span>
          </div>

          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Correlation ID</span>
            {data.correlationId ? (
              <button
                type="button"
                className={styles.idChip}
                onClick={() => handleCopy(String(data.correlationId), setCopiedCorrId)}
                title="Copy Correlation ID"
              >
                {copiedCorrId ? <FiCheck size={11} color="var(--color-status-success)" /> : <FiCopy size={11} />}
                <span>{data.correlationId}</span>
              </button>
            ) : (
              <span className={styles.summaryValue} style={{ color: "var(--color-fg-muted)" }}>
                —
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Tab Console */}
      <div className={styles.tabConsole}>
        <div className={styles.tabBar} role="tablist" aria-label="Execution details">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.navTab} ${activeTab === tab.id ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined ? <span className={styles.tabBadge}>{tab.badge}</span> : null}
            </button>
          ))}
        </div>

        {/* Tab Content Panel */}
        <div className={styles.tabContent} role="tabpanel">

          {/* TAB: Task Timeline (execution / queue / gap) */}
          {activeTab === "timeline" ? (
            <ExecutionTimeline
              tasks={sortedTasks}
              workflowStartTime={startTime}
              workflowEndTime={endTime}
              renderStatus={renderStatusPill}
            />
          ) : null}

          {/* TAB: Read-only Workflow Diagram with clickable task nodes */}
          {activeTab === "diagram" ? (
            <div
              className={`${styles.diagramLayout} ${selectedDiagramTaskRef ? styles.diagramLayoutWithPanel : ""}`}
            >
              <Suspense
                fallback={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
                    <CircularProgress size={24} style={{ color: "var(--color-accent-fg)" }} />
                  </div>
                }
              >
                <LazyWorkflowExecutionDiagram
                  workflowName={data.workflowName || data.workflowType || ""}
                  workflowVersion={executionVersion}
                  fallbackDefinition={diagramFallbackDefinition}
                  taskStates={diagramTaskStates}
                  selectedTaskReferenceName={selectedDiagramTaskRef}
                  onSelectTask={setSelectedDiagramTaskRef}
                />
              </Suspense>

              {selectedDiagramTaskRef ? (
                <Suspense fallback={null}>
                  <ExecutionTaskDetails
                    referenceName={selectedDiagramTaskRef}
                    task={selectedDiagramTask}
                    onClose={handleCloseTaskDetails}
                    renderStatus={renderStatusPill}
                  />
                </Suspense>
              ) : null}
            </div>
          ) : null}

          {/* TAB: Workflow Input & Output */}
          {activeTab === "io" ? (
            <div className={styles.ioGrid}>
              <JsonPanel
                title="Workflow Input (JSON)"
                icon={<FiTerminal size={14} color="var(--hue-blue)" />}
                value={workflowInputText}
              />
              <JsonPanel
                title="Workflow Output (JSON)"
                icon={<FiCheckCircle size={14} color="var(--color-status-success)" />}
                value={workflowOutputText}
              />
            </div>
          ) : null}

          {/* TAB: Workflow Variables */}
          {activeTab === "variables" ? (
            <div className={styles.variablesTab}>
              <JsonPanel
                title="Workflow Variables (JSON)"
                icon={<FiDatabase size={14} color="var(--hue-violet)" />}
                value={workflowVariablesText}
              />
            </div>
          ) : null}

          {/* TAB: Workflow Execution Logs */}
          {activeTab === "logs" ? (
            <div className={styles.logsTab}>
              <ExecutionLogsConsole
                logs={workflowLogs}
                loading={workflowLogsLoading}
                errorMessage={workflowLogsError}
                onRefresh={reloadWorkflowLogs}
                tasks={sortedTasks}
                selectedTaskRef={selectedLogTaskRef}
                onSelectTaskRef={setSelectedLogTaskRef}
                onNavigateToTask={handleNavigateToTask}
                contextTitle={`Workflow: ${workflowName || data.workflowId}`}
              />
            </div>
          ) : null}

          {/* TAB: Full execution response JSON */}
          {activeTab === "json" ? (
            <div className={styles.jsonTab}>
              <JsonPanel
                title="Execution Response (JSON)"
                icon={<FiFileText size={14} color="var(--hue-blue)" />}
                value={executionJsonText}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Confirmation Dialog for Lifecycle Actions */}
      <WeaverConfirmDialog
        open={confirmModal.open}
        intent={confirmModal.type === "terminate" ? "danger" : "default"}
        title={confirmModal.type === "terminate" ? "Terminate Workflow Execution" : "Restart Workflow Execution"}
        description={
          confirmModal.type === "terminate"
            ? "Terminating this active execution will immediately stop all running tasks. This action cannot be undone."
            : "Restarting will initiate a brand new execution of this workflow using the same original input arguments."
        }
        confirmLabel={confirmModal.type === "terminate" ? "Terminate Workflow" : "Restart Workflow"}
        cancelLabel="Cancel"
        loading={confirmModal.loading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal({ open: false, type: null, loading: false })}
        details={[
          { label: "Workflow Name", value: workflowName },
          { label: "Execution ID", value: String(data?.workflowId || "—") },
          { label: "Current Status", value: currentStatus },
        ]}
      />
    </div>
  );
}
