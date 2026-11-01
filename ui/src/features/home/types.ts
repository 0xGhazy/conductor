export interface ExecutionMetrics {
  total: number;
  completed: number;
  failed: number;
  running: number;
  successRate: number;
}

export interface StatusCount {
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "TIMED_OUT" | "TERMINATED" | "FAILED" | string;
  count: number;
}

export interface WorkerInfo {
  name: string;
  workerId?: string;
  lastPollTime?: number;
  threadCount: number | null;
  registered: boolean;
  configuredThreadCount: boolean;
}

export interface TaskQueueInfo {
  name: string;
  size: number;
  registeredWorker: boolean;
  internalQueue: boolean;
}

export interface TopWorkflowInfo {
  workflowName: string;
  executionCount: number;
  completedCount: number;
  failedCount: number;
  successRate: number;
}

export interface DashboardData {
  executions: ExecutionMetrics;
  statuses: StatusCount[];
  workers: WorkerInfo[];
  taskQueues: TaskQueueInfo[];
  topWorkflows: TopWorkflowInfo[];
  generatedAt: string | null;
  from: string | null;
  to: string | null;
}

export type PresetRangeKey = "today" | "24h" | "7d" | "30d" | "custom";
