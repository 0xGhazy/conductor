import { SidecarError } from "../errors.js";
import type {
  JsonValue,
  SimplifiedNode,
  SimplifiedWorkflow,
} from "./schemas.js";

export interface CompiledTask {
  name: string;
  taskReferenceName: string;
  inputParameters: Record<string, unknown>;
  type: "SIMPLE" | "SWITCH" | "WAIT" | "TERMINATE";
  evaluatorType?: string;
  expression?: string;
  decisionCases?: Record<string, CompiledTask[]>;
  defaultCase?: CompiledTask[];
}

export interface CompiledEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export interface CompiledWorkflowDto {
  name: string;
  version: number;
  description?: string;
  ownerEmail: string;
  timeoutPolicy: string;
  _inputs: Record<string, JsonValue>;
  timeoutSeconds: number;
  variables: Record<string, JsonValue>;
  _builderSchemaVersion: 2;
  tasks: CompiledTask[];
  edges: CompiledEdge[];
  schemaVersion: 2;
  restartable: boolean;
}

const fail = (message: string, details?: unknown): never => {
  throw new SidecarError("INVALID_INPUT", message, details);
};

const unique = <T>(values: T[]): boolean =>
  new Set(values).size === values.length;

const terminalTypes = new Set<SimplifiedNode["type"]>([
  "TERMINATE",
  "RESPOND_ACTION",
]);

const validateGraph = (workflow: SimplifiedWorkflow): void => {
  const nodeIds = workflow.nodes.map((node) => node.id);
  if (!unique(nodeIds)) fail("Workflow node ids must be unique");

  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const seenEdges = new Set<string>();
  const outgoing = new Map<string, typeof workflow.edges>();
  const indegree = new Map(nodeIds.map((id) => [id, 0]));

  for (const edge of workflow.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      fail(
        "Every edge source and target must reference an existing node",
        edge,
      );
    }
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.branch ?? ""}`;
    if (seenEdges.has(key)) fail("Duplicate workflow edge", edge);
    seenEdges.add(key);
    const sourceEdges = outgoing.get(edge.source) ?? [];
    sourceEdges.push(edge);
    outgoing.set(edge.source, sourceEdges);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  for (const node of workflow.nodes) {
    const edges = outgoing.get(node.id) ?? [];
    if (terminalTypes.has(node.type) && edges.length > 0) {
      fail("Terminate and respond nodes cannot have outgoing edges", {
        nodeId: node.id,
      });
    }
    if (
      node.type !== "SWITCH_ACTION" &&
      !terminalTypes.has(node.type) &&
      edges.length > 1
    ) {
      fail("Only switch nodes may have more than one outgoing edge", {
        nodeId: node.id,
      });
    }
    if (
      node.type !== "SWITCH_ACTION" &&
      edges.some((edge) => edge.branch !== undefined)
    ) {
      fail("The branch field is only valid for switch edges", {
        nodeId: node.id,
      });
    }
    if (node.type === "SWITCH_ACTION") {
      const caseIds = node.config.cases.map((entry) => entry.id);
      const caseValues = node.config.cases.map((entry) => entry.value);
      if (!unique(caseIds) || !unique(caseValues)) {
        fail("Switch case ids and values must be unique", { nodeId: node.id });
      }
      const branches = edges.map((edge) => edge.branch);
      if (branches.some((branch) => branch === undefined)) {
        fail("Every switch edge must identify a case id or default", {
          nodeId: node.id,
        });
      }
      for (const branch of [...caseIds, "default"]) {
        if (branches.filter((candidate) => candidate === branch).length !== 1) {
          fail(
            "Every switch case and default must have exactly one outgoing edge",
            { nodeId: node.id, branch },
          );
        }
      }
      const allowed = new Set([...caseIds, "default"]);
      const invalidBranch = branches.find(
        (branch) => branch !== undefined && !allowed.has(branch),
      );
      if (invalidBranch !== undefined) {
        fail("Switch edge references an unknown case", {
          nodeId: node.id,
          branch: invalidBranch,
        });
      }
    }
  }

  const queue = workflow.nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id);
  if (queue.length === 0) fail("Workflow graph has no root node");
  const mutableIndegree = new Map(indegree);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited += 1;
    for (const edge of outgoing.get(id) ?? []) {
      const nextDegree = (mutableIndegree.get(edge.target) ?? 0) - 1;
      mutableIndegree.set(edge.target, nextDegree);
      if (nextDegree === 0) queue.push(edge.target);
    }
  }
  if (visited !== workflow.nodes.length) fail("Workflow graph must be acyclic");

  for (const node of workflow.nodes) {
    if (
      (outgoing.get(node.id) ?? []).length === 0 &&
      !terminalTypes.has(node.type)
    ) {
      fail("Every workflow path must end at a terminate or respond node", {
        nodeId: node.id,
      });
    }
  }
};

const topologicalOrder = (
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
): string[] => {
  const orderIndex = new Map(nodeIds.map((id, index) => [id, index]));
  const indegree = new Map(nodeIds.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const queue = nodeIds.filter((id) => indegree.get(id) === 0);
  const result: string[] = [];
  while (queue.length > 0) {
    queue.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
    const id = queue.shift()!;
    result.push(id);
    for (const target of outgoing.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  return result;
};

const taskReferenceBases = (nodes: SimplifiedNode[]): Map<string, string> => {
  const result = new Map<string, string>();
  const used = new Map<string, number>();
  for (const node of nodes) {
    let base = node.id.replace(/[^A-Za-z0-9_]/g, "_");
    if (!/^[A-Za-z_]/.test(base)) base = `node_${base}`;
    if (!base) base = "node";
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    result.set(node.id, count === 0 ? base : `${base}_${count + 1}`);
  }
  return result;
};

const sourceHandleFor = (
  source: SimplifiedNode | undefined,
  branch?: string,
): string | null => {
  if (branch !== undefined) return branch;
  if (source?.type === "HTTP_ACTION") return "httpResult";
  if (source?.type === "DATABASE_ACTION") return "query-output";
  if (source?.type === "JEXL_ACTION" || source?.type === "SCRIPT_ACTION")
    return "scriptResult";
  return null;
};

const targetHandleFor = (target: SimplifiedNode): string | null => {
  if (target.type === "DATABASE_ACTION") return "query-input";
  if (target.type === "TERMINATE") return "terminate-input";
  if (target.type === "RESPOND_ACTION") return "respond-input";
  if (target.type === "REDIS_ACTION") return "target";
  return null;
};

export const compileSimplifiedWorkflow = (
  workflow: SimplifiedWorkflow,
): CompiledWorkflowDto => {
  validateGraph(workflow);

  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const inputIndex = new Map(
    workflow.nodes.map((node, index) => [node.id, index]),
  );
  const outgoing = new Map<string, typeof workflow.edges>();
  const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
  for (const edge of workflow.edges) {
    const values = outgoing.get(edge.source) ?? [];
    values.push(edge);
    outgoing.set(edge.source, values);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  for (const values of outgoing.values()) {
    values.sort(
      (a, b) =>
        (inputIndex.get(a.target) ?? 0) - (inputIndex.get(b.target) ?? 0),
    );
  }

  const roots = workflow.nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id);
  const graphEdges = [
    ...roots.map((target) => ({ source: "start", target })),
    ...workflow.edges.map(({ source, target }) => ({ source, target })),
  ];
  const order = topologicalOrder(
    ["start", ...workflow.nodes.map((node) => node.id)],
    graphEdges,
  );

  const depth = new Map<string, number>([["start", 0]]);
  for (const id of order) {
    const currentDepth = depth.get(id) ?? 0;
    for (const edge of graphEdges.filter((candidate) => candidate.source === id)) {
      depth.set(
        edge.target,
        Math.max(depth.get(edge.target) ?? 0, currentDepth + 1),
      );
    }
  }
  const layerCounts = new Map<number, number>();
  const positions = new Map<string, { x: number; y: number }>();
  for (const id of order) {
    const layer = depth.get(id) ?? 0;
    const ordinal = layerCounts.get(layer) ?? 0;
    layerCounts.set(layer, ordinal + 1);
    positions.set(id, { x: 60 + ordinal * 320, y: 140 + layer * 180 });
  }

  const compiledEdges: CompiledEdge[] = [
    ...roots.map((target) => ({
      source: "start",
      target,
      sourceHandle: "workflow-entry-point",
      targetHandle: targetHandleFor(nodeById.get(target)!),
    })),
    ...workflow.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: sourceHandleFor(nodeById.get(edge.source), edge.branch),
      targetHandle: targetHandleFor(nodeById.get(edge.target)!),
    })),
  ].map((edge, index) => ({
    id: `edge-${String(index + 1).padStart(4, "0")}`,
    ...edge,
  }));

  const referenceBases = taskReferenceBases(workflow.nodes);
  const occurrenceCounts = new Map<string, number>();
  const nextReference = (nodeId: string): string => {
    const base = referenceBases.get(nodeId) ?? "node";
    const count = occurrenceCounts.get(nodeId) ?? 0;
    occurrenceCounts.set(nodeId, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  };

  const taskMetadata = (
    node: SimplifiedNode,
    reference: string,
  ): Record<string, unknown> => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      _nodeId: node.id,
      _nodeName: node.name ?? node.id,
      _taskReferenceName: reference,
      _nodePosX: String(position.x),
      _nodePosY: String(position.y),
    };
  };

  const compileNonSwitchTasks = (node: SimplifiedNode): CompiledTask[] => {
    const reference = nextReference(node.id);
    const metadata = taskMetadata(node, reference);
    switch (node.type) {
      case "HTTP_ACTION":
        return [
          {
            name: "HttpWorker",
            taskReferenceName: reference,
            inputParameters: { ...metadata, ...node.config },
            type: "SIMPLE",
          },
        ];
      case "DATABASE_ACTION":
        return [
          {
            name: "DatabaseWorker",
            taskReferenceName: reference,
            inputParameters: { ...metadata, ...node.config },
            type: "SIMPLE",
          },
        ];
      case "JEXL_ACTION":
        return [
          {
            name: "ScriptWorker",
            taskReferenceName: reference,
            inputParameters: {
              ...metadata,
              script: node.config.expression,
              variables: node.config.variables,
              language: "JEXL",
              timeout: node.config.timeout,
            },
            type: "SIMPLE",
          },
        ];
      case "SCRIPT_ACTION":
        return [
          {
            name: "ScriptWorker",
            taskReferenceName: reference,
            inputParameters: {
              ...metadata,
              script: node.config.expression,
              variables: node.config.variables,
              language: node.config.language,
              timeout: node.config.timeout,
            },
            type: "SIMPLE",
          },
        ];
      case "REDIS_ACTION":
        return [
          {
            name: "RedisWorker",
            taskReferenceName: reference,
            inputParameters: { ...metadata, ...node.config },
            type: "SIMPLE",
          },
        ];
      case "VALIDATION_ACTION":
        return [
          {
            name: "ValidationWorker",
            taskReferenceName: reference,
            inputParameters: { ...metadata, ...node.config },
            type: "SIMPLE",
          },
        ];
      case "RULE_ENGINE_ACTION":
        return [
          {
            name: "RuleEngineWorker",
            taskReferenceName: reference,
            inputParameters: { ...metadata, ...node.config },
            type: "SIMPLE",
          },
        ];
      case "WAIT_ACTION":
        return [
          {
            name: "wait",
            taskReferenceName: reference,
            inputParameters: {
              ...metadata,
              mode: node.config.mode,
              duration:
                node.config.mode === "DURATION"
                  ? node.config.duration
                  : "",
              until:
                node.config.mode === "UNTIL" ? node.config.until : "",
            },
            type: "WAIT",
          },
        ];
      case "RESPOND_ACTION": {
        const terminateReference = `terminate_${reference}`;
        return [
          {
            name: "RespondWorker",
            taskReferenceName: reference,
            inputParameters: {
              ...metadata,
              messageCode: node.config.messageCode,
              languageCode: node.config.languageCode,
              workflowName:
                node.config.workflowName ?? workflow.workflowName,
              workflowVersion:
                node.config.workflowVersion ?? workflow.version,
              variables: node.config.variables,
              workflowInput: node.config.workflowInput,
            },
            type: "SIMPLE",
          },
          {
            name: "terminate",
            taskReferenceName: terminateReference,
            inputParameters: {
              ...metadata,
              _nodeName: `${node.name ?? node.id} Terminate`,
              _taskReferenceName: terminateReference,
              terminationStatus: "COMPLETED",
              workflowOutput: `\${${reference}.output}`,
              terminationReason: "Workflow responded to client",
            },
            type: "TERMINATE",
          },
        ];
      }
      case "TERMINATE":
        return [
          {
            name: "terminate",
            taskReferenceName: reference,
            inputParameters: {
              ...metadata,
              terminationStatus: node.config.status,
              workflowOutput: node.config.output,
              terminationReason: node.config.reason,
            },
            type: "TERMINATE",
          },
        ];
      case "SWITCH_ACTION":
        return fail("Switch tasks must be compiled with their branches", {
          nodeId: node.id,
        });
    }
  };

  const buildBranch = (nodeId: string, visited: Set<string>): CompiledTask[] => {
    if (visited.has(nodeId)) return [];
    const node = nodeById.get(nodeId);
    if (node === undefined) return [];
    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);

    if (node.type === "SWITCH_ACTION") {
      const reference = nextReference(node.id);
      const metadata = taskMetadata(node, reference);
      const nodeEdges = outgoing.get(node.id) ?? [];
      const decisionCases: Record<string, CompiledTask[]> = {};
      for (const switchCase of node.config.cases) {
        const edge = nodeEdges.find(
          (candidate) => candidate.branch === switchCase.id,
        )!;
        decisionCases[switchCase.value] = buildBranch(
          edge.target,
          nextVisited,
        );
      }
      const defaultEdge = nodeEdges.find(
        (candidate) => candidate.branch === "default",
      )!;
      return [
        {
          name: "switch",
          taskReferenceName: reference,
          inputParameters: {
            ...metadata,
            ...node.config.inputParameters,
            switchCaseValue: node.config.switchCaseValue,
          },
          type: "SWITCH",
          evaluatorType: node.config.evaluatorType,
          expression:
            node.config.evaluatorType === "value-param"
              ? "switchCaseValue"
              : (node.config.expression ?? ""),
          decisionCases,
          defaultCase: buildBranch(defaultEdge.target, nextVisited),
        },
      ];
    }

    const current = compileNonSwitchTasks(node);
    const nextEdge = (outgoing.get(node.id) ?? [])[0];
    return nextEdge === undefined
      ? current
      : [...current, ...buildBranch(nextEdge.target, nextVisited)];
  };

  const tasks = roots.flatMap((root) => buildBranch(root, new Set(["start"])));

  return {
    name: workflow.workflowName,
    version: workflow.version,
    ...(workflow.description === undefined
      ? {}
      : { description: workflow.description }),
    ownerEmail: "conductor.wrapper@vodafone.com",
    timeoutPolicy: workflow.timeoutPolicy,
    _inputs: workflow.inputs,
    timeoutSeconds: workflow.timeoutSeconds,
    variables: workflow.variables,
    _builderSchemaVersion: 2,
    tasks,
    edges: compiledEdges,
    schemaVersion: 2,
    restartable: workflow.restartable,
  };
};
