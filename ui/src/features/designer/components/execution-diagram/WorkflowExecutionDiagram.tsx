import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/features/designer/styles/Designer.css";
import { CircularProgress } from "@mui/material";
import { FiAlertCircle } from "react-icons/fi";
import { ArrowDownUp, ArrowRight, Maximize2 } from "lucide-react";
import { WeaverBranchEdge } from "@/features/designer/components/edges/WeaverBranchEdge";
import {
  getStoredLayoutDirection,
  setStoredLayoutDirection,
  type LayoutDirection,
} from "@/features/designer/utils/autoLayout";
import { ExecutionEndNode, ExecutionStartNode, ExecutionTaskNode } from "./ExecutionDiagramNodes";
import {
  applyExecutionState,
  buildExecutionDiagramGraph,
  recomputeExecutionDiagramLayout,
} from "./executionDiagramGraph";
import { EXECUTION_NODE_TYPES } from "./executionDiagramNodeTypes";
import { useExecutionDiagramDefinition } from "./useExecutionDiagramDefinition";
import type {
  ExecutionDiagramNode,
  WorkflowExecutionDiagramProps,
  ExecutionDiagramTaskState,
} from "./WorkflowExecutionDiagram.types";
import styles from "./WorkflowExecutionDiagram.module.css";

const nodeTypes = {
  [EXECUTION_NODE_TYPES.start]: ExecutionStartNode,
  [EXECUTION_NODE_TYPES.end]: ExecutionEndNode,
  [EXECUTION_NODE_TYPES.task]: ExecutionTaskNode,
};

const FIT_VIEW_OPTIONS = { padding: 0.15, minZoom: 0.2, maxZoom: 1.2 };

interface NodeSize {
  width: number;
  height: number;
}

const edgeTypes = {
  weaverBranchEdge: WeaverBranchEdge,
  step: WeaverBranchEdge,
  smoothstep: WeaverBranchEdge,
  default: WeaverBranchEdge,
};

interface ExecutionCanvasInnerProps {
  definition: unknown;
  taskStates: Record<string, ExecutionDiagramTaskState>;
  selectedTaskReferenceName?: string | null;
  onSelectTask?: (taskReferenceName: string | null) => void;
  direction: LayoutDirection;
  onDirectionChange: (dir: LayoutDirection) => void;
}

function ExecutionCanvasInner({
  definition,
  taskStates,
  selectedTaskReferenceName,
  onSelectTask,
  direction,
  onDirectionChange,
}: ExecutionCanvasInnerProps) {
  const { fitView } = useReactFlow();

  // Rendered node sizes reported by React Flow. The designer lays out with measured sizes, so the
  // execution view must too, otherwise the fallback size estimates produce a different arrangement.
  const [nodeSizes, setNodeSizes] = useState<Record<string, NodeSize>>({});

  const handleNodesChange = useCallback((changes: NodeChange<ExecutionDiagramNode>[]) => {
    setNodeSizes((prev) => {
      let next = prev;
      changes.forEach((change) => {
        if (change.type !== "dimensions" || !change.dimensions) return;
        const width = Math.round(change.dimensions.width);
        const height = Math.round(change.dimensions.height);
        if (width <= 0 || height <= 0) return;
        const current = next[change.id];
        if (current?.width === width && current?.height === height) return;
        if (next === prev) next = { ...prev };
        next[change.id] = { width, height };
      });
      return next;
    });
  }, []);

  // 1. Base graph laid out with estimated node sizes
  const baseGraph = useMemo(
    () => buildExecutionDiagramGraph(definition, direction),
    [definition, direction]
  );

  // 2. Once every node is measured, re-run the designer's auto layout with the real sizes
  const layoutGraph = useMemo(() => {
    const nodes = baseGraph.nodes.map((node) =>
      nodeSizes[node.id] ? { ...node, measured: nodeSizes[node.id] } : node
    );
    const allMeasured = nodes.length > 0 && nodes.every((node) => node.measured);
    return allMeasured
      ? recomputeExecutionDiagramLayout(nodes, baseGraph.edges, direction)
      : { nodes, edges: baseGraph.edges };
  }, [baseGraph, nodeSizes, direction]);

  // 3. Overlay runtime execution states onto nodes & edges
  const stateGraph = useMemo(
    () => applyExecutionState(layoutGraph, taskStates, selectedTaskReferenceName),
    [layoutGraph, taskStates, selectedTaskReferenceName]
  );

  // Fit once per definition/direction after the measured layout lands, not on every status poll.
  const fittedGraphRef = useRef<typeof baseGraph | null>(null);
  const isLayoutMeasured = layoutGraph.nodes.length > 0 && layoutGraph.nodes.every((node) => node.measured);
  useEffect(() => {
    if (!isLayoutMeasured || fittedGraphRef.current === baseGraph) return;
    fittedGraphRef.current = baseGraph;
    const frame = window.requestAnimationFrame(() => {
      fitView({ duration: 400, ...FIT_VIEW_OPTIONS });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isLayoutMeasured, baseGraph, fitView]);

  // Click handler
  const handleNodeClick: NodeMouseHandler<ExecutionDiagramNode> = (_event, node) => {
    if (node.data.kind !== "task" || !node.data.taskReferenceName) return;
    onSelectTask?.(
      node.data.taskReferenceName === selectedTaskReferenceName ? null : node.data.taskReferenceName
    );
  };

  // Nodes are not draggable, so the layout is always the auto layout; re-arranging only re-fits it.
  const handleAutoArrange = useCallback(() => {
    fitView({ duration: 450, ...FIT_VIEW_OPTIONS });
  }, [fitView]);

  const handleToggleDirection = (newDir: LayoutDirection) => {
    if (newDir === direction) return;
    onDirectionChange(newDir);
  };

  return (
    <div className={`designer-workspace ${styles.canvas}`}>
      <ReactFlow
        nodes={stateGraph.nodes}
        edges={stateGraph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelectTask?.(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-left" />

        {/* Floating Auto Layout Control toolbar matching the workflow designer */}
        <Panel position="top-right">
          <div className={styles.autoLayoutControl} role="toolbar" aria-label="Auto Layout Controls">
            <button
              type="button"
              className={styles.mainButton}
              onClick={handleAutoArrange}
              title={`Auto Arrange (${direction === "LR" ? "Left to Right" : "Top to Bottom"})`}
            >
              <span className={styles.buttonIcon}>
                {direction === "LR" ? <ArrowRight size={14} /> : <ArrowDownUp size={14} />}
              </span>
              <span>Auto Arrange</span>
            </button>

            <div className={styles.divider} />

            <div className={styles.directionToggle} role="group" aria-label="Layout Direction">
              <button
                type="button"
                className={`${styles.directionButton} ${direction === "TB" ? styles.active : ""}`}
                onClick={() => handleToggleDirection("TB")}
                title="Top to Bottom (Vertical Layout)"
              >
                TB
              </button>
              <button
                type="button"
                className={`${styles.directionButton} ${direction === "LR" ? styles.active : ""}`}
                onClick={() => handleToggleDirection("LR")}
                title="Left to Right (Horizontal Layout)"
              >
                LR
              </button>
            </div>

            <div className={styles.divider} />

            <button
              type="button"
              className={styles.fitButton}
              onClick={() => fitView({ duration: 400, ...FIT_VIEW_OPTIONS })}
              title="Fit to Screen"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

/**
 * Read-only workflow canvas for an execution: renders the designer's nodes with each task's
 * runtime status, auto-layouted using the exact designer layout engine.
 */
export function WorkflowExecutionDiagram({
  workflowName,
  workflowVersion,
  fallbackDefinition,
  taskStates,
  selectedTaskReferenceName,
  onSelectTask,
}: WorkflowExecutionDiagramProps) {
  const [direction, setDirection] = useState<LayoutDirection>(() => getStoredLayoutDirection() || "TB");

  const { definition, loading, errorMessage } = useExecutionDiagramDefinition(
    workflowName,
    workflowVersion,
    fallbackDefinition
  );

  const handleDirectionChange = useCallback((newDir: LayoutDirection) => {
    setStoredLayoutDirection(newDir);
    setDirection(newDir);
  }, []);

  if (loading) {
    return (
      <div className={styles.statusMessage}>
        <CircularProgress size={24} style={{ color: "var(--color-accent-fg)" }} />
        <span>Loading workflow diagram...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={`${styles.statusMessage} ${styles.errorMessage}`} role="alert">
        <FiAlertCircle size={18} />
        <span>{errorMessage}</span>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ExecutionCanvasInner
        definition={definition}
        taskStates={taskStates}
        selectedTaskReferenceName={selectedTaskReferenceName}
        onSelectTask={onSelectTask}
        direction={direction}
        onDirectionChange={handleDirectionChange}
      />
    </ReactFlowProvider>
  );
}

export default WorkflowExecutionDiagram;
