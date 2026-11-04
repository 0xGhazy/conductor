import { config } from "@/config/appConfig";
import apiClient from "@/services/apiClient";

const NEW_STRUCTURE_UPSERT_ENDPOINT = `${config.apiBaseUrl}/api/metadata/workflow`;
const SAVE_ENDPOINT = `${config.apiBaseUrl}/api/metadata/workflow`;
const METADATA_WORKFLOW_ENDPOINT = `${config.apiBaseUrl}/api/metadata/workflow`;

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const WORKFLOW_UPSERT_TIMEOUT_MS = 60000;
const WORKFLOW_EXECUTION_TIMEOUT_MS = 130000;

const isTimeoutError = (error: any) =>
  error?.code === "ECONNABORTED" ||
  error?.name === "TimeoutError" ||
  error?.name === "AbortError" ||
  String(error?.message || "").toLowerCase().includes("timeout") ||
  String(error?.message || "").toLowerCase().includes("signal timed out");

const withTimeoutMessage = async <T>(operation: string, timeoutMs: number, request: () => Promise<T>): Promise<T> => {
  try {
    return await request();
  } catch (error: any) {
    if (isTimeoutError(error)) {
      throw new Error(
        `${operation} timed out after ${Math.round(timeoutMs / 1000)} seconds. The server may still complete it; refresh the workflow before retrying.`
      );
    }
    throw error;
  }
};

export const upsertNewWorkflowStructure = async (
  payload: any,
  { timeoutMs = WORKFLOW_UPSERT_TIMEOUT_MS, incrementVersion = false, version = null } = {}
) => {
  return withTimeoutMessage("Workflow new structure upsert", timeoutMs, async () => {
    try {
      const targetVersion = incrementVersion
        ? (Number(payload?.version) || 1) + 1
        : version !== null && version !== undefined && String(version).trim() !== ""
        ? Number(version)
        : Number(payload?.version) || 1;

      const workflowPayload = {
        ...payload,
        version: targetVersion,
      };

      const arrayPayload = [workflowPayload];
      const res = await apiClient.put(SAVE_ENDPOINT, arrayPayload, {
        timeout: timeoutMs,
      });
      const data = res.data;
      if (data?.bulkErrorResults && Object.keys(data.bulkErrorResults).length > 0) {
        const err = Object.values(data.bulkErrorResults).join(", ");
        throw new Error(err || "Failed to save workflow definition.");
      }
      return {
        ...data,
        name: workflowPayload.name,
        version: workflowPayload.version,
        data: workflowPayload,
      };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.reason || err.message;
      throw new Error(msg);
    }
  });
};

const WORKFLOW_EXECUTION_ENDPOINT = `${config.apiBaseUrl}/api/workflow`;

export interface ExecuteWorkflowOptions {
  timeoutMs?: number;
  language?: string | null;
  version?: number | string | null;
  correlationId?: string | null;
  requestId?: string | null;
  priority?: number | null;
  executionMode?: "Async" | "Sync";
  waitForSeconds?: number | null;
}

export const executeWorkflowByName = async (
  workflowName: string,
  inputs: any = {},
  {
    timeoutMs = WORKFLOW_EXECUTION_TIMEOUT_MS,
    language = null,
    version = null,
    correlationId = null,
    requestId = null,
    priority = null,
    executionMode = "Async",
    waitForSeconds = 60,
  }: ExecuteWorkflowOptions = {}
) => {
  const encodedName = encodeURIComponent(String(workflowName || "").trim());
  if (!encodedName) {
    throw new Error("Workflow name is required.");
  }

  const resolvedVersion =
    version !== null && version !== undefined && String(version).trim() !== ""
      ? String(version).trim()
      : "1";

  const headers: Record<string, string> = {};
  const trimmedLanguage = String(language ?? "").trim();
  if (trimmedLanguage) {
    headers["X-WORKFLOW-LANGUAGE"] = trimmedLanguage;
  }

  // Synchronous workflow execution endpoint:
  // POST /api/workflow/execute/{name}/{version}?requestId={requestId}&waitForSeconds={waitForSeconds}&consistency=DURABLE&returnStrategy=TARGET_WORKFLOW
  if (executionMode === "Sync") {
    const syncQueryParams = new URLSearchParams();
    const effectiveRequestId = (requestId || correlationId || "").trim();
    if (effectiveRequestId) {
      syncQueryParams.set("requestId", effectiveRequestId);
    }
    syncQueryParams.set("waitForSeconds", String(waitForSeconds ?? 60));
    syncQueryParams.set("consistency", "DURABLE");
    syncQueryParams.set("returnStrategy", "TARGET_WORKFLOW");

    const syncQueryString = syncQueryParams.toString() ? `?${syncQueryParams.toString()}` : "";
    const bodyPayload =
      inputs &&
      typeof inputs === "object" &&
      !Array.isArray(inputs) &&
      "input" in inputs &&
      typeof inputs.input === "object"
        ? inputs
        : { input: inputs ?? {} };

    return withTimeoutMessage("Sync workflow execution", timeoutMs, async () => {
      try {
        const res = await apiClient.post(
          `${WORKFLOW_EXECUTION_ENDPOINT}/execute/${encodedName}/${encodeURIComponent(resolvedVersion)}${syncQueryString}`,
          bodyPayload,
          {
            headers: {
              ...headers,
              accept: "application/json",
              "Content-Type": "application/json",
            },
            timeout: timeoutMs,
          }
        );
        return res.data;
      } catch (err: any) {
        const msg = err.response?.data?.message || err.response?.data?.reason || err.message;
        throw new Error(msg);
      }
    });
  }

  // Asynchronous workflow execution endpoint:
  // POST /api/workflow/{name}?version={version}&correlationId={correlationId}&priority={priority}
  const queryParams = new URLSearchParams();
  if (version !== null && version !== undefined && String(version).trim() !== "") {
    queryParams.set("version", String(version).trim());
  }
  if (correlationId !== null && correlationId !== undefined && String(correlationId).trim() !== "") {
    queryParams.set("correlationId", String(correlationId).trim());
  }
  if (priority !== null && priority !== undefined) {
    queryParams.set("priority", String(priority));
  }

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

  return withTimeoutMessage("Workflow execution", timeoutMs, async () => {
    try {
      const res = await apiClient.post(
        `${WORKFLOW_EXECUTION_ENDPOINT}/${encodedName}${queryString}`,
        inputs ?? {},
        {
          headers,
          timeout: timeoutMs,
        }
      );
      // Conductor returns either the workflowId as string or JSON object containing workflowId/data
      const rawData = res.data;
      if (typeof rawData === "string") {
        return {
          workflowId: rawData.trim(),
          success: true,
          data: rawData,
        };
      }
      return rawData;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.reason || err.message;
      throw new Error(msg);
    }
  });
};

export const fetchWorkflowExecutionStatus = async (
  workflowId: string,
  { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}
) => {
  const encodedId = encodeURIComponent(String(workflowId || "").trim());
  if (!encodedId) return null;

  return withTimeoutMessage("Fetch execution status", timeoutMs, async () => {
    try {
      const res = await apiClient.get(
        `${WORKFLOW_EXECUTION_ENDPOINT}/${encodedId}?includeTasks=true`,
        { timeout: timeoutMs }
      );
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.reason || err.message;
      throw new Error(msg);
    }
  });
};

export const pauseWorkflowExecution = async (workflowId: string) => {
  const encodedId = encodeURIComponent(String(workflowId || "").trim());
  const res = await apiClient.put(`${WORKFLOW_EXECUTION_ENDPOINT}/${encodedId}/pause`);
  return res.data;
};

export const resumeWorkflowExecution = async (workflowId: string) => {
  const encodedId = encodeURIComponent(String(workflowId || "").trim());
  const res = await apiClient.put(`${WORKFLOW_EXECUTION_ENDPOINT}/${encodedId}/resume`);
  return res.data;
};

export const terminateWorkflowExecution = async (workflowId: string, reason?: string) => {
  const encodedId = encodeURIComponent(String(workflowId || "").trim());
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  const res = await apiClient.delete(`${WORKFLOW_EXECUTION_ENDPOINT}/${encodedId}${query}`);
  return res.data;
};

export const restartWorkflowExecution = async (
  workflowId: string,
  useLatestDefinitions: boolean = true
) => {
  const encodedId = encodeURIComponent(String(workflowId || "").trim());
  const res = await apiClient.post(
    `${WORKFLOW_EXECUTION_ENDPOINT}/${encodedId}/restart?useLatestDefinitions=${useLatestDefinitions}`
  );
  return res.data;
};

export const retryWorkflowExecution = async (
  workflowId: string,
  resumeSubworkflowTasks: boolean = false
) => {
  const encodedId = encodeURIComponent(String(workflowId || "").trim());
  const res = await apiClient.post(
    `${WORKFLOW_EXECUTION_ENDPOINT}/${encodedId}/retry?resumeSubworkflowTasks=${resumeSubworkflowTasks}`
  );
  return res.data;
};

export const saveWorkflow = async (payload: any, { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}) => {
  return withTimeoutMessage("Workflow save", timeoutMs, async () => {
    try {
      const arrayPayload = Array.isArray(payload) ? payload : [payload];
      const res = await apiClient.put(SAVE_ENDPOINT, arrayPayload, {
        timeout: timeoutMs,
      });
      const data = res.data;
      if (data?.bulkErrorResults && Object.keys(data.bulkErrorResults).length > 0) {
        const err = Object.values(data.bulkErrorResults).join(", ");
        throw new Error(err || "Failed to save workflow definition.");
      }
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.reason || err.message;
      throw new Error(msg);
    }
  });
};

export const fetchWorkflowJsonByName = async (workflowName: string, version: any = null, { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}) => {
  const encodedName = encodeURIComponent(String(workflowName || "").trim());
  if (!encodedName) {
    throw new Error("Workflow name is required.");
  }

  const query = version == null || version === "" ? "" : `?version=${encodeURIComponent(String(version))}`;
  return withTimeoutMessage("Workflow load", timeoutMs, async () => {
    try {
      const res = await apiClient.get(`${METADATA_WORKFLOW_ENDPOINT}/${encodedName}${query}`, {
        timeout: timeoutMs,
      });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.reason || err.message;
      throw new Error(msg);
    }
  });
};

export const fetchWorkflowTopologyByName = fetchWorkflowJsonByName;

export const checkWorkflowExists = async (
  workflowName: string,
  { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}
): Promise<boolean> => {
  const encodedName = encodeURIComponent(String(workflowName || "").trim());
  if (!encodedName) return false;

  try {
    const res = await apiClient.get(`${METADATA_WORKFLOW_ENDPOINT}/${encodedName}`, {
      timeout: timeoutMs,
    });
    return Boolean(res?.data);
  } catch (err: any) {
    const status = Number(err?.response?.status || 0);
    const msg = String(err?.response?.data?.message || err?.message || "").toLowerCase();
    if (status === 404 || msg.includes("not found")) {
      return false;
    }
    throw err;
  }
};

export const fetchWorkflowVersions = async (
  workflowName: string,
  { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}
) => {
  const normalizedName = String(workflowName || "").trim().toLowerCase();
  if (!normalizedName) return [];

  return withTimeoutMessage("Workflow versions load", timeoutMs, async () => {
    try {
      const res = await apiClient.get(METADATA_WORKFLOW_ENDPOINT, {
        timeout: timeoutMs,
      });
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      const versions = data
        .filter((workflow: any) => String(workflow?.name || "").trim().toLowerCase() === normalizedName)
        .map((workflow: any) => Number(workflow?.version))
        .filter((version: any) => Number.isFinite(version));

      return Array.from(new Set(versions)).sort((a: number, b: number) => b - a);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.reason || err.message;
      throw new Error(msg);
    }
  });
};

