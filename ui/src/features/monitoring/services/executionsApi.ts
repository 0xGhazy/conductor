import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { ApiResponse } from "@/types/api";
import type { TaskExecutionLog, WorkflowExecution } from "../types/executionTypes";

const WORKFLOW_API = `${config.apiBaseUrl}/api/workflow`;
const EXECUTIONS_API = `${config.apiBaseUrl}/api/executions`;
const TASKS_API = `${config.apiBaseUrl}/api/tasks`;
const AGENT_TASKS_API = `${config.apiBaseUrl}/api/agent/tasks`;

export const fetchExecutions = async (
  params: WorkflowSearchParams = {}
): Promise<WorkflowExecution[]> => {
  const res = await searchWorkflowExecutions(params);
  return res.results;
};

export const fetchExecutionById = async (
  workflowId: string
): Promise<WorkflowExecution | null> => {
  try {
    const res = await apiClient.get<any>(
      `${WORKFLOW_API}/${encodeURIComponent(workflowId)}?includeTasks=true`
    );
    const data = res.data;
    if (data && (data.workflowId || data.status)) {
      return data;
    }
    if (data?.data && (data.data.workflowId || data.data.status)) {
      return data.data;
    }
  } catch {
    // Fallback to executions endpoint if needed
    try {
      const fallback = await apiClient.get<ApiResponse<WorkflowExecution>>(
        `${EXECUTIONS_API}/${workflowId}`
      );
      return fallback.data?.data || null;
    } catch {
      return null;
    }
  }
  return null;
};

export const fetchTaskExecutionLogs = async (taskId: string): Promise<TaskExecutionLog[]> => {
  try {
    const res = await apiClient.get<any>(`${AGENT_TASKS_API}/${encodeURIComponent(taskId)}/log`);
    const payload = res.data;
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload?.data && Array.isArray(payload.data)) {
      return payload.data;
    }
    return [];
  } catch (err) {
    console.warn(`Could not fetch logs from ${AGENT_TASKS_API}/${taskId}`, err);
    // 1st fallback: try direct Conductor /api/tasks/{taskId}/log
    try {
      const direct = await apiClient.get<any>(`${TASKS_API}/${encodeURIComponent(taskId)}/log`);
      const payload = direct.data;
      if (Array.isArray(payload)) {
        return payload;
      }
      if (payload?.data && Array.isArray(payload.data)) {
        return payload.data;
      }
    } catch {
      // ignore and try backend fallback
    }
    // 2nd fallback to backend executions endpoint if needed
    try {
      const fallback = await apiClient.get<ApiResponse<TaskExecutionLog[]>>(
        `${EXECUTIONS_API}/tasks/${encodeURIComponent(taskId)}/logs`
      );
      return fallback.data?.data || [];
    } catch {
      return [];
    }
  }
};

export interface WorkflowSearchParams {
  start?: number;
  size?: number;
  sort?: string;
  freeText?: string;
  query?: string;
  classifier?: string;
}

export interface WorkflowSearchResult {
  totalHits: number;
  results: WorkflowExecution[];
}

export const searchWorkflowExecutions = async (
  params: WorkflowSearchParams = {}
): Promise<WorkflowSearchResult> => {
  const queryParams = new URLSearchParams();
  queryParams.set("start", String(params.start ?? 0));
  queryParams.set("size", String(params.size ?? 15));
  queryParams.set("sort", params.sort ?? "startTime:DESC");
  queryParams.set("freeText", params.freeText ?? "*");
  queryParams.set("classifier", params.classifier ?? "workflow");
  if (params.query && params.query.trim()) {
    queryParams.set("query", params.query.trim());
  }

  const res = await apiClient.get<any>(`${WORKFLOW_API}/search?${queryParams.toString()}`);
  const payload = res.data;

  if (payload && Array.isArray(payload.results)) {
    return {
      totalHits: Number(payload.totalHits ?? payload.results.length),
      results: payload.results,
    };
  }
  if (payload?.data && Array.isArray(payload.data.results)) {
    return {
      totalHits: Number(payload.data.totalHits ?? payload.data.results.length),
      results: payload.data.results,
    };
  }
  if (Array.isArray(payload)) {
    return {
      totalHits: payload.length,
      results: payload,
    };
  }
  return {
    totalHits: 0,
    results: [],
  };
};

export const retryExecution = (
  workflowId: string,
  resumeSubworkflowTasks: boolean = false
): Promise<any> =>
  apiClient
    .post(`${WORKFLOW_API}/${encodeURIComponent(workflowId)}/retry?resumeSubworkflowTasks=${resumeSubworkflowTasks}`)
    .then((res) => res.data);

export const restartExecution = (
  workflowId: string,
  useLatestDefinitions: boolean = false
): Promise<any> =>
  apiClient
    .post(`${WORKFLOW_API}/${encodeURIComponent(workflowId)}/restart?useLatestDefinitions=${useLatestDefinitions}`)
    .then((res) => res.data);

export const terminateExecution = (
  workflowId: string,
  reason?: string
): Promise<any> =>
  apiClient
    .delete(`${WORKFLOW_API}/${encodeURIComponent(workflowId)}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`)
    .then((res) => res.data);

export const pauseExecution = (
  workflowId: string
): Promise<any> =>
  apiClient
    .put(`${WORKFLOW_API}/${encodeURIComponent(workflowId)}/pause`)
    .then((res) => res.data);

export const resumeExecution = (
  workflowId: string
): Promise<any> =>
  apiClient
    .put(`${WORKFLOW_API}/${encodeURIComponent(workflowId)}/resume`)
    .then((res) => res.data);
