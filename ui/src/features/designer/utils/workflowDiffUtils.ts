import { isStartNodeId, isEndNodeId } from "./designerGraphUtils";

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface ParameterDiffItem {
  key: string;
  path: string;
  oldValue: any;
  newValue: any;
  status: "added" | "removed" | "modified";
}

export interface NodeDiffResult {
  id: string;
  taskReferenceName: string;
  nodeType: string;
  title: string;
  status: DiffStatus;
  baseNode?: any;
  targetNode?: any;
  parameterDiffs: ParameterDiffItem[];
}

export interface EdgeDiffResult {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  status: DiffStatus;
}

export interface WorkflowDiffSummary {
  addedNodes: number;
  removedNodes: number;
  modifiedNodes: number;
  unchangedNodes: number;
  totalNodeChanges: number;
  addedEdges: number;
  removedEdges: number;
  unchangedEdges: number;
  totalEdgeChanges: number;
  hasChanges: boolean;
}

export interface WorkflowDiffResult {
  summary: WorkflowDiffSummary;
  nodeDiffs: Map<string, NodeDiffResult>;
  edgeDiffs: Map<string, EdgeDiffResult>;
  baseNodesDecorated: any[];
  targetNodesDecorated: any[];
  baseEdgesDecorated: any[];
  targetEdgesDecorated: any[];
}

/**
 * Returns a stable key to match a node across versions.
 * Special nodes (Start, End) match by their canonical IDs.
 * Task nodes match by taskReferenceName or ID.
 */
export const getNodeMatchKey = (node: any): string => {
  if (!node) return "";
  const id = String(node.id || "").trim();
  if (isStartNodeId(id)) return "__start_node__";
  if (isEndNodeId(id) || id === "end") return "__end_node__";

  const refName =
    node.data?.config?.taskReferenceName ||
    node.data?.taskReferenceName ||
    node.data?.config?.referenceName ||
    node.data?.config?.name;

  if (refName && String(refName).trim()) {
    return String(refName).trim();
  }

  return id;
};

/**
 * Generates a stable key for an edge across versions.
 */
export const getEdgeMatchKey = (edge: any): string => {
  if (!edge) return "";
  const source = String(edge.source || "");
  const target = String(edge.target || "");
  const sourceHandle = edge.sourceHandle ? String(edge.sourceHandle) : "";
  const targetHandle = edge.targetHandle ? String(edge.targetHandle) : "";
  return `${source}[${sourceHandle}]->${target}[${targetHandle}]`;
};

/**
 * Performs a deep comparison of two values and extracts granular field-level diffs.
 */
export const extractFieldDiffs = (
  baseObj: any,
  targetObj: any,
  parentPath = ""
): ParameterDiffItem[] => {
  const diffs: ParameterDiffItem[] = [];

  const isObject = (val: any) =>
    val !== null && typeof val === "object" && !Array.isArray(val);

  const base = isObject(baseObj) ? baseObj : {};
  const target = isObject(targetObj) ? targetObj : {};

  const allKeys = Array.from(new Set([...Object.keys(base), ...Object.keys(target)])).sort();

  for (const key of allKeys) {
    // Skip transient or internal runtime properties
    if (key.startsWith("__") || key === "selected" || key === "dragging") {
      continue;
    }

    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    const hasBase = Object.prototype.hasOwnProperty.call(base, key);
    const hasTarget = Object.prototype.hasOwnProperty.call(target, key);

    if (hasBase && !hasTarget) {
      diffs.push({
        key,
        path: currentPath,
        oldValue: base[key],
        newValue: undefined,
        status: "removed",
      });
    } else if (!hasBase && hasTarget) {
      diffs.push({
        key,
        path: currentPath,
        oldValue: undefined,
        newValue: target[key],
        status: "added",
      });
    } else {
      const valA = base[key];
      const valB = target[key];

      if (isObject(valA) && isObject(valB)) {
        const nestedDiffs = extractFieldDiffs(valA, valB, currentPath);
        diffs.push(...nestedDiffs);
      } else {
        const serializedA = JSON.stringify(valA);
        const serializedB = JSON.stringify(valB);
        if (serializedA !== serializedB) {
          diffs.push({
            key,
            path: currentPath,
            oldValue: valA,
            newValue: valB,
            status: "modified",
          });
        }
      }
    }
  }

  return diffs;
};

/**
 * Extracts comparable configuration from a node, ignoring canvas positions and internal xyflow state.
 */
export const extractNodeComparableConfig = (node: any): Record<string, any> => {
  if (!node) return {};
  const config = node.data?.config ? { ...node.data.config } : {};
  const data = node.data ? { ...node.data } : {};
  delete data.config;
  delete data.diffStatus;
  delete data.parameterDiffs;

  return {
    nodeType: node.type || "default",
    name: data.name || config.nodeName || "",
    ...config,
  };
};

/**
 * Computes complete workflow diff between Base (Version A) and Target (Version B).
 */
export const calculateWorkflowDiff = (
  baseNodes: any[] = [],
  baseEdges: any[] = [],
  targetNodes: any[] = [],
  targetEdges: any[] = []
): WorkflowDiffResult => {
  const baseNodesMap = new Map<string, any>();
  const targetNodesMap = new Map<string, any>();

  baseNodes.forEach((node) => {
    const key = getNodeMatchKey(node);
    if (key) baseNodesMap.set(key, node);
  });

  targetNodes.forEach((node) => {
    const key = getNodeMatchKey(node);
    if (key) targetNodesMap.set(key, node);
  });

  const allNodeKeys = Array.from(
    new Set([...baseNodesMap.keys(), ...targetNodesMap.keys()])
  );

  const nodeDiffs = new Map<string, NodeDiffResult>();
  let addedNodes = 0;
  let removedNodes = 0;
  let modifiedNodes = 0;
  let unchangedNodes = 0;

  for (const key of allNodeKeys) {
    const baseNode = baseNodesMap.get(key);
    const targetNode = targetNodesMap.get(key);

    if (!baseNode && targetNode) {
      // Added in target
      addedNodes++;
      const nodeType = targetNode.type || "default";
      const title =
        targetNode.data?.config?.nodeName ||
        targetNode.data?.name ||
        targetNode.data?.title ||
        key;
      nodeDiffs.set(key, {
        id: targetNode.id,
        taskReferenceName: key,
        nodeType,
        title,
        status: "added",
        targetNode,
        parameterDiffs: [],
      });
    } else if (baseNode && !targetNode) {
      // Removed from target
      removedNodes++;
      const nodeType = baseNode.type || "default";
      const title =
        baseNode.data?.config?.nodeName ||
        baseNode.data?.name ||
        baseNode.data?.title ||
        key;
      nodeDiffs.set(key, {
        id: baseNode.id,
        taskReferenceName: key,
        nodeType,
        title,
        status: "removed",
        baseNode,
        parameterDiffs: [],
      });
    } else if (baseNode && targetNode) {
      // Present in both - compare configs
      const baseConfig = extractNodeComparableConfig(baseNode);
      const targetConfig = extractNodeComparableConfig(targetNode);
      const parameterDiffs = extractFieldDiffs(baseConfig, targetConfig);

      const status: DiffStatus = parameterDiffs.length > 0 ? "modified" : "unchanged";
      if (status === "modified") {
        modifiedNodes++;
      } else {
        unchangedNodes++;
      }

      const nodeType = targetNode.type || baseNode.type || "default";
      const title =
        targetNode.data?.config?.nodeName ||
        targetNode.data?.name ||
        baseNode.data?.config?.nodeName ||
        baseNode.data?.name ||
        key;

      nodeDiffs.set(key, {
        id: targetNode.id || baseNode.id,
        taskReferenceName: key,
        nodeType,
        title,
        status,
        baseNode,
        targetNode,
        parameterDiffs,
      });
    }
  }

  // Edge Diffs
  const baseEdgesMap = new Map<string, any>();
  const targetEdgesMap = new Map<string, any>();

  baseEdges.forEach((edge) => {
    const key = getEdgeMatchKey(edge);
    if (key) baseEdgesMap.set(key, edge);
  });

  targetEdges.forEach((edge) => {
    const key = getEdgeMatchKey(edge);
    if (key) targetEdgesMap.set(key, edge);
  });

  const allEdgeKeys = Array.from(
    new Set([...baseEdgesMap.keys(), ...targetEdgesMap.keys()])
  );

  const edgeDiffs = new Map<string, EdgeDiffResult>();
  let addedEdges = 0;
  let removedEdges = 0;
  let unchangedEdges = 0;

  for (const key of allEdgeKeys) {
    const baseEdge = baseEdgesMap.get(key);
    const targetEdge = targetEdgesMap.get(key);

    if (!baseEdge && targetEdge) {
      addedEdges++;
      edgeDiffs.set(key, {
        id: targetEdge.id,
        source: targetEdge.source,
        target: targetEdge.target,
        sourceHandle: targetEdge.sourceHandle,
        targetHandle: targetEdge.targetHandle,
        status: "added",
      });
    } else if (baseEdge && !targetEdge) {
      removedEdges++;
      edgeDiffs.set(key, {
        id: baseEdge.id,
        source: baseEdge.source,
        target: baseEdge.target,
        sourceHandle: baseEdge.sourceHandle,
        targetHandle: baseEdge.targetHandle,
        status: "removed",
      });
    } else {
      unchangedEdges++;
      edgeDiffs.set(key, {
        id: targetEdge.id || baseEdge.id,
        source: targetEdge.source,
        target: targetEdge.target,
        sourceHandle: targetEdge.sourceHandle,
        targetHandle: targetEdge.targetHandle,
        status: "unchanged",
      });
    }
  }

  // Decorate Base Nodes (Canvas A)
  const baseNodesDecorated = baseNodes.map((node) => {
    const key = getNodeMatchKey(node);
    const diff = nodeDiffs.get(key);
    const diffStatus = diff?.status === "removed" ? "removed" : diff?.status === "modified" ? "modified" : "unchanged";
    return {
      ...node,
      data: {
        ...(node.data || {}),
        diffStatus,
        parameterDiffs: diff?.parameterDiffs || [],
      },
    };
  });

  // Decorate Target Nodes (Canvas B)
  const targetNodesDecorated = targetNodes.map((node) => {
    const key = getNodeMatchKey(node);
    const diff = nodeDiffs.get(key);
    const diffStatus = diff?.status === "added" ? "added" : diff?.status === "modified" ? "modified" : "unchanged";
    return {
      ...node,
      data: {
        ...(node.data || {}),
        diffStatus,
        parameterDiffs: diff?.parameterDiffs || [],
      },
    };
  });

  // Decorate Base Edges (Canvas A)
  const baseEdgesDecorated = baseEdges.map((edge) => {
    const key = getEdgeMatchKey(edge);
    const diff = edgeDiffs.get(key);
    const diffStatus = diff?.status === "removed" ? "removed" : "unchanged";
    return {
      ...edge,
      data: {
        ...(edge.data || {}),
        diffStatus,
      },
    };
  });

  // Decorate Target Edges (Canvas B)
  const targetEdgesDecorated = targetEdges.map((edge) => {
    const key = getEdgeMatchKey(edge);
    const diff = edgeDiffs.get(key);
    const diffStatus = diff?.status === "added" ? "added" : "unchanged";
    return {
      ...edge,
      data: {
        ...(edge.data || {}),
        diffStatus,
      },
    };
  });

  const totalNodeChanges = addedNodes + removedNodes + modifiedNodes;
  const totalEdgeChanges = addedEdges + removedEdges;
  const hasChanges = totalNodeChanges > 0 || totalEdgeChanges > 0;

  return {
    summary: {
      addedNodes,
      removedNodes,
      modifiedNodes,
      unchangedNodes,
      totalNodeChanges,
      addedEdges,
      removedEdges,
      unchangedEdges,
      totalEdgeChanges,
      hasChanges,
    },
    nodeDiffs,
    edgeDiffs,
    baseNodesDecorated,
    targetNodesDecorated,
    baseEdgesDecorated,
    targetEdgesDecorated,
  };
};

/**
 * Helper to pretty format any value for display in parameter diff view.
 */
export const formatDiffValue = (val: any): string => {
  if (val === undefined) return "—";
  if (val === null) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
};
