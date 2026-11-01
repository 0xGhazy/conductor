import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export type ForEachExecutionMode = "PARALLEL";
export type ForEachErrorStrategy = "FAIL_FAST" | "COLLECT_ERRORS";

export interface ForEachActionConfig extends BaseActionConfig {
  collection?: string;
  collectionExpression?: string;
  itemVariable?: string;
  indexVariable?: string;
  executionMode?: ForEachExecutionMode | string;
  errorStrategy?: ForEachErrorStrategy | string;
  maxIterations?: number | string;
  preserveOrder?: boolean;
  loopOver?: any[];
}

export interface ForEachNodeData extends WeaverActionNodeData<ForEachActionConfig> {}

export interface NodePosition {
  x?: string | number;
  y?: string | number;
}

export const generateForEachReferenceName = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `foreach_${suffix}`;
};

export const buildForEachDraftData = (data?: ForEachNodeData | null): ForEachNodeData => {
  const existingRefName = String(
    data?.config?.name ?? data?.config?.referenceName ?? data?.config?.reference ?? data?.config?.taskReferenceName ?? ""
  ).trim();
  const referenceName = existingRefName || generateForEachReferenceName();

  const rawCollection = String(
    data?.config?.collectionExpression ?? data?.config?.collection ?? "${workflow.input.items}"
  ).trim();

  return {
    ...(data ?? {}),
    name: data?.name || "ForEach",
    kind: "FOREACH_ACTION",
    config: {
      ...(data?.config ?? {}),
      name: referenceName,
      referenceName,
      reference: referenceName,
      taskReferenceName: referenceName,
      collection: rawCollection,
      collectionExpression: rawCollection,
      itemVariable: String(data?.config?.itemVariable ?? "item").trim() || "item",
      indexVariable: String(data?.config?.indexVariable ?? "index").trim() || "index",
      executionMode: (data?.config?.executionMode as ForEachExecutionMode) || "PARALLEL",
      errorStrategy: (data?.config?.errorStrategy as ForEachErrorStrategy) || "FAIL_FAST",
      maxIterations: data?.config?.maxIterations !== undefined ? Number(data?.config?.maxIterations) : 1000,
      preserveOrder: data?.config?.preserveOrder !== false,
      loopOver: data?.config?.loopOver || [],
    },
  };
};

export const exportForEachActionData = (
  nodeData?: ForEachNodeData | null,
  nodeId?: string,
  position: NodePosition = {}
) => {
  const cfg = nodeData?.config ?? {};
  const taskReferenceName =
    String(cfg.taskReferenceName ?? cfg.referenceName ?? cfg.reference ?? cfg.name ?? "foreach").trim() ||
    "foreach";

  const collectionExpr = String(cfg.collectionExpression ?? cfg.collection ?? "${workflow.input.items}").trim();
  const itemVar = String(cfg.itemVariable ?? "item").trim() || "item";
  const indexVar = String(cfg.indexVariable ?? "index").trim() || "index";
  const executionMode = String(cfg.executionMode ?? "PARALLEL").toUpperCase();
  const errorStrategy = String(cfg.errorStrategy ?? "FAIL_FAST").toUpperCase();
  const maxIterations = cfg.maxIterations !== undefined && !Number.isNaN(Number(cfg.maxIterations))
    ? Number(cfg.maxIterations)
    : 1000;
  const preserveOrder = cfg.preserveOrder !== false;

  return {
    name: "ForEach",
    taskReferenceName,
    inputParameters: {
      collection: collectionExpr,
      collectionExpression: collectionExpr,
      itemVariable: itemVar,
      indexVariable: indexVar,
      executionMode,
      errorStrategy,
      maxIterations,
      preserveOrder,
    },
    type: "FOREACH",
    loopOver: cfg.loopOver || [],
  };
};
