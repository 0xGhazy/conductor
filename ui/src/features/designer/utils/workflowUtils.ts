import { formatNodePosition } from "@/features/designer/utils/positionFormat";

const START_NODE_ID = "00000000-0000-0000-0000-000000000000";
const LEGACY_START_NODE_ID = "start";

const isStartNode = (node) =>
  node?.id === START_NODE_ID || node?.id === LEGACY_START_NODE_ID || node?.type === "startFlag";

const isStartNodeId = (nodeId) => nodeId === START_NODE_ID || nodeId === LEGACY_START_NODE_ID;

export { buildExportPayload } from "./workflowSerialization";

export const validateOrphanNodes = (nodes, edges) => {
  const orphanNodes = nodes.filter((node) => {
    if (isStartNode(node)) return false;
    return !edges.some((edge) => edge.target === node.id);
  });

  if (orphanNodes.length > 0) {
    const orphanNames = orphanNodes
      .map((n) => n.data?.name || n.id)
      .join(", ");

    return {
      valid: false,
      message: `The following node(s) have no incoming connections:\n\n${orphanNames}\n\nEvery node (except the start node) must have at least one incoming edge. Please connect these nodes before proceeding.`,
    };
  }

  return { valid: true, message: null };
};

export const validateFlowHasDatabaseAction = (nodes, edges) => {
  const orphanValidation = validateOrphanNodes(nodes, edges);
  if (!orphanValidation.valid) {
    return orphanValidation;
  }

  const startNode = nodes.find((node) => isStartNode(node));
  if (!startNode) {
    return {
      valid: false,
      message: "Start node not found",
    };
  }

  const hasStartConnection = edges.some((edge) => isStartNodeId(edge.source));
  if (!hasStartConnection) {
    return {
      valid: false,
      message: "Flow must start from the start node. Connect the start node to an action.",
    };
  }

  const graph = new Map();
  edges.forEach((edge) => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source).push(edge.target);
  });

  const nodeTypeMap = new Map();
  nodes.forEach((node) => {
    nodeTypeMap.set(node.id, node.type);
  });

  const invalidPaths = [];
  const visitedInPath = new Set();

  const dfs = (currentNodeId, path) => {
    if (visitedInPath.has(currentNodeId)) return;

    const currentNodeType = nodeTypeMap.get(currentNodeId);
    if (!currentNodeType) return;

    visitedInPath.add(currentNodeId);
    const nextPath = [...path, currentNodeId];
    const neighbors = graph.get(currentNodeId) || [];

    if (neighbors.length === 0) {
      if (currentNodeType !== "terminateAction") {
        invalidPaths.push(nextPath);
      }
      visitedInPath.delete(currentNodeId);
      return;
    }

    if (currentNodeType === "terminateAction") {
      visitedInPath.delete(currentNodeId);
      return;
    }

    neighbors.forEach((neighborId) => dfs(neighborId, nextPath));
    visitedInPath.delete(currentNodeId);
  };

  dfs(startNode.id, []);

  if (invalidPaths.length > 0) {
    return {
      valid: false,
      message:
        "Some flow paths do not end with a Terminate action. Please ensure all paths from start end with a Terminate action.",
    };
  }

  return {
    valid: true,
    message: "All flows are properly connected and end with Terminate actions.",
  };
};

export const downloadWorkflowJSON = async (payload, filename = "workflow.json") => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

