import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export type TerminationStatus = "COMPLETED" | "FAILED" | "TERMINATED";

export interface TerminateActionConfig extends BaseActionConfig {
  status?: string;
  reason?: string;
  output?: unknown;
}

export interface TerminateNodeData extends WeaverActionNodeData<TerminateActionConfig> {}

export interface NodePosition {
  x?: string | number;
  y?: string | number;
}

export const TERMINATION_STATUSES: TerminationStatus[] = [
  "COMPLETED",
  "FAILED",
  "TERMINATED",
];

export const generateTerminateReferenceName = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `terminate_${suffix}`;
};

export const normalizeTerminateWorkflowOutput = (output: unknown): Record<string, unknown> => {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }
  if (typeof output !== "string" || !output.trim()) return {};

  try {
    const parsed = JSON.parse(output);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

export const buildTerminateDraftData = (data?: TerminateNodeData | null): TerminateNodeData => {
  const existingRefName = String(
    data?.config?.name ?? data?.config?.referenceName ?? data?.config?.reference ?? ""
  ).trim();
  const referenceName = existingRefName || generateTerminateReferenceName();

  return {
    ...(data ?? {}),
    name: data?.name || "Terminate",
    config: {
      ...(data?.config ?? {}),
      name: referenceName,
      referenceName,
      reference: referenceName,
      status: String(data?.config?.status || "COMPLETED").toUpperCase(),
      reason: data?.config?.reason || "Workflow terminated",
      output: data?.config?.output ?? {},
    },
  };
};

export const exportTerminateActionData = (
  nodeData?: TerminateNodeData | null,
  nodeId?: string,
  position?: NodePosition
) => {
  const cfg = nodeData?.config ?? {};
  const taskReferenceName =
    String(cfg.taskReferenceName ?? cfg.referenceName ?? cfg.name ?? "terminate").trim() ||
    "terminate";

  return {
    name: "terminate",
    taskReferenceName,
    inputParameters: {
      terminationStatus: String(cfg.status || "COMPLETED").toUpperCase(),
      workflowOutput: normalizeTerminateWorkflowOutput(cfg.output),
      terminationReason: cfg.reason || "Workflow terminated",
    },
    type: "TERMINATE",
  };
};
