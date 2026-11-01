export type ExecutionStatus =
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "TERMINATED"
  | "FAILED"
  | "TIMED_OUT"
  | string;

/** One executed task of a workflow run (Conductor task shape). */
export interface WorkflowExecutionTask {
  taskId?: string;
  referenceTaskName?: string;
  taskReferenceName?: string;
  taskType?: string;
  taskDefName?: string;
  status?: ExecutionStatus;
  seq?: number;
  scheduledTime?: string | number;
  startTime?: string | number;
  endTime?: string | number;
  updateTime?: string | number;
  retryCount?: number;
  pollCount?: number;
  workerId?: string;
  queueWaitTime?: number;
  reasonForIncompletion?: string;
  inputData?: unknown;
  outputData?: unknown;
  input?: unknown;
  output?: unknown;
  [key: string]: unknown;
}

/** Workflow execution summary/detail as returned by the wrapper's /api/executions endpoints */
export interface WorkflowExecution {
  workflowId?: string;
  workflowName?: string;
  workflowType?: string;
  version?: number;
  /** Conductor reports the executed definition version here. */
  workflowVersion?: number;
  status?: ExecutionStatus;
  startTime?: string | number;
  endTime?: string | number;
  correlationId?: string;
  [key: string]: any;
}

/** One log line a worker recorded for a task execution. */
export interface TaskExecutionLog {
  taskId: string;
  log: string;
  createdTime: string | number;
}

export type TaskLogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export interface ParsedTaskLogLine {
  taskId?: string;
  taskReferenceName?: string;
  taskName?: string;
  taskType?: string;
  level: TaskLogLevel;
  message: string;
  timestamp: string | number;
}

