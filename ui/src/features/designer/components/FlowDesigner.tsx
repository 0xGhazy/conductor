import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Panel, useUpdateNodeInternals, type Node } from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import { WeaverButton } from "@/components/common/buttons";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Backdrop from "@mui/material/Backdrop";
import Typography from "@mui/material/Typography";
import { modalStyle } from "@/utils/modalStyle";
import { WeaverCodeEditor } from "@/components/common/editors";
import { WorkflowTranslationsModal } from "@/features/translations";
import { useWeaverNotification } from "@/components/common/notifications";
import "@xyflow/react/dist/style.css";
import "@/features/designer/styles/Designer.css";

import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import {
  DRAG_TYPE,
  computeStyledEdges,
  isStartNode,
  isStartNodeId,
  isEndNode,
  isEndNodeId,
  getTerminalNodes,
  createGhostEndEdges,
  END_NODE_ID,
  isTerminateNodeType,
} from "@/features/designer/utils/designerGraphUtils";
import {
  deriveVisibleScopeGraph,
  getScopeBreadcrumbs,
  getGroupSelectionState,
  isScopeNode,
} from "@/features/designer/services/scopeGraph";
import {
  calculateAutoLayout,
  type LayoutDirection,
  getStoredLayoutDirection,
  setStoredLayoutDirection,
} from "@/features/designer/utils/autoLayout";
import { WorkflowExportModal } from "@/features/designer/components/export/WorkflowExportModal";
import { DESIGNER_EDGE_TYPES, DESIGNER_NODE_TYPES } from "@/features/designer/components/flowNodeTypes";
import { useScopedSuggestions } from "@/features/designer/hooks/useScopedSuggestions";
import { useKeepMountedWhileOpen } from "@/features/designer/hooks/useKeepMountedWhileOpen";

/** Delay before re-running the measured-size auto layout after node measurements settle. */
const MEASURED_LAYOUT_DEBOUNCE_MS = 120;

const FIT_VIEW_OPTIONS = { padding: 0.1, minZoom: 0.2, maxZoom: 1.2 };

/** Refreshes handle positions of every visible node when the layout direction flips. */
const FlowInternalUpdater: React.FC<{
  layoutDirection: string;
  nodeIdsRef: React.MutableRefObject<string[]>;
}> = ({ layoutDirection, nodeIdsRef }) => {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    nodeIdsRef.current.forEach((id) => updateNodeInternals(id));
  }, [layoutDirection, nodeIdsRef, updateNodeInternals]);
  return null;
};

export interface FlowDesignerProps {
  onRun?: () => void;
  onSaveCurrentVersion?: () => void;
  onSaveNewVersion?: () => void;
  onExport?: (newStructure?: boolean) => void;
}

// Store actions never change identity, so they can be read once.
const designerActions = () => useDesignerStore.getState();

const FlowDesignerBase: React.FC<FlowDesignerProps> = ({
  onRun,
  onSaveCurrentVersion,
  onSaveNewVersion,
}) => {
  const {
    nodes,
    edges,
    selectedNodeIds,
    focusedScopeId,
    workflowName,
    workflowVersion,
    themeMode,
    layoutDirection,
  } = useDesignerStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      selectedNodeIds: state.selectedNodeIds,
      focusedScopeId: state.focusedScopeId,
      workflowName: state.workflowName,
      workflowVersion: state.workflowVersion,
      themeMode: state.themeMode,
      layoutDirection: state.layoutDirection,
    }))
  );
  const {
    toggleTheme,
    setFlowInstance,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    clearSelection,
    focusScope,
    exitScopeFocus,
    groupSelectedIntoScope,
    addNode,
    setNodePanelCollapsed,
    setNodes,
    setLayoutDirection,
  } = designerActions();

  const openWorkflowConfigurationsPanel = useCallback(() => {
    clearSelection();
    if (typeof setNodePanelCollapsed === "function") {
      setNodePanelCollapsed(false);
    }
  }, [clearSelection, setNodePanelCollapsed]);

  const flowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [contextMapModalOpen, setContextMapModalOpen] = useState(false);
  const [translationsModalOpen, setTranslationsModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportInitialFormat, setExportInitialFormat] = useState<
    "svg" | "pdf" | "png" | "jpg" | "json" | undefined
  >(undefined);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandSelectionIndex, setCommandSelectionIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const translationsModalMounted = useKeepMountedWhileOpen(translationsModalOpen);

  // Derived scope state
  const visibleScopeGraph = useMemo(() => {
    const base = deriveVisibleScopeGraph(nodes, edges, focusedScopeId);
    if (focusedScopeId !== null) return base;

    // Ensure End node exists in visible nodes if present in nodes (or add fallback)
    const hasEndNode = base.nodes.some((n) => isEndNode(n));
    let visibleNodes = base.nodes;
    if (!hasEndNode) {
      const endNodeInStore = nodes.find((n) => isEndNode(n));
      if (endNodeInStore) {
        visibleNodes = [...visibleNodes, endNodeInStore];
      } else {
        const startNode = visibleNodes.find((n) => isStartNode(n));
        const initialEndPos =
          layoutDirection === "LR"
            ? { x: (startNode?.position?.x || 220) + 200, y: startNode?.position?.y || 140 }
            : { x: startNode?.position?.x || 220, y: (startNode?.position?.y || 140) + 200 };
        visibleNodes = [
          ...visibleNodes,
          {
            id: END_NODE_ID,
            type: "endFlag",
            position: initialEndPos,
            data: { name: "End" },
            draggable: false,
            selectable: false,
          },
        ];
      }
    }

    // Compute ghost edges from all terminal nodes to End node
    const terminalNodes = getTerminalNodes(visibleNodes, base.edges);
    const endNode = visibleNodes.find((n) => isEndNode(n));
    const ghostEdges = endNode
      ? createGhostEndEdges(terminalNodes, endNode.id, layoutDirection === "LR")
      : [];

    return {
      ...base,
      nodes: visibleNodes,
      edges: [...base.edges, ...ghostEdges],
    };
  }, [nodes, edges, focusedScopeId, layoutDirection]);

  const styledEdges = useMemo(
    () => computeStyledEdges(visibleScopeGraph.edges, visibleScopeGraph.nodes),
    [visibleScopeGraph]
  );

  const scopeBreadcrumbs = useMemo(
    () => getScopeBreadcrumbs(nodes, focusedScopeId),
    [nodes, focusedScopeId]
  );

  const groupSelectionState = useMemo(
    () => getGroupSelectionState(selectedNodeIds, nodes, edges),
    [selectedNodeIds, nodes, edges]
  );

  const selectedNodeCount = selectedNodeIds.length;
  const canGroupSelected = groupSelectionState.canGroup;
  const groupSelectionMessage = groupSelectionState.message || "";

  // Context map for the viewer modal: only computed while the modal is open.
  const scopedSuggestionsState = useScopedSuggestions(contextMapModalOpen);
  const scopedContextMapJsonText = useMemo(
    () =>
      scopedSuggestionsState
        ? JSON.stringify(scopedSuggestionsState.contextMap ?? {}, null, 2)
        : "{}",
    [scopedSuggestionsState]
  );

  const isValidConnection = useCallback((connection: any) => {
    if (connection.source === connection.target) return false;
    if (isStartNodeId(connection.target)) return false;
    if (connection.source === "end" || isEndNodeId(connection.source)) return false;
    if (connection.target === "end" || isEndNodeId(connection.target)) return false;
    const { nodes: currentNodes, edges: currentEdges } = useDesignerStore.getState();
    if (isStartNodeId(connection.source)) {
      const hasStartEdge = currentEdges.some((edge) => isStartNodeId(edge.source));
      return !hasStartEdge;
    }
    const sourceNode = currentNodes.find((n) => n.id === connection.source);
    const targetNode = currentNodes.find((n) => n.id === connection.target);
    if (isScopeNode(sourceNode) || isScopeNode(targetNode)) {
      return false;
    }
    if (sourceNode && isTerminateNodeType(sourceNode.type)) {
      return false;
    }
    return true;
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DRAG_TYPE);
      if (!kind) return;

      const { flowInstance } = useDesignerStore.getState();
      const pos =
        flowInstance && typeof flowInstance.screenToFlowPosition === "function"
          ? flowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
          : { x: e.clientX, y: e.clientY };
      addNode(kind, pos);
    },
    [addNode]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // Selecting never opens the configuration panel; double-click does.
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: any) => {
      event.stopPropagation();
      if (isEndNode(node)) return;
      if (isStartNode(node)) {
        clearSelection();
        return;
      }
      // Ctrl/Cmd+click toggles multi-selection; React Flow applies it and
      // onSelectionChange mirrors it into the store.
      if (event.ctrlKey || event.metaKey) return;
      setSelectedId(node.id);
      setSelectedNodeIds([node.id]);
      setSelectedEdgeId(null);
    },
    [setSelectedId, setSelectedNodeIds, setSelectedEdgeId, clearSelection]
  );

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: any) => {
      event.stopPropagation();
      if (isEndNode(node)) return;
      if (isStartNode(node)) {
        clearSelection();
        setNodePanelCollapsed?.(false);
        return;
      }
      if (isScopeNode(node)) {
        focusScope(node.id);
        return;
      }
      setNodePanelCollapsed?.(false);
      setSelectedId(node.id);
      setSelectedNodeIds([node.id]);
      setSelectedEdgeId(null);
    },
    [focusScope, setSelectedId, setSelectedNodeIds, setSelectedEdgeId, setNodePanelCollapsed, clearSelection]
  );

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: any) => {
    event.stopPropagation();
    if (!edge?.id) return;
    const targetEdgeId = edge?.data?.originalEdgeId || edge.id;
    const currentNote = String(edge?.data?.note || "");
    const nextNote = window.prompt("Edge note", currentNote);
    if (nextNote === null) return;
    const trimmed = String(nextNote).trim();
    useDesignerStore.getState().setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== targetEdgeId) return e;
        const nextData = { ...(e.data || {}) };
        if (!trimmed) {
          delete nextData.note;
        } else {
          nextData.note = trimmed;
        }
        return { ...e, data: nextData };
      })
    );
  }, []);

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: any) => {
      const selNode = selNodes && selNodes.length ? selNodes[0] : null;
      const selEdge = selEdges && selEdges.length ? selEdges[0] : null;
      setSelectedNodeIds(Array.isArray(selNodes) ? selNodes.map((n: any) => n.id) : []);
      setSelectedId(selNode ? selNode.id : null);
      setSelectedEdgeId(
        selEdge ? selEdge?.data?.originalEdgeId || selEdge.id : null
      );
    },
    [setSelectedNodeIds, setSelectedId, setSelectedEdgeId]
  );

  const { success: showSuccess } = useWeaverNotification();

  const runAutoLayout = useCallback(
    (customDirection?: LayoutDirection) => {
      const state = useDesignerStore.getState();
      const dir = customDirection || getStoredLayoutDirection() || state.layoutDirection || "TB";
      const visibleGraph = deriveVisibleScopeGraph(state.nodes, state.edges, state.focusedScopeId);
      if (!visibleGraph.nodes || visibleGraph.nodes.length === 0) return;

      const { nodes: layoutedVisibleNodes } = calculateAutoLayout(
        visibleGraph.nodes,
        visibleGraph.edges,
        { direction: dir }
      );

      const positionMap = new Map(
        layoutedVisibleNodes.map((n) => [n.id, n.position])
      );

      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const newPos = positionMap.get(node.id);
          return newPos
            ? {
                ...node,
                position: newPos,
                sourcePosition: dir === "LR" ? "right" : "bottom",
                targetPosition: dir === "LR" ? "left" : "top",
              }
            : node;
        }) as Node[]
      );

      window.requestAnimationFrame(() => {
        useDesignerStore
          .getState()
          .flowInstance?.fitView?.({ duration: 450, padding: 0.1, minZoom: 0.2, maxZoom: 1.2 });
      });

      const dirLabel = dir === "LR" ? "Left to Right" : "Top to Bottom";
      showSuccess(`Workflow auto-arranged (${dirLabel})`);
    },
    [setNodes, showSuccess]
  );

  const handleSwitchLayoutDirection = useCallback(() => {
    const current = getStoredLayoutDirection() || useDesignerStore.getState().layoutDirection || "TB";
    const nextDir: LayoutDirection = current === "LR" ? "TB" : "LR";
    setStoredLayoutDirection(nextDir);
    setLayoutDirection(nextDir);
    runAutoLayout(nextDir);
    const dirLabel = nextDir === "LR" ? "Left to Right (Horizontal)" : "Top to Bottom (Vertical)";
    showSuccess(`Workflow direction switched to ${dirLabel} and rearranged`);
  }, [setLayoutDirection, runAutoLayout, showSuccess]);

  const handlePaneContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
          }
        : null
    );
  };

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Latest page callbacks, so the memoized command list does not depend on their identity.
  const pageCallbacksRef = useRef({ onRun, onSaveCurrentVersion, onSaveNewVersion });
  pageCallbacksRef.current = { onRun, onSaveCurrentVersion, onSaveNewVersion };

  const handleContextAction = (action: string) => {
    closeContextMenu();
    if (action === "save-current-version") onSaveCurrentVersion?.();
    if (action === "save-new-version") onSaveNewVersion?.();
    if (action === "run") onRun?.();
    if (action === "workflow-configurations" || action === "start-configuration") {
      openWorkflowConfigurationsPanel();
    }
    if (action === "import" && fileInputRef.current) fileInputRef.current.click();
    if (action === "context-map") setContextMapModalOpen(true);
    if (action === "export-json" || action === "export-new-structure") {
      setExportInitialFormat("json");
      setExportModalOpen(true);
    }
    if (action === "export" || action === "export-diagram") {
      setExportInitialFormat(undefined);
      setExportModalOpen(true);
    }
    if (action === "group") groupSelectedIntoScope();
    if (action === "auto-layout" || action === "auto-layout-tb") {
      runAutoLayout();
    }
  };

  const commandItems = useMemo(() => {
    const openExport = (format?: "svg" | "pdf" | "png" | "jpg" | "json") => () => {
      setExportInitialFormat(format);
      setExportModalOpen(true);
    };
    return [
      {
        id: "save-current-version",
        label: "Save Current Version",
        hint: "Ctrl+S",
        run: () => pageCallbacksRef.current.onSaveCurrentVersion?.(),
      },
      {
        id: "save-new-version",
        label: "Save New Version",
        hint: "Ctrl+Shift+S",
        run: () => pageCallbacksRef.current.onSaveNewVersion?.(),
      },
      {
        id: "run",
        label: "Run Workflow",
        hint: "Ctrl+Enter",
        run: () => pageCallbacksRef.current.onRun?.(),
      },
      {
        id: "auto-layout",
        label: `Auto Arrange Workflow (${layoutDirection === "LR" ? "Left to Right" : "Top to Bottom"})`,
        hint: "Shift+Alt+F",
        run: () => runAutoLayout(),
      },
      {
        id: "switch-layout-direction",
        label:
          layoutDirection === "LR"
            ? "Switch Workflow Direction to Top to Bottom (Vertical)"
            : "Switch Workflow Direction to Left to Right (Horizontal)",
        hint: layoutDirection === "LR" ? "Switch to TB" : "Switch to LR",
        run: () => handleSwitchLayoutDirection(),
      },
      {
        id: "group-scope",
        label: "Group Into Scope",
        hint: selectedNodeCount > 1 ? `${selectedNodeCount} selected` : "",
        run: () => groupSelectedIntoScope(),
        disabled: !canGroupSelected,
      },
      {
        id: "import",
        label: "Import Workflow JSON",
        hint: "",
        run: () => fileInputRef.current?.click(),
      },
      {
        id: "export-workflow",
        label: "Export Workflow (JSON, SVG, PDF, PNG, JPG)",
        hint: "Export",
        run: openExport(undefined),
      },
      { id: "export-json", label: "Export Workflow: JSON", hint: "JSON", run: openExport("json") },
      { id: "export-svg", label: "Export Workflow: SVG", hint: "SVG", run: openExport("svg") },
      { id: "export-pdf", label: "Export Workflow: PDF", hint: "PDF", run: openExport("pdf") },
      { id: "export-png", label: "Export Workflow: PNG", hint: "PNG", run: openExport("png") },
      { id: "export-jpg", label: "Export Workflow: JPG", hint: "JPG", run: openExport("jpg") },
      {
        id: "workflow-configurations",
        label: "Open Workflow Configurations",
        hint: "Panel",
        run: () => openWorkflowConfigurationsPanel(),
      },
      {
        id: "context-map",
        label: "Open Context Map Viewer",
        hint: "Context Map",
        run: () => setContextMapModalOpen(true),
      },
      {
        id: "translations",
        label: "Open Workflow Translations",
        hint: "Translations",
        run: () => setTranslationsModalOpen(true),
      },
      {
        id: "theme",
        label: themeMode === "dark" ? "Switch Theme: Light" : "Switch Theme: Dark",
        hint: "",
        run: toggleTheme,
      },
    ];
  }, [
    layoutDirection,
    selectedNodeCount,
    canGroupSelected,
    themeMode,
    runAutoLayout,
    handleSwitchLayoutDirection,
    groupSelectedIntoScope,
    openWorkflowConfigurationsPanel,
    toggleTheme,
  ]);

  const filteredCommandItems = useMemo(() => {
    const query = String(commandQuery || "").trim().toLowerCase();
    if (!query) return commandItems;
    return commandItems.filter((item) => {
      const label = String(item.label || "").toLowerCase();
      const hint = String(item.hint || "").toLowerCase();
      return label.includes(query) || hint.includes(query);
    });
  }, [commandQuery, commandItems]);

  const executeCommand = useCallback((command: any) => {
    if (!command || typeof command.run !== "function" || command.disabled) return;
    setCommandPaletteOpen(false);
    setCommandQuery("");
    setCommandSelectionIndex(0);
    command.run();
  }, []);

  // Latest palette state for the window keydown listener, which is bound only once.
  const paletteStateRef = useRef({
    commandPaletteOpen,
    filteredCommandItems,
    commandSelectionIndex,
    runAutoLayout,
    executeCommand,
  });
  paletteStateRef.current = {
    commandPaletteOpen,
    filteredCommandItems,
    commandSelectionIndex,
    runAutoLayout,
    executeCommand,
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const latest = paletteStateRef.current;
      const key = String(event.key || "").toLowerCase();
      const isMod = event.ctrlKey || event.metaKey;

      if ((isMod && key === "k") || (isMod && event.shiftKey && key === "p")) {
        event.preventDefault();
        event.stopPropagation();
        setCommandQuery("");
        setCommandSelectionIndex(0);
        setCommandPaletteOpen(true);
        return;
      }

      if (!latest.commandPaletteOpen) {
        // Shift + Alt + F: Auto Arrange Workflow based on current stored direction
        const isShiftAltF =
          !event.ctrlKey &&
          !event.metaKey &&
          event.shiftKey &&
          event.altKey &&
          (key === "f" || event.code === "KeyF");

        if (isShiftAltF) {
          const isMonaco = document.activeElement?.closest?.(".monaco-editor");
          if (!isMonaco) {
            event.preventDefault();
            event.stopPropagation();
            latest.runAutoLayout();
            return;
          }
        }
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        event.stopPropagation();
        setCommandPaletteOpen(false);
        return;
      }

      const items = latest.filteredCommandItems;

      if (key === "arrowdown") {
        event.preventDefault();
        if (items.length === 0) return;
        setCommandSelectionIndex((prev) => (prev + 1) % items.length);
        return;
      }

      if (key === "arrowup") {
        event.preventDefault();
        if (items.length === 0) return;
        setCommandSelectionIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        const selected = items[latest.commandSelectionIndex] || items[0];
        latest.executeCommand(selected);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const timer = setTimeout(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.select();
    }, 40);
    return () => clearTimeout(timer);
  }, [commandPaletteOpen]);

  // Re-run layout with measured node sizes once React Flow has measured them. Debounced and keyed
  // on ids + measured sizes (not positions), so drags and other per-frame node updates only
  // reschedule a timer instead of running dagre.
  const measuredLayoutRanRef = useRef<string>("");
  const latestVisibleGraphRef = useRef(visibleScopeGraph);
  latestVisibleGraphRef.current = visibleScopeGraph;
  const visibleNodeIdsRef = useRef<string[]>([]);
  visibleNodeIdsRef.current = visibleScopeGraph.nodes.map((n) => n.id);

  useEffect(() => {
    const timer = setTimeout(() => {
      const graph = latestVisibleGraphRef.current;
      const direction = useDesignerStore.getState().layoutDirection;
      const visibleNodes = graph.nodes;
      if (!visibleNodes || visibleNodes.length === 0) return;

      // Check if all visible nodes have non-zero measured dimensions
      const allMeasured = visibleNodes.every(
        (n) => n.measured?.width && n.measured?.height && n.measured.width > 0 && n.measured.height > 0
      );
      if (!allMeasured) return;

      // Build a signature of layoutDirection and node IDs and their measured dimensions
      const signature =
        `${direction}|` +
        visibleNodes
          .map((n) => `${n.id}:${Math.round(n.measured!.width!)}x${Math.round(n.measured!.height!)}`)
          .sort()
          .join("|");

      if (measuredLayoutRanRef.current === signature) return;
      measuredLayoutRanRef.current = signature;

      // Re-run layout with actual measured dimensions and current direction
      const { nodes: layoutedNodes } = calculateAutoLayout(visibleNodes, graph.edges, {
        direction,
      });

      const positionMap = new Map(layoutedNodes.map((n) => [n.id, n.position]));
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const newPos = positionMap.get(node.id);
          if (!newPos) return node;
          if (node.position.x === newPos.x && node.position.y === newPos.y) return node;
          return {
            ...node,
            position: newPos,
            sourcePosition: direction === "LR" ? "right" : "bottom",
            targetPosition: direction === "LR" ? "left" : "top",
          };
        }) as Node[]
      );
    }, MEASURED_LAYOUT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [visibleScopeGraph, layoutDirection, setNodes]);

  // A click on the board clears the selection without opening the configuration panel.
  // Workflow configurations open from the board's context menu or the command palette.
  const handlePaneClick = useCallback(() => {
    if (contextMenu) {
      closeContextMenu();
      return;
    }
    clearSelection();
  }, [contextMenu, closeContextMenu, clearSelection]);

  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const handleNodeDragStart = useCallback((_event: React.MouseEvent, _node: any) => {
    const currentNodes = useDesignerStore.getState().nodes;
    const positions = new Map<string, { x: number; y: number }>();
    currentNodes.forEach((n) => {
      positions.set(n.id, { ...n.position });
    });
    dragStartPositionsRef.current = positions;
  }, []);

  const handleNodeDragStop = useCallback((_event: React.MouseEvent, _node: any) => {
    const startPositions = dragStartPositionsRef.current;
    if (!startPositions || startPositions.size === 0) return;

    const currentStore = useDesignerStore.getState();
    const hasMoved = currentStore.nodes.some((n) => {
      const start = startPositions.get(n.id);
      if (!start) return false;
      return Math.abs(start.x - n.position.x) > 1 || Math.abs(start.y - n.position.y) > 1;
    });

    if (hasMoved) {
      const preDragNodes = currentStore.nodes.map((n) => {
        const start = startPositions.get(n.id);
        return start ? { ...n, position: { ...start } } : n;
      });

      const preDragSnapshot: any = {
        nodes: JSON.parse(JSON.stringify(preDragNodes)),
        edges: JSON.parse(JSON.stringify(currentStore.edges)),
        workflowName: currentStore.workflowName,
        workflowVersion: currentStore.workflowVersion,
        workflowVariables: JSON.parse(JSON.stringify(currentStore.workflowVariables || {})),
        workflowDescription: currentStore.workflowDescription,
        workflowCorrelationId: currentStore.workflowCorrelationId,
        workflowLanguage: currentStore.workflowLanguage,
        workflowSupportedLanguages: [...(currentStore.workflowSupportedLanguages || [])],
      };

      useDesignerStore.setState((state) => ({
        past: [...state.past.slice(-49), preDragSnapshot],
        future: [],
        canUndo: true,
        canRedo: false,
        workflowStatus: "UNSAVED",
      }));
    }

    dragStartPositionsRef.current.clear();
  }, []);

  return (
    <div className="react-flow h-full overflow-hidden" ref={flowRef}>
      <ReactFlow
        nodes={visibleScopeGraph.nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={DESIGNER_NODE_TYPES}
        edgeTypes={DESIGNER_EDGE_TYPES}
        panActivationKeyCode={null}
        deleteKeyCode={null}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={setFlowInstance}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onSelectionChange={onSelectionChange}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        selectionOnDrag
        selectionKeyCode="Shift"
        onlyRenderVisibleElements
      >
        <FlowInternalUpdater layoutDirection={layoutDirection} nodeIdsRef={visibleNodeIdsRef} />
        <Background />
        {selectedNodeCount > 1 || scopeBreadcrumbs.length > 0 ? (
          <Panel className="panel" position="top-left">
            <div className="scope-toolbar">
              {scopeBreadcrumbs.length > 0 ? (
                <div className="scope-breadcrumb" aria-label="Scope breadcrumb">
                  <button
                    type="button"
                    className="scope-breadcrumb-button"
                    onClick={exitScopeFocus}
                  >
                    Main Canvas
                  </button>
                  {scopeBreadcrumbs.map((item, index) => {
                    const isLast = index === scopeBreadcrumbs.length - 1;
                    return (
                      <span key={item.id} className="scope-breadcrumb-label">
                        &gt;
                        <button
                          type="button"
                          className={
                            isLast
                              ? "scope-breadcrumb-button scope-breadcrumb-current"
                              : "scope-breadcrumb-button"
                          }
                          onClick={() => focusScope(item.id)}
                        >
                          {item.name}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="scope-breadcrumb-label">
                  {selectedNodeCount} nodes selected
                </span>
              )}
              {selectedNodeCount > 1 ? (
                <button
                  type="button"
                  className="scope-toolbar-button"
                  onClick={() => groupSelectedIntoScope()}
                  disabled={!canGroupSelected}
                  title={groupSelectionMessage || "Group selected nodes into a scope"}
                >
                  Group Into Scope
                </button>
              ) : null}
            </div>
          </Panel>
        ) : null}
        <Panel className="panel" position="top-right">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <WeaverButton
              variant="text"
              color="inherit"
              onClick={() => setTranslationsModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                color: "var(--color-fg-default, #111827)",
              }}
            >
              Translations
            </WeaverButton>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
          />
        </Panel>
      </ReactFlow>

      <Menu
        open={contextMenu !== null}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleContextAction("save-current-version")}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: 220,
              gap: 3,
            }}
          >
            <span>Save current version</span>
            <Typography variant="caption" color="text.secondary">
              Ctrl+S
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleContextAction("save-new-version")}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: 220,
              gap: 3,
            }}
          >
            <span>Save new version</span>
            <Typography variant="caption" color="text.secondary">
              Ctrl+Shift+S
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem
          onClick={() => handleContextAction("group")}
          disabled={!canGroupSelected}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: 220,
              gap: 3,
            }}
          >
            <span>Group Into Scope</span>
            <Typography variant="caption" color="text.secondary">
              {selectedNodeCount > 1 ? `${selectedNodeCount} nodes` : "Select 2+"}
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleContextAction("run")}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: 220,
              gap: 3,
            }}
          >
            <span>Run</span>
            <Typography variant="caption" color="text.secondary">
              Ctrl+Enter
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleContextAction("auto-layout")}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: 220,
              gap: 3,
            }}
          >
            <span>Auto Arrange</span>
            <Typography variant="caption" color="text.secondary">
              Shift+Alt+F
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeContextMenu();
            setExportInitialFormat(undefined);
            setExportModalOpen(true);
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: 240,
              gap: 3,
            }}
          >
            <span>Export Workflow...</span>
            <Typography variant="caption" color="text.secondary">
              JSON / SVG / PDF / PNG
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleContextAction("import")}>
          Import
        </MenuItem>
        <MenuItem onClick={() => handleContextAction("context-map")}>
          Context Map
        </MenuItem>
        <MenuItem onClick={() => handleContextAction("workflow-configurations")}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: 240,
              gap: 3,
            }}
          >
            <span>Workflow Configurations</span>
            <Typography variant="caption" color="text.secondary">
              Panel
            </Typography>
          </Box>
        </MenuItem>
      </Menu>

      <Modal
        aria-labelledby="context-map-viewer-title"
        open={contextMapModalOpen}
        onClose={() => setContextMapModalOpen(false)}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{ backdrop: { timeout: 300 } }}
      >
        <Fade in={contextMapModalOpen}>
          <Box
            sx={{
              ...modalStyle,
              width: 1100,
              maxWidth: "95vw",
              backgroundColor: "var(--color-canvas-subtle, #ffffff)",
              color: "var(--color-fg-default, #111827)",
            }}
            className="designer-modal node-config-modal start-config-modal run-result-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <Typography
              className="node-config-modal-title"
              id="context-map-viewer-title"
              variant="h6"
              component="h2"
              sx={{ mb: 2 }}
            >
              Context Map
            </Typography>
            <WeaverCodeEditor
              className="start-config-json-editor"
              language="json"
              value={scopedContextMapJsonText || "{}"}
              height="62vh"
              onChange={() => {}}
              options={{
                readOnly: true,
                lineNumbers: "on",
                renderLineHighlight: "none",
                folding: true,
                wordWrap: "on",
              }}
            />
          </Box>
        </Fade>
      </Modal>

      <Modal
        aria-labelledby="designer-command-palette-title"
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{ backdrop: { timeout: 220 } }}
      >
        <Fade in={commandPaletteOpen}>
          <Box
            sx={{
              ...modalStyle,
              top: "14%",
              transform: "translate(-50%, 0)",
              width: 760,
              maxWidth: "92vw",
              p: 0,
              overflow: "hidden",
              backgroundColor: "var(--color-canvas-subtle, #ffffff)",
              color: "var(--color-fg-default, #111827)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <Box
              sx={{
                p: 1.25,
                borderBottom: "1px solid var(--color-border-default, #e5e7eb)",
              }}
            >
              <input
                ref={commandInputRef}
                type="text"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Type a command or export (Ctrl+K)..."
                aria-label="Command Palette"
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--color-fg-default, #111827)",
                  fontSize: 15,
                  lineHeight: 1.5,
                  padding: "6px 8px",
                }}
              />
            </Box>
            <Box sx={{ maxHeight: "48vh", overflowY: "auto", p: 0.75 }}>
              {filteredCommandItems.length === 0 ? (
                <Box
                  sx={{
                    px: 1,
                    py: 1.25,
                    color: "var(--color-fg-muted, #6b7280)",
                    fontSize: 13,
                  }}
                >
                  No commands found.
                </Box>
              ) : (
                filteredCommandItems.map((command, index) => (
                  <button
                    key={command.id}
                    type="button"
                    onMouseEnter={() => setCommandSelectionIndex(index)}
                    onClick={() => executeCommand(command)}
                    style={{
                      width: "100%",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      color: "var(--color-fg-default, #111827)",
                      background:
                        index === commandSelectionIndex
                          ? "color-mix(in oklab, var(--color-accent-emphasis, #2563eb) 18%, transparent)"
                          : "transparent",
                    }}
                  >
                    <span>{command.label}</span>
                    {command.hint ? (
                      <span style={{ opacity: 0.7, fontSize: 12 }}>
                        {command.hint}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </Box>
          </Box>
        </Fade>
      </Modal>

      {translationsModalMounted ? (
        <WorkflowTranslationsModal
          open={translationsModalOpen}
          onClose={() => setTranslationsModalOpen(false)}
          workflowName={workflowName}
          workflowVersion={workflowVersion}
        />
      ) : null}

      {exportModalOpen ? (
        // Remaining workflow metadata is read by the modal itself from the store.
        <WorkflowExportModal
          open={exportModalOpen}
          onClose={() => {
            setExportModalOpen(false);
            setExportInitialFormat(undefined);
          }}
          nodes={visibleScopeGraph.nodes}
          edges={visibleScopeGraph.edges}
          workflowName={workflowName}
          workflowVersion={workflowVersion}
          layoutDirection={layoutDirection}
          currentTheme={themeMode === "light" ? "light" : "dark"}
          initialFormat={exportInitialFormat}
        />
      ) : null}
    </div>
  );
};

export const FlowDesigner = memo(FlowDesignerBase);
FlowDesigner.displayName = "FlowDesigner";
