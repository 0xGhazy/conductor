import { config } from "@/config/appConfig";
import type { WorkbenchWorkflow, WorkflowExecuteOptions } from "../types/workbenchTypes";
import {
  buildExecuteUrl,
  normalizeWorkflow,
  parseJsonSafe,
  wrapWorkflowExecutePayload,
} from "./workbenchService";

/** Latest version of every workflow definition (Conductor metadata API). */
const WORKFLOWS_LIST_URL = `${config.apiBaseUrl}/api/metadata/workflow/latest-versions`;

// Uses window.fetch (auth is attached by the global fetch interceptor).

/** Conductor lists a workflow's inputs as names; the Workbench edits them as { name: "" }. */
const toInputTemplate = (definition: { inputParameters?: unknown }): Record<string, string> =>
  Object.fromEntries(
    (Array.isArray(definition.inputParameters) ? definition.inputParameters : [])
      .map((name) => String(name ?? "").trim())
      .filter(Boolean)
      .map((name) => [name, ""])
  );

export const fetchWorkbenchWorkflows = async (): Promise<WorkbenchWorkflow[]> => {
  const res = await fetch(WORKFLOWS_LIST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const data = Array.isArray(body) ? body : body?.data ?? [];
  return (Array.isArray(data) ? data : []).map((item: Record<string, unknown>, index: number) =>
    normalizeWorkflow({ ...item, input: toInputTemplate(item) }, index)
  );
};

/** Executes a workflow synchronously using Conductor's /api/workflow/execute endpoint. */
export const executeWorkflow = async (
  name: string,
  payload: unknown,
  options: WorkflowExecuteOptions = {}
): Promise<any> => {
  const bodyPayload = wrapWorkflowExecutePayload(payload);
  const res = await fetch(buildExecuteUrl(name, options), {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });
  const text = await res.text();
  const data = text ? parseJsonSafe(text, text) : {};
  if (!res.ok) {
    const message =
      typeof data === "object"
        ? data?.message || data?.reason || `HTTP ${res.status}`
        : String(data || `HTTP ${res.status}`);
    throw new Error(message);
  }
  return data;
};
