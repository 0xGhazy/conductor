import { config } from "@/config/appConfig";
import type { WorkbenchWorkflow, WorkflowExecuteOptions } from "../types/workbenchTypes";

export const WORKFLOW_EXECUTE_URL = `${config.apiBaseUrl}/api/workflow/execute`;
// Legacy alias for backwards compatibility
export const EXECUTE_URL = WORKFLOW_EXECUTE_URL;

export const parseJsonSafe = <T>(value: string, fallback: T): any => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const formatJson = (value: unknown): string => {
  if (typeof value === "string") {
    const parsed = parseJsonSafe(value, value);
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
  }
  return JSON.stringify(value ?? {}, null, 2);
};

export const normalizeWorkflow = (item: any, index: number): WorkbenchWorkflow => {
  const name = String(item?.name ?? item?.workflowName ?? "").trim();
  const versionRaw = item?.version ?? 1;
  const versionNum = Number(versionRaw);
  const inputPayload =
    item?.input ??
    item?.inputs ??
    item?.workflowInput ??
    {};
  return {
    key: `${name || "workflow"}-${Number.isFinite(versionNum) ? versionNum : String(versionRaw)}-${index}`,
    id: String(item?.id ?? "").trim(),
    name,
    version: Number.isFinite(versionNum) ? versionNum : versionRaw,
    input: inputPayload && typeof inputPayload === "object" ? inputPayload : {},
    description: String(item?.description ?? "").trim(),
  };
};

/** Normalizes payload to { input: { ... } } expected by Conductor synchronous execution endpoint. */
export const wrapWorkflowExecutePayload = (
  payload: unknown
): { input: Record<string, unknown> } => {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "input" in payload &&
    typeof (payload as any).input === "object" &&
    !Array.isArray((payload as any).input)
  ) {
    return payload as { input: Record<string, unknown> };
  }
  return {
    input:
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
  };
};

/**
 * Builds the sync execution URL for a workflow:
 * /api/workflow/execute/{name}/{version}?requestId={requestId}&waitForSeconds={waitForSeconds}&consistency=DURABLE&returnStrategy=TARGET_WORKFLOW
 */
export const buildExecuteUrl = (
  name: string,
  {
    version = 1,
    correlationId,
    requestId,
    waitForSeconds = 60,
    consistency = "DURABLE",
    returnStrategy = "TARGET_WORKFLOW",
  }: WorkflowExecuteOptions = {},
  baseUrl?: string
): string => {
  const resolvedVersion =
    version !== null && version !== undefined && String(version).trim() !== ""
      ? String(version).trim()
      : "1";
  const queryParams = new URLSearchParams();
  const effectiveRequestId = (requestId || correlationId || "").trim();
  if (effectiveRequestId) {
    queryParams.append("requestId", effectiveRequestId);
  }
  queryParams.append("waitForSeconds", String(waitForSeconds ?? 60));
  queryParams.append("consistency", consistency || "DURABLE");
  queryParams.append("returnStrategy", returnStrategy || "TARGET_WORKFLOW");

  const queryStr = queryParams.toString();
  const prefix = baseUrl !== undefined ? baseUrl : config.apiBaseUrl;
  return `${prefix}/api/workflow/execute/${encodeURIComponent(name)}/${encodeURIComponent(resolvedVersion)}${queryStr ? "?" + queryStr : ""}`;
};
