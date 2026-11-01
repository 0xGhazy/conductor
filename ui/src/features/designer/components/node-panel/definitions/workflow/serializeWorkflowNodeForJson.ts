import type { Node, Edge } from "@xyflow/react";
import type { WeaverNodePanelContext } from "../../nodeDefinition.types";

function parseInputs(val: unknown): Record<string, any> {
  if (!val) return {};
  if (typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, any>;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "{}") return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Serializes a Workflow node into the Conductor SUB_WORKFLOW Task format for the JSON tab.
 */
export function serializeWorkflowNodeForJson(
  node: Node,
  _context?: WeaverNodePanelContext & { edges?: Edge[] }
): Record<string, any> {
  const cfg = (node?.data?.config as Record<string, any>) || {};

  const workflowName = String(cfg.workflowName || cfg.subWorkflowParam?.name || "");
  const version = cfg.version != null ? Number(cfg.version) : null;
  const mode = cfg.mode === "SYNC" ? "SYNC" : "ASYNC";
  const correlationId = cfg.correlationId ? String(cfg.correlationId).trim() : undefined;

  const rawInputs = cfg.inputs !== undefined ? cfg.inputs : cfg.inputParameters;
  const inputParameters = parseInputs(rawInputs);

  const taskReferenceName = String(
    cfg.taskReferenceName || cfg.referenceName || cfg.name || (node?.data as any)?.name || "workflow_task"
  ).trim();

  const nodeName = String(
    cfg.nodeName || (node?.data as any)?.name || workflowName || "Workflow"
  ).trim();

  return {
    name: workflowName || nodeName,
    taskReferenceName,
    type: "SUB_WORKFLOW",
    subWorkflowParam: {
      name: workflowName,
      version,
    },
    inputParameters: {
      ...inputParameters,
    },
    ...(correlationId ? { correlationId } : {}),
    mode,
    asyncComplete: mode === "ASYNC",
  };
}
