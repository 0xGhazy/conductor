import type { Edge, Node } from "@xyflow/react";
import type { LayoutDirection } from "@/features/designer/utils/autoLayout";

/** Runtime state of one task, keyed by its task reference name. */
export interface ExecutionDiagramTaskState {
  status: string;
  durationMs?: number;
  errorMessage?: string;
}

export type ExecutionDiagramNodeKind = "start" | "end" | "task";

export interface ExecutionDiagramNodeData extends Record<string, unknown> {
  kind: ExecutionDiagramNodeKind;
  /** The designer node type (e.g. HTTP_ACTION), used to resolve icon, color and title. */
  nodeType: string;
  name?: string;
  config?: Record<string, unknown>;
  taskReferenceName: string;
  /** Handle ids used by edges touching this node (`null` is the default handle). */
  sourceHandleIds: Array<string | null>;
  targetHandleIds: Array<string | null>;
  executionState?: ExecutionDiagramTaskState;
  selected?: boolean;
  direction?: LayoutDirection;
}

export type ExecutionDiagramNode = Node<ExecutionDiagramNodeData>;

export interface ExecutionDiagramGraph {
  nodes: ExecutionDiagramNode[];
  edges: Edge[];
}

export interface WorkflowExecutionDiagramProps {
  workflowName: string;
  workflowVersion?: number | string;
  /** Definition embedded in the execution, used when the stored workflow cannot be loaded. */
  fallbackDefinition?: unknown;
  taskStates: Record<string, ExecutionDiagramTaskState>;
  selectedTaskReferenceName?: string | null;
  onSelectTask?: (taskReferenceName: string | null) => void;
}
