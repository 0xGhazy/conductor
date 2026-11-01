import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export interface RespondActionConfig extends BaseActionConfig {
  messageCode?: string;
  languageCode?: string;
  previewText?: string;
}

export interface RespondNodeData extends WeaverActionNodeData<RespondActionConfig> {}

export interface NodePosition {
  x?: string | number;
  y?: string | number;
}

export const generateRespondReferenceName = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `respond_${suffix}`;
};

export const buildRespondDraftData = (
  data?: RespondNodeData | null
): RespondNodeData => {
  const existingRef = String(
    data?.config?.referenceName ?? data?.config?.name ?? data?.config?.taskReferenceName ?? ""
  ).trim();
  const referenceName = existingRef || generateRespondReferenceName();

  return {
    ...(data ?? {}),
    name: data?.name || "Respond",
    config: {
      ...(data?.config ?? {}),
      name: referenceName,
      referenceName,
      taskReferenceName: referenceName,
      messageCode: data?.config?.messageCode || "",
      languageCode:
        !data?.config?.languageCode || data?.config?.languageCode === "default"
          ? "${workflow.input._language}"
          : data.config.languageCode,
      previewText: data?.config?.previewText || "",
    },
  };
};

export const exportRespondActionData = (
  nodeData?: RespondNodeData | null,
  nodeId?: string,
  position?: NodePosition
) => {
  const cfg = nodeData?.config ?? {};
  const taskReferenceName =
    String(cfg.taskReferenceName ?? cfg.referenceName ?? cfg.name ?? "respond").trim() ||
    "respond";

  return {
    name: "RespondWorker",
    taskReferenceName,
    inputParameters: {
      messageCode: cfg.messageCode || "",
      languageCode:
        !cfg.languageCode || cfg.languageCode === "default"
          ? "${workflow.input._language}"
          : cfg.languageCode,
    },
    type: "SIMPLE",
  };
};

export const exportRespondTerminalData = (
  nodeData?: RespondNodeData | null,
  id?: string,
  _position?: NodePosition
) => {
  const cfg = nodeData?.config ?? {};
  const taskReferenceName =
    String(cfg.taskReferenceName ?? cfg.referenceName ?? cfg.name ?? "respond").trim() ||
    "respond";
  const terminateRefName = `terminate_${taskReferenceName}`;

  return {
    name: "terminate",
    taskReferenceName: terminateRefName,
    inputParameters: {
      terminationStatus: "COMPLETED",
      workflowOutput: `\${${taskReferenceName}.output}`,
      terminationReason: "Workflow responded to client",
    },
    type: "TERMINATE",
  };
};

export const exportRespondTasks = (
  nodeData?: RespondNodeData | null,
  nodeId?: string,
  position?: NodePosition
) => {
  return [
    exportRespondActionData(nodeData, nodeId, position),
    exportRespondTerminalData(nodeData, nodeId, position),
  ];
};

