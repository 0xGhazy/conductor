import { Position, type Edge, type Node } from "@xyflow/react";
import { END_NODE_ID } from "@/features/designer/constants/workflowNodes";
import { isScopeNode, type WorkflowNode } from "@/features/designer/services/scopeGraph";
import { calculateAutoLayout, type LayoutDirection } from "@/features/designer/utils/autoLayout";
import {
  computeStyledEdges,
  createGhostEndEdges,
  getSourceHandleIndex,
  getTerminalNodes,
  isEndNode,
  isStartNode,
} from "@/features/designer/utils/designerGraphUtils";
import { normalizeWorkflowDtoJsonToTopology } from "@/features/designer/utils/workflowSerialization";
import { resolveTaskReferenceName } from "@/features/designer/nodes/WeaverTaskNode/resolveTaskReferenceName";
import { EXECUTION_NODE_TYPES } from "./executionDiagramNodeTypes";
import type {
  ExecutionDiagramGraph,
  ExecutionDiagramNode,
  ExecutionDiagramNodeKind,
  ExecutionDiagramTaskState,
} from "./WorkflowExecutionDiagram.types";

interface StoredNodeData {
  kind?: string;
  name?: string;
  config?: Record<string, unknown>;
}

const resolveKind = (node: Node): ExecutionDiagramNodeKind => {
  if (isStartNode(node)) return "start";
  if (isEndNode(node)) return "end";
  return "task";
};

const pushUnique = (list: Array<string | null>, value: unknown) => {
  const handleId = value == null || value === "" ? null : String(value);
  if (!list.includes(handleId)) list.push(handleId);
};

/**
 * Turns a stored workflow definition (designer topology or workflow DTO) into a laid-out,
 * read-only graph: scopes are flattened, terminal tasks are joined to End like in the designer,
 * and every node lists the handle ids its edges use so they can be rendered without the editor.
 */
export const buildExecutionDiagramGraph = (
  definition: unknown,
  direction: LayoutDirection = "TB"
): ExecutionDiagramGraph => {
  const topology = normalizeWorkflowDtoJsonToTopology(definition ?? {});
  const rawNodes: Node[] = Array.isArray(topology?.nodes) ? topology.nodes : [];
  const rawEdges: Edge[] = Array.isArray(topology?.edges) ? topology.edges : [];

  const nodes: Node[] = rawNodes
    .filter((node) => node?.id && !isScopeNode(node as WorkflowNode))
    .map((node) => ({
      ...node,
      parentId: undefined,
      extent: undefined,
      selected: false,
      position: node.position ?? { x: 0, y: 0 },
    }));

  if (!nodes.some((node) => isEndNode(node))) {
    nodes.push({ id: END_NODE_ID, type: "endFlag", position: { x: 0, y: 0 }, data: { name: "End" } });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const endNodeId = nodes.find((node) => isEndNode(node))!.id;
  const realEdges: Edge[] = rawEdges.filter(
    (edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target) && !edge.id?.startsWith("ghost-edge-")
  );
  const ghostEdges = createGhostEndEdges(getTerminalNodes(nodes, realEdges), endNodeId).filter(
    (ghost) => !realEdges.some((edge) => edge.source === ghost.source && edge.target === endNodeId)
  );
  const allEdges = [...realEdges, ...ghostEdges];

  const { nodes: laidOutNodes } = calculateAutoLayout(nodes, allEdges, { direction });
  const styledEdges = computeStyledEdges(allEdges, laidOutNodes).map((edge) => ({
    ...edge,
    selectable: false,
    focusable: false,
  }));

  const sourceHandles = new Map<string, Array<string | null>>();
  const targetHandles = new Map<string, Array<string | null>>();
  const nodeById = new Map(laidOutNodes.map((node) => [node.id, node]));
  [...styledEdges]
    .sort(
      (a, b) =>
        getSourceHandleIndex(nodeById.get(a.source), a.sourceHandle) -
        getSourceHandleIndex(nodeById.get(b.source), b.sourceHandle)
    )
    .forEach((edge) => {
      if (!sourceHandles.has(edge.source)) sourceHandles.set(edge.source, []);
      if (!targetHandles.has(edge.target)) targetHandles.set(edge.target, []);
      pushUnique(sourceHandles.get(edge.source)!, edge.sourceHandle);
      pushUnique(targetHandles.get(edge.target)!, edge.targetHandle);
    });

  const diagramNodes: ExecutionDiagramNode[] = laidOutNodes.map((node) => {
    const data = (node.data ?? {}) as StoredNodeData;
    const kind = resolveKind(node);
    return {
      id: node.id,
      type: EXECUTION_NODE_TYPES[kind],
      position: node.position,
      sourcePosition: direction === "LR" ? Position.Right : Position.Bottom,
      targetPosition: direction === "LR" ? Position.Left : Position.Top,
      draggable: false,
      connectable: false,
      selectable: false,
      // Non-draggable nodes are not `nopan` by default, so a press on them starts a pan and any
      // pointer jitter swallows the click. Task nodes must stay clickable.
      className: kind === "task" ? "nopan" : undefined,
      data: {
        kind,
        nodeType: String(node.type || data.kind || ""),
        name: data.name,
        config: data.config,
        taskReferenceName: kind === "task" ? resolveTaskReferenceName(data.config, "") : "",
        sourceHandleIds: sourceHandles.get(node.id) ?? [],
        targetHandleIds: targetHandles.get(node.id) ?? [],
        direction,
      },
    };
  });

  return { nodes: diagramNodes, edges: styledEdges };
};

/**
 * Re-runs auto-layout with measured node dimensions or updated direction,
 * matching the workflow designer page's auto layout engine.
 */
export const recomputeExecutionDiagramLayout = (
  nodes: ExecutionDiagramNode[],
  edges: Edge[],
  direction: LayoutDirection
): ExecutionDiagramGraph => {
  const { nodes: laidOutNodes } = calculateAutoLayout(nodes, edges, { direction });
  const positionMap = new Map(laidOutNodes.map((n) => [n.id, n.position]));

  const updatedNodes: ExecutionDiagramNode[] = nodes.map((node) => {
    const newPos = positionMap.get(node.id);
    return {
      ...node,
      position: newPos ?? node.position,
      sourcePosition: direction === "LR" ? Position.Right : Position.Bottom,
      targetPosition: direction === "LR" ? Position.Left : Position.Top,
      data: {
        ...node.data,
        direction,
      },
    };
  });

  const styledEdges = computeStyledEdges(edges, updatedNodes).map((edge) => ({
    ...edge,
    selectable: false,
    focusable: false,
  }));

  return { nodes: updatedNodes, edges: styledEdges };
};

/** Overlays runtime task states and selection onto a laid-out graph without re-running layout. */
export const applyExecutionState = (
  graph: ExecutionDiagramGraph,
  taskStates: Record<string, ExecutionDiagramTaskState>,
  selectedTaskReferenceName: string | null | undefined
): ExecutionDiagramGraph => {
  const reachedNodeIds = new Set<string>();
  const nodes = graph.nodes.map((node) => {
    const executionState = node.data.taskReferenceName
      ? taskStates[node.data.taskReferenceName]
      : undefined;
    if (node.data.kind === "start" || executionState) reachedNodeIds.add(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        executionState,
        selected: Boolean(selectedTaskReferenceName) && node.data.taskReferenceName === selectedTaskReferenceName,
      },
    };
  });

  const endNodeIds = new Set(nodes.filter((node) => node.data.kind === "end").map((node) => node.id));
  const edges = graph.edges.map((edge) => {
    const traversed =
      reachedNodeIds.has(edge.source) && (endNodeIds.has(edge.target) || reachedNodeIds.has(edge.target));
    return traversed
      ? edge
      : { ...edge, style: { ...(edge.style || {}), opacity: 0.35 } };
  });

  return { nodes, edges };
};
