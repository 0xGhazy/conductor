import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import { initialNodes, START_NODE_ID, END_NODE_ID } from "@/features/designer/constants/workflowNodes";
import { createUuid } from "@/utils/uuid";
import { buildNodeDataForKind } from "@/features/designer/utils/nodeDefinitions";
import {
  isStartNodeId,
  isEndNode,
  isEndNodeId,
  isTerminateNodeType,
  buildEdgeId,
  dedupeEdges,
  BASE_EDGE_MARKER,
  BASE_EDGE_STYLE,
  getSwitchCaseLabel,
  getSwitchCaseColor,
  DEFAULT_START_TIMEOUT_SECONDS,
  parsePendingConnection,
  type PendingConnectionInfo,
} from "@/features/designer/utils/designerGraphUtils";
import {
  isScopeNode,
  getScopeDescendantIds,
  toggleScopeCollapsed,
  createScopeFromSelection,
  deriveVisibleScopeGraph,
} from "@/features/designer/services/scopeGraph";
import {
  calculateAutoLayout,
  getStoredLayoutDirection,
  setStoredLayoutDirection,
} from "@/features/designer/utils/autoLayout";

export type WorkflowSaveStatus =
  | "SAVED"
  | "UNSAVED"
  | "SAVING"
  | "FAILED"
  | "DRAFT"
  | "MODIFIED";

export interface WorkflowSnapshot {
  nodes: Node[];
  edges: Edge[];
  workflowName: string;
  workflowVersion: string;
  workflowVariables: Record<string, any>;
  workflowDescription: string;
  workflowCorrelationId: string;
  workflowLanguage: string;
  workflowSupportedLanguages: string[];
}

export interface StartMetaDraft {
  name: string;
  version: string;
  description: string;
  timeoutSeconds: string;
  timeoutPolicy: string;
  language: string;
  supportedLanguages: string[];
}


export interface RunResultState {
  runResultText: string;
  runExecutionTimeMs: number | null;
  runRequestId: string;
  runSuccessStatus: boolean | null;
  runWorkflowId: string;
  runWorkflowStatus: string;
  runWorkflowVersion: string;
  runStartTime: string;
  runEndTime: string;
  runDurationText: string;
  runReasonForIncompletion: string;
  runInputJsonText: string;
  runVariablesJsonText: string;
  runOutputJsonText: string;
  runWorkflowJsonText: string;
}

export interface WorkflowHydrationPatch {
  nodes: Node[];
  edges: Edge[];
  workflowName: string;
  workflowVersion: string;
  workflowVariables: Record<string, any>;
  workflowDescription: string;
  workflowCorrelationId: string;
  workflowLanguage: string;
  workflowSupportedLanguages: string[];
  startMetaDraft: StartMetaDraft;
  startInputsJsonText: string;
  startVariablesJsonText: string;
  workflowStatus: WorkflowSaveStatus;
  lastSavedSignature: string | null;
}

export interface DesignerState {
  // Canvas Graph
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Selection & Scope
  selectedId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  focusedScopeId: string | null;
  /** Node currently being deleted via a press-and-hold of the Delete key. */
  holdDeleteNodeId: string | null;
  setHoldDeleteNodeId: (id: string | null) => void;
  setSelectedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setSelectedNodeIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setSelectedEdgeId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setFocusedScopeId: (id: string | null | ((prev: string | null) => string | null)) => void;
  clearSelection: () => void;

  // Workflow Metadata
  workflowName: string;
  workflowVersion: string;
  workflowVersions: number[];
  workflowVersionsLoading: boolean;
  workflowVariables: Record<string, any>;
  workflowDescription: string;
  workflowCorrelationId: string;
  workflowLanguage: string;
  workflowSupportedLanguages: string[];
  workflowStatus: WorkflowSaveStatus;
  lastSavedSignature: string | null;
  setWorkflowName: (name: string) => void;
  setWorkflowVersion: (version: string) => void;
  setWorkflowVersions: (versions: number[] | ((prev: number[]) => number[])) => void;
  setWorkflowVersionsLoading: (loading: boolean) => void;
  setWorkflowVariables: (vars: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  setWorkflowDescription: (desc: string) => void;
  setWorkflowCorrelationId: (corrId: string) => void;
  setWorkflowLanguage: (lang: string) => void;
  setWorkflowSupportedLanguages: (langs: string[]) => void;
  setWorkflowStatus: (status: WorkflowSaveStatus) => void;
  setLastSavedSignature: (sig: string | null) => void;

  // History (Undo / Redo)
  past: WorkflowSnapshot[];
  future: WorkflowSnapshot[];
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Validation UI state
  validationPanelOpen: boolean;
  setValidationPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleValidationPanel: () => void;
  highlightedField: string | null;
  setHighlightedField: (field: string | null) => void;


  // UI state
  layoutDirection: "TB" | "LR";
  setLayoutDirection: (direction: "TB" | "LR") => void;
  themeMode: "light" | "dark";
  setThemeMode: (mode: "light" | "dark") => void;
  toggleTheme: () => void;
  actionsPanelOpen: boolean;
  setActionsPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleActionsPanel: () => void;
  flowInstance: any;
  setFlowInstance: (instance: any) => void;
  nodePanelCollapsed: boolean;
  setNodePanelCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;

  // Modals & Dialogs (Workflow Configurations)
  workflowConfigModalOpen: boolean;
  setWorkflowConfigModalOpen: (open: boolean) => void;
  workflowConfigModalTab: "configurations" | "json";
  setWorkflowConfigModalTab: (tab: "configurations" | "json") => void;

  // Backward-compatible Start Modal aliases
  startModalOpen: boolean;
  setStartModalOpen: (open: boolean) => void;
  startModalTab: "configurations" | "json";
  setStartModalTab: (tab: "configurations" | "json") => void;
  startMetaDraft: StartMetaDraft;
  setStartMetaDraft: (draft: StartMetaDraft | ((prev: StartMetaDraft) => StartMetaDraft)) => void;
  startInputsJsonText: string;
  setStartInputsJsonText: (text: string) => void;
  startInputsError: string;
  setStartInputsError: (err: string) => void;
  startVariablesJsonText: string;
  setStartVariablesJsonText: (text: string) => void;
  startVariablesError: string;
  setStartVariablesError: (err: string) => void;
  startNameError: string;
  setStartNameError: (err: string) => void;
  startTimeoutError: string;
  setStartTimeoutError: (err: string) => void;

  runResultOpen: boolean;
  setRunResultOpen: (open: boolean) => void;
  runResultTab: "summary" | "io" | "workflowJson";
  setRunResultTab: (tab: "summary" | "io" | "workflowJson") => void;
  runResultData: RunResultState;
  setRunResultData: (data: Partial<RunResultState>) => void;

  nodeToolboxOpen: boolean;
  setNodeToolboxOpen: (open: boolean) => void;
  nodeToolboxQuery: string;
  setNodeToolboxQuery: (query: string) => void;
  nodeToolboxSelectionIndex: number;
  setNodeToolboxSelectionIndex: (index: number | ((prev: number) => number)) => void;

  replaceConfirmOpen: boolean;
  setReplaceConfirmOpen: (open: boolean) => void;
  replaceConfirmContext: "open" | "import";
  setReplaceConfirmContext: (ctx: "open" | "import") => void;
  pendingReplaceAction: (() => void) | null;
  setPendingReplaceAction: (action: (() => void) | null) => void;
  workflowDiffModalOpen: boolean;
  setWorkflowDiffModalOpen: (open: boolean) => void;

  pendingConnectionSource: PendingConnectionInfo | string | null;
  setPendingConnectionSource: (source: PendingConnectionInfo | string | null) => void;

  // Graph Operations
  addNode: (kind: string, position?: { x: number; y: number }) => string | null;
  deleteSelectedEdge: () => void;
  deleteSelectedNode: (onError?: (msg: string) => void) => boolean;
  toggleScope: (scopeId: string) => void;
  focusScope: (scopeId: string | null) => void;
  exitScopeFocus: () => void;
  groupSelectedIntoScope: (onSuccess?: (scopeId: string) => void, onError?: (msg: string) => void) => boolean;
  updateNodeConfig: (nodeId: string, patch: Record<string, any>) => void;
  /** Applies a freshly loaded/imported workflow in a single store update (and clears undo history). */
  hydrateWorkflow: (patch: WorkflowHydrationPatch) => void;
  resetWorkflowState: () => void;
  /** Resets the whole designer session (graph, history, dialogs, React Flow instance) on page leave. */
  resetDesignerSession: () => void;
  rearrangeGraph: (customDirection?: "TB" | "LR") => void;
}

const initialRunResultData: RunResultState = {
  runResultText: "",
  runExecutionTimeMs: null,
  runRequestId: "",
  runSuccessStatus: null,
  runWorkflowId: "",
  runWorkflowStatus: "",
  runWorkflowVersion: "",
  runStartTime: "",
  runEndTime: "",
  runDurationText: "",
  runReasonForIncompletion: "",
  runInputJsonText: "{}",
  runVariablesJsonText: "{}",
  runOutputJsonText: "{}",
  runWorkflowJsonText: "{}",
};

const initialStartMetaDraft: StartMetaDraft = {
  name: "",
  version: "1",
  description: "",
  timeoutSeconds: String(DEFAULT_START_TIMEOUT_SECONDS),
  timeoutPolicy: "TIME_OUT_WF",
  language: "",
  supportedLanguages: [],
};

export const rearrangeNodes = (
  nodes: Node[],
  edges: Edge[],
  focusedScopeId: string | null,
  direction: "TB" | "LR" = "TB"
): Node[] => {
  const visibleGraph = deriveVisibleScopeGraph(nodes, edges, focusedScopeId);
  if (!visibleGraph.nodes || visibleGraph.nodes.length === 0) {
    return nodes;
  }
  const { nodes: layoutedVisibleNodes } = calculateAutoLayout(
    visibleGraph.nodes,
    visibleGraph.edges,
    { direction }
  );
  const positionMap = new Map(
    layoutedVisibleNodes.map((n) => [n.id, n.position])
  );
  return nodes.map((node) => {
    const newPos = positionMap.get(node.id);
    return newPos
      ? {
          ...node,
          position: newPos,
          sourcePosition: direction === "LR" ? "right" : "bottom",
          targetPosition: direction === "LR" ? "left" : "top",
        }
      : node;
  });
};


const cloneSnapshotData = <T>(val: T): T => {
  if (val === undefined || val === null) return val;
  return JSON.parse(JSON.stringify(val));
};

const captureStoreSnapshot = (state: {
  nodes: Node[];
  edges: Edge[];
  workflowName: string;
  workflowVersion: string;
  workflowVariables: Record<string, any>;
  workflowDescription: string;
  workflowCorrelationId: string;
  workflowLanguage: string;
  workflowSupportedLanguages: string[];
}): WorkflowSnapshot => ({
  nodes: cloneSnapshotData(state.nodes),
  edges: cloneSnapshotData(state.edges),
  workflowName: state.workflowName,
  workflowVersion: state.workflowVersion,
  workflowVariables: cloneSnapshotData(state.workflowVariables || {}),
  workflowDescription: state.workflowDescription,
  workflowCorrelationId: state.workflowCorrelationId,
  workflowLanguage: state.workflowLanguage,
  workflowSupportedLanguages: [...(state.workflowSupportedLanguages || [])],
});

let lastConfigSnapshotTimestamp = 0;
let lastConfigSnapshotNodeId: string | null = null;

export const useDesignerStore = create<DesignerState>((set, get) => ({
  // Canvas Graph
  nodes: initialNodes,
  edges: [],
  setNodes: (nodesOrFn) =>
    set((state) => ({
      nodes: typeof nodesOrFn === "function" ? nodesOrFn(state.nodes) : nodesOrFn,
    })),
  setEdges: (edgesOrFn) =>
    set((state) => ({
      edges: typeof edgesOrFn === "function" ? edgesOrFn(state.edges) : edgesOrFn,
    })),
  onNodesChange: (changes) => {
    const nextNodes = applyNodeChanges(changes, get().nodes);
    const hasRemoval = changes.some((c) => c.type === "remove");
    if (hasRemoval && nextNodes.length > 0) {
      set({ nodes: nextNodes, workflowStatus: "MODIFIED" });
      // Defer the (dagre) re-layout out of React Flow's change handler so removal stays responsive.
      window.requestAnimationFrame(() => {
        const { nodes, edges, focusedScopeId, flowInstance, layoutDirection } = get();
        if (nodes.length === 0) return;
        set({ nodes: rearrangeNodes(nodes, edges, focusedScopeId, layoutDirection) });
        window.requestAnimationFrame(() => {
          flowInstance?.fitView?.({ duration: 450, padding: 0.1, minZoom: 0.2, maxZoom: 1.2 });
        });
      });
      return;
    }
    set({ nodes: nextNodes });
  },
  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
  onConnect: (connection) => {
    const { nodes } = get();
    // Prevent self-loops
    if (connection.source === connection.target) return;
    if (isStartNodeId(connection.target)) return;
    if (connection.source === "end") return;

    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (isScopeNode(sourceNode) || isScopeNode(targetNode)) return;
    if (sourceNode && isTerminateNodeType(sourceNode.type)) return;
    if (isEndNodeId(connection.source) || isEndNodeId(connection.target)) return;

    if (isStartNodeId(connection.source)) {
      get().takeSnapshot();
      set((state) => {
        const hasStartEdge = state.edges.some((edge) => isStartNodeId(edge.source));
        const nextEdge: any = {
          ...connection,
          source: START_NODE_ID,
          id: buildEdgeId(),
        };
        if (hasStartEdge) {
          return {
            edges: dedupeEdges(
              state.edges
                .filter((edge) => !isStartNodeId(edge.source))
                .concat(addEdge(nextEdge, []))
            ),
            workflowStatus: "UNSAVED",
          };
        }
        return { edges: dedupeEdges(addEdge(nextEdge, state.edges)), workflowStatus: "UNSAVED" };
      });
      return;
    }

    const edgeData: any = {
      ...connection,
      id: buildEdgeId(),
      type: "step",
      animated: false,
      markerEnd: BASE_EDGE_MARKER,
      style: BASE_EDGE_STYLE,
      data: {},
    };

    if (connection.sourceHandle === "true") {
      edgeData.style = { ...BASE_EDGE_STYLE, stroke: "#22c55e" };
      edgeData.markerEnd = { ...BASE_EDGE_MARKER, color: "#22c55e" };
    } else if (connection.sourceHandle === "false") {
      edgeData.style = { ...BASE_EDGE_STYLE, stroke: "#ef4444" };
      edgeData.markerEnd = { ...BASE_EDGE_MARKER, color: "#ef4444" };
    } else if (connection.sourceHandle === "success") {
      edgeData.style = { ...BASE_EDGE_STYLE, stroke: "#22c55e" };
      edgeData.markerEnd = { ...BASE_EDGE_MARKER, color: "#22c55e" };
    } else if (connection.sourceHandle === "error") {
      edgeData.style = { ...BASE_EDGE_STYLE, stroke: "#ef4444" };
      edgeData.markerEnd = { ...BASE_EDGE_MARKER, color: "#ef4444" };
    }

    if (sourceNode?.type === "SWITCH_ACTION") {
      const caseLabel = getSwitchCaseLabel(sourceNode, connection.sourceHandle);
      const caseColor = getSwitchCaseColor(sourceNode, connection.sourceHandle);
      if (caseLabel || caseColor) {
        edgeData.label = caseLabel;
        edgeData.labelBgPadding = [6, 2];
        edgeData.labelBgBorderRadius = 4;
        edgeData.labelStyle = {
          color: caseColor || "#111827",
          fontSize: 11,
          fontWeight: 800,
        };
        if (caseColor) {
          edgeData.style = { ...BASE_EDGE_STYLE, stroke: caseColor };
          edgeData.markerEnd = { ...BASE_EDGE_MARKER, color: caseColor };
        }
      }
    }

    get().takeSnapshot();
    set((state) => ({ edges: dedupeEdges(addEdge(edgeData, state.edges)), workflowStatus: "UNSAVED" }));
  },

  // Selection & Scope
  selectedId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  focusedScopeId: null,
  holdDeleteNodeId: null,
  setHoldDeleteNodeId: (id) => set({ holdDeleteNodeId: id }),
  setSelectedId: (idOrFn) =>
    set((state) => ({
      selectedId: typeof idOrFn === "function" ? idOrFn(state.selectedId) : idOrFn,
    })),
  setSelectedNodeIds: (idsOrFn) =>
    set((state) => ({
      selectedNodeIds: typeof idsOrFn === "function" ? idsOrFn(state.selectedNodeIds) : idsOrFn,
    })),
  setSelectedEdgeId: (idOrFn) =>
    set((state) => ({
      selectedEdgeId: typeof idOrFn === "function" ? idOrFn(state.selectedEdgeId) : idOrFn,
    })),
  setFocusedScopeId: (idOrFn) =>
    set((state) => ({
      focusedScopeId: typeof idOrFn === "function" ? idOrFn(state.focusedScopeId) : idOrFn,
    })),
  clearSelection: () =>
    set({
      selectedId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
    }),

  // Workflow Metadata
  workflowName: "",
  workflowVersion: "1",
  workflowVersions: [],
  workflowVersionsLoading: false,
  workflowVariables: {},
  workflowDescription: "",
  workflowCorrelationId: "",
  workflowLanguage: "",
  workflowSupportedLanguages: [],
  workflowStatus: "DRAFT",
  lastSavedSignature: null,
  setWorkflowName: (name) => set({ workflowName: name }),
  setWorkflowVersion: (version) => set({ workflowVersion: version }),
  setWorkflowVersions: (versionsOrFn) =>
    set((state) => ({
      workflowVersions: typeof versionsOrFn === "function" ? versionsOrFn(state.workflowVersions) : versionsOrFn,
    })),
  setWorkflowVersionsLoading: (loading) => set({ workflowVersionsLoading: loading }),
  setWorkflowVariables: (varsOrFn) =>
    set((state) => ({
      workflowVariables: typeof varsOrFn === "function" ? varsOrFn(state.workflowVariables) : varsOrFn,
    })),
  setWorkflowDescription: (desc) => set({ workflowDescription: desc }),
  setWorkflowCorrelationId: (corrId) => set({ workflowCorrelationId: corrId }),
  setWorkflowLanguage: (lang) => set({ workflowLanguage: lang }),
  setWorkflowSupportedLanguages: (langs) => set({ workflowSupportedLanguages: langs }),
  setWorkflowStatus: (status) => set({ workflowStatus: status }),
  setLastSavedSignature: (sig) => set({ lastSavedSignature: sig }),

  // History (Undo / Redo)
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  takeSnapshot: () => {
    const current = captureStoreSnapshot(get());
    set((state) => ({
      past: [...state.past.slice(-49), current],
      future: [],
      canUndo: true,
      canRedo: false,
    }));
  },
  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;
    const current = captureStoreSnapshot(get());
    const previous = past[past.length - 1];
    const nextPast = past.slice(0, past.length - 1);
    const nextFuture = [current, ...future.slice(0, 49)];
    set({
      past: nextPast,
      future: nextFuture,
      canUndo: nextPast.length > 0,
      canRedo: true,
      nodes: previous.nodes,
      edges: previous.edges,
      workflowName: previous.workflowName,
      workflowVersion: previous.workflowVersion,
      workflowVariables: previous.workflowVariables,
      workflowDescription: previous.workflowDescription,
      workflowCorrelationId: previous.workflowCorrelationId,
      workflowLanguage: previous.workflowLanguage,
      workflowSupportedLanguages: previous.workflowSupportedLanguages,
      selectedId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
    });
  },
  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const current = captureStoreSnapshot(get());
    const next = future[0];
    const nextFuture = future.slice(1);
    const nextPast = [...past.slice(-49), current];
    set({
      past: nextPast,
      future: nextFuture,
      canUndo: true,
      canRedo: nextFuture.length > 0,
      nodes: next.nodes,
      edges: next.edges,
      workflowName: next.workflowName,
      workflowVersion: next.workflowVersion,
      workflowVariables: next.workflowVariables,
      workflowDescription: next.workflowDescription,
      workflowCorrelationId: next.workflowCorrelationId,
      workflowLanguage: next.workflowLanguage,
      workflowSupportedLanguages: next.workflowSupportedLanguages,
      selectedId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
    });
  },
  clearHistory: () => set({ past: [], future: [], canUndo: false, canRedo: false }),

  // Validation UI state
  validationPanelOpen: false,
  setValidationPanelOpen: (openOrFn) =>
    set((state) => ({
      validationPanelOpen:
        typeof openOrFn === "function" ? openOrFn(state.validationPanelOpen) : openOrFn,
    })),
  toggleValidationPanel: () =>
    set((state) => ({ validationPanelOpen: !state.validationPanelOpen })),
  highlightedField: null,
  setHighlightedField: (field) => {
    set({ highlightedField: field });
    if (field) {
      setTimeout(() => {
        if (get().highlightedField === field) {
          set({ highlightedField: null });
        }
      }, 3000);
    }
  },


  // UI state
  layoutDirection: getStoredLayoutDirection(),
  setLayoutDirection: (dir) => {
    setStoredLayoutDirection(dir);
    set({ layoutDirection: dir });
    get().rearrangeGraph(dir);
  },
  themeMode: "light",
  setThemeMode: (mode) => set({ themeMode: mode }),
  toggleTheme: () => {
    const nextMode = get().themeMode === "dark" ? "light" : "dark";
    set({ themeMode: nextMode });
    document.documentElement.dataset.theme = nextMode;
    localStorage.setItem("theme", nextMode);
    window.dispatchEvent(new Event("theme-sync"));
  },
  actionsPanelOpen: false,
  setActionsPanelOpen: (openOrFn) =>
    set((state) => ({
      actionsPanelOpen: typeof openOrFn === "function" ? openOrFn(state.actionsPanelOpen) : openOrFn,
    })),
  toggleActionsPanel: () => set((state) => ({ actionsPanelOpen: !state.actionsPanelOpen })),
  flowInstance: null,
  setFlowInstance: (instance) => set({ flowInstance: instance }),
  nodePanelCollapsed: false,
  setNodePanelCollapsed: (collapsedOrFn) =>
    set((state) => ({
      nodePanelCollapsed:
        typeof collapsedOrFn === "function" ? collapsedOrFn(state.nodePanelCollapsed) : collapsedOrFn,
    })),

  // Modals & Dialogs
  workflowConfigModalOpen: false,
  setWorkflowConfigModalOpen: (open) => set({ workflowConfigModalOpen: open, startModalOpen: open }),
  workflowConfigModalTab: "configurations",
  setWorkflowConfigModalTab: (tab) => set({ workflowConfigModalTab: tab, startModalTab: tab }),

  // Backward-compatible Start Modal aliases
  startModalOpen: false,
  setStartModalOpen: (open) => set({ workflowConfigModalOpen: open, startModalOpen: open }),
  startModalTab: "configurations",
  setStartModalTab: (tab) => set({ workflowConfigModalTab: tab, startModalTab: tab }),
  startMetaDraft: initialStartMetaDraft,
  setStartMetaDraft: (draftOrFn) =>
    set((state) => ({
      startMetaDraft: typeof draftOrFn === "function" ? draftOrFn(state.startMetaDraft) : draftOrFn,
    })),
  startInputsJsonText: "{}",
  setStartInputsJsonText: (text) => set({ startInputsJsonText: text }),
  startInputsError: "",
  setStartInputsError: (err) => set({ startInputsError: err }),
  startVariablesJsonText: "{}",
  setStartVariablesJsonText: (text) => set({ startVariablesJsonText: text }),
  startVariablesError: "",
  setStartVariablesError: (err) => set({ startVariablesError: err }),
  startNameError: "",
  setStartNameError: (err) => set({ startNameError: err }),
  startTimeoutError: "",
  setStartTimeoutError: (err) => set({ startTimeoutError: err }),

  runResultOpen: false,
  setRunResultOpen: (open) => set({ runResultOpen: open }),
  runResultTab: "summary",
  setRunResultTab: (tab) => set({ runResultTab: tab }),
  runResultData: initialRunResultData,
  setRunResultData: (partial) =>
    set((state) => ({
      runResultData: { ...state.runResultData, ...partial },
    })),

  nodeToolboxOpen: false,
  setNodeToolboxOpen: (open) => set({ nodeToolboxOpen: open }),
  nodeToolboxQuery: "",
  setNodeToolboxQuery: (query) => set({ nodeToolboxQuery: query }),
  nodeToolboxSelectionIndex: 0,
  setNodeToolboxSelectionIndex: (indexOrFn) =>
    set((state) => ({
      nodeToolboxSelectionIndex:
        typeof indexOrFn === "function"
          ? indexOrFn(state.nodeToolboxSelectionIndex)
          : indexOrFn,
    })),

  replaceConfirmOpen: false,
  setReplaceConfirmOpen: (open) => set({ replaceConfirmOpen: open }),
  replaceConfirmContext: "import",
  setReplaceConfirmContext: (ctx) => set({ replaceConfirmContext: ctx }),
  pendingReplaceAction: null,
  setPendingReplaceAction: (action) => set({ pendingReplaceAction: action }),
  workflowDiffModalOpen: false,
  setWorkflowDiffModalOpen: (open) => set({ workflowDiffModalOpen: open }),

  pendingConnectionSource: null,
  setPendingConnectionSource: (source) => set({ pendingConnectionSource: source }),

  // Graph Operations
  addNode: (kind, position = { x: 200, y: 200 }) => {
    const {
      workflowName,
      workflowVersion,
      pendingConnectionSource,
      nodes,
      edges,
      focusedScopeId,
      flowInstance,
    } = get();

    const built = buildNodeDataForKind(kind, { workflowName, workflowVersion });
    if (!built) return null;

    const id = createUuid();
    const newNode: Node = {
      id,
      type: built.type,
      position,
      data: built.data,
      selectable: true,
    };

    let nextEdges = edges;

    if (pendingConnectionSource) {
      const parsed = parsePendingConnection(pendingConnectionSource);
      const isFromStart = parsed ? isStartNodeId(parsed.nodeId) : false;
      const sourceId = isFromStart ? START_NODE_ID : (parsed?.nodeId || "");
      const sourceHandle = isFromStart
        ? "workflow-entry-point"
        : (parsed?.handleId || undefined);

      // Check if there was an existing edge from source
      const existingOutgoingEdge = edges.find((e) => {
        const matchesSource = isStartNodeId(sourceId)
          ? isStartNodeId(e.source)
          : e.source === sourceId;
        if (!matchesSource) return false;
        if (sourceHandle) {
          return e.sourceHandle === sourceHandle;
        }
        return true;
      });

      const newEdge: Edge = {
        id: buildEdgeId(),
        source: sourceId,
        sourceHandle: sourceHandle || undefined,
        target: id,
        type: "step",
        animated: false,
        markerEnd: BASE_EDGE_MARKER,
        style: BASE_EDGE_STYLE,
        data: {},
      };

      if (existingOutgoingEdge) {
        if (built.type !== "TERMINATE") {
          // Splice/insert new node between source and existing target
          const downstreamEdge: Edge = {
            id: buildEdgeId(),
            source: id,
            target: existingOutgoingEdge.target,
            type: "step",
            animated: false,
            markerEnd: BASE_EDGE_MARKER,
            style: BASE_EDGE_STYLE,
            data: {},
          };
          nextEdges = dedupeEdges(
            edges
              .filter((e) => e.id !== existingOutgoingEdge.id)
              .concat(newEdge, downstreamEdge)
          );
        } else {
          // Terminate node replaces the existing branch from source
          nextEdges = dedupeEdges(
            edges
              .filter((e) => e.id !== existingOutgoingEdge.id)
              .concat(newEdge)
          );
        }
      } else {
        nextEdges = dedupeEdges(edges.concat(newEdge));
      }
    }

    const nextNodes = nodes.concat(newNode);

    // Auto-layout top-to-bottom on EVERY node addition
    const layoutedNodes = rearrangeNodes(nextNodes, nextEdges, focusedScopeId);

    get().takeSnapshot();
    set({
      nodes: layoutedNodes,
      edges: nextEdges,
      selectedId: id,
      selectedNodeIds: [id],
      selectedEdgeId: null,
      pendingConnectionSource: null,
      workflowStatus: "UNSAVED",
    });

    window.requestAnimationFrame(() => {
      flowInstance?.fitView?.({ duration: 450, padding: 0.2 });
    });

    return id;
  },

  deleteSelectedEdge: () => {
    const { selectedEdgeId } = get();
    if (!selectedEdgeId) return;
    get().takeSnapshot();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== selectedEdgeId),
      selectedEdgeId: null,
      workflowStatus: "UNSAVED",
    }));
  },

  deleteSelectedNode: (onError) => {
    const { nodes, edges, selectedId, focusedScopeId, flowInstance } = get();
    const selectedNode = nodes.find((n) => n.id === selectedId);
    if (!selectedNode) return false;
    const id = selectedNode.id;
    if (isStartNodeId(id) || id === "end" || isEndNode(selectedNode)) return false;

    const deletedNodeIds = isScopeNode(selectedNode)
      ? new Set([id, ...getScopeDescendantIds(nodes, id)])
      : new Set([id]);

    const outgoingEdges = edges.filter(
      (e) => deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
    );

    const wouldOrphanNodes = outgoingEdges
      .map((edge) => {
        const remainingEdges = edges.filter(
          (e) =>
            e.id !== edge.id &&
            e.target === edge.target &&
            !deletedNodeIds.has(e.source) &&
            !deletedNodeIds.has(e.target)
        );
        const wouldBeOrphaned =
          !isStartNodeId(edge.target) &&
          !remainingEdges.some((re) => re.target === edge.target);
        return {
          edge,
          targetNode: nodes.find((n) => n.id === edge.target),
          wouldBeOrphaned,
        };
      })
      .filter((r) => r.wouldBeOrphaned);

    if (wouldOrphanNodes.length > 0) {
      const orphanedNodeNames = wouldOrphanNodes
        .map((r) => r.targetNode?.data?.name || r.targetNode?.id || "node")
        .join(", ");
      onError?.(
        `Cannot delete "${selectedNode.data?.name || id}". This would leave the following node(s) without a parent connection:\n\n${orphanedNodeNames}\n\nPlease reconnect or delete those nodes first.`
      );
      return false;
    }

    const nextNodes = nodes
      .filter((n) => !deletedNodeIds.has(n.id))
      .map((node) => {
        if (!isScopeNode(node)) return node;
        return {
          ...node,
          data: {
            ...node.data,
            config: {
              ...(node.data?.config || {}),
              scope: {
                ...(node.data?.config?.scope || node.data.scope),
                childrenIds: (node.data?.scope?.childrenIds || []).filter(
                  (childId: string) => !deletedNodeIds.has(childId)
                ),
              },
            },
            scope: {
              ...node.data.scope,
              childrenIds: (node.data?.scope?.childrenIds || []).filter(
                (childId: string) => !deletedNodeIds.has(childId)
              ),
            },
          },
        };
      });

    const nextEdges = edges.filter(
      (e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
    );

    // Auto-layout top-to-bottom on EVERY node deletion
    const layoutedNodes = rearrangeNodes(nextNodes, nextEdges, focusedScopeId);

    get().takeSnapshot();
    set({
      nodes: layoutedNodes,
      edges: nextEdges,
      selectedId: null,
      selectedNodeIds: [],
      focusedScopeId: focusedScopeId && deletedNodeIds.has(focusedScopeId) ? null : focusedScopeId,
      workflowStatus: "UNSAVED",
    });

    window.requestAnimationFrame(() => {
      flowInstance?.fitView?.({ duration: 450, padding: 0.2 });
    });

    return true;
  },

  toggleScope: (scopeId: string) => {
    set((state) => ({
      nodes: toggleScopeCollapsed(state.nodes, scopeId),
    }));
  },

  focusScope: (scopeId: string | null) => {
    set({
      focusedScopeId: scopeId,
      selectedId: scopeId,
      selectedNodeIds: scopeId ? [scopeId] : [],
      selectedEdgeId: null,
    });
  },

  exitScopeFocus: () => {
    const { focusedScopeId, nodes } = get();
    if (!focusedScopeId) return;
    const currentScope = nodes.find((n) => n.id === focusedScopeId);
    const parentScopeId = currentScope?.parentId || null;
    set({
      focusedScopeId: parentScopeId,
      selectedId: parentScopeId,
      selectedNodeIds: parentScopeId ? [parentScopeId] : [],
      selectedEdgeId: null,
    });
  },

  groupSelectedIntoScope: (onSuccess, onError) => {
    const { nodes, edges, selectedNodeIds, flowInstance } = get();
    const result = createScopeFromSelection({
      nodes,
      edges,
      selectedNodeIds,
      createId: createUuid,
    });

    if (!result.ok || !result.scopeId) {
      onError?.(result.error || "Unable to create scope from selection.");
      return false;
    }

    get().takeSnapshot();
    set({
      nodes: result.nodes,
      edges: result.edges,
      focusedScopeId: null,
      selectedId: result.scopeId,
      selectedNodeIds: [result.scopeId],
      selectedEdgeId: null,
      workflowStatus: "UNSAVED",
    });

    if (flowInstance && typeof flowInstance.fitView === "function") {
      window.requestAnimationFrame(() => {
        flowInstance.fitView({
          nodes: [{ id: result.scopeId }],
          padding: 0.28,
          duration: 260,
        });
      });
    }

    onSuccess?.(result.scopeId);
    return true;
  },

  updateNodeConfig: (nodeId, patch) => {
    const now = Date.now();
    if (nodeId !== lastConfigSnapshotNodeId || now - lastConfigSnapshotTimestamp > 600) {
      get().takeSnapshot();
      lastConfigSnapshotNodeId = nodeId;
      lastConfigSnapshotTimestamp = now;
    }
    set((state) => ({
      workflowStatus: "UNSAVED",
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const currentConfig = node.data?.config || {};
        const nextConfig = { ...currentConfig, ...patch };
        const nextDisplayName =
          patch.name !== undefined ? patch.name : node.data?.name;
        return {
          ...node,
          data: {
            ...node.data,
            name: nextDisplayName,
            config: nextConfig,
          },
        };
      }),
    }));
  },

  hydrateWorkflow: (patch) => {
    set({
      ...patch,
      selectedId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },

  resetDesignerSession: () => {
    get().resetWorkflowState();
    set({
      flowInstance: null,
      workflowVersions: [],
      workflowVersionsLoading: false,
      actionsPanelOpen: false,
      nodePanelCollapsed: false,
      workflowConfigModalOpen: false,
      workflowConfigModalTab: "configurations",
      startModalOpen: false,
      startModalTab: "configurations",
      startNameError: "",
      startTimeoutError: "",
      runResultOpen: false,
      runResultTab: "summary",
      runResultData: initialRunResultData,
      nodeToolboxOpen: false,
      nodeToolboxQuery: "",
      nodeToolboxSelectionIndex: 0,
      replaceConfirmOpen: false,
      replaceConfirmContext: "import",
      pendingReplaceAction: null,
      workflowDiffModalOpen: false,
    });
  },

  resetWorkflowState: () => {
    set({
      nodes: initialNodes,
      edges: [],
      selectedId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      holdDeleteNodeId: null,
      focusedScopeId: null,
      workflowName: "",
      workflowVersion: "1",
      workflowVariables: {},
      workflowDescription: "",
      workflowCorrelationId: "",
      workflowLanguage: "",
      workflowSupportedLanguages: [],
      workflowStatus: "DRAFT",
      lastSavedSignature: null,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
      validationPanelOpen: false,
      highlightedField: null,
      pendingConnectionSource: null,
      startMetaDraft: initialStartMetaDraft,
      startInputsJsonText: "{}",
      startInputsError: "",
      startVariablesJsonText: "{}",
      startVariablesError: "",
    });
  },

  rearrangeGraph: (customDirection?: "TB" | "LR") => {
    const { nodes, edges, focusedScopeId, flowInstance, layoutDirection } = get();
    const dir = customDirection || layoutDirection;
    const layoutedNodes = rearrangeNodes(nodes, edges, focusedScopeId, dir);
    get().takeSnapshot();
    set({ nodes: layoutedNodes, workflowStatus: "UNSAVED" });
    window.requestAnimationFrame(() => {
      flowInstance?.fitView?.({ duration: 450, padding: 0.1, minZoom: 0.2, maxZoom: 1.2 });
    });
  },
}));

// Keep React Flow's per-node `selected` flags in step with `selectedNodeIds`, whichever
// action changed it, so the store stays the single source of truth for selection.
// Only reacts to selection changes: React Flow's own select changes reach `nodes` first
// and are mirrored back through `onSelectionChange`, so syncing on `nodes` would undo them.
// This stays at module level on purpose: it is part of the store's invariant (any `setState`
// touching `selectedNodeIds` must be mirrored, including from tests and non-page callers) and an
// idle zustand listener costs nothing until the selection actually changes.
useDesignerStore.subscribe((state, prev) => {
  if (state.selectedNodeIds === prev.selectedNodeIds) return;
  const selected = new Set(state.selectedNodeIds);
  let changed = false;
  const nodes = state.nodes.map((node) => {
    const shouldBeSelected = selected.has(node.id);
    if (Boolean(node.selected) === shouldBeSelected) return node;
    changed = true;
    return { ...node, selected: shouldBeSelected };
  });
  if (changed) {
    useDesignerStore.setState({ nodes });
  }
});
