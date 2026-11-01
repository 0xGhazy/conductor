import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  GitCompare,
  Lock,
  Unlock,
  Maximize2,
  FileCode,
  Network,
  X,
  RotateCcw,
  Plus,
  Minus,
  AlertCircle,
} from "lucide-react";
import styles from "./WorkflowVersionDiffModal.module.css";
import { DiffNode } from "./DiffNode";
import { DiffBranchEdge } from "./DiffBranchEdge";
import { ParameterDiffDrawer } from "./ParameterDiffDrawer";
import DiffJsonEditor from "@/components/common/editors/DiffJsonEditor/DiffJsonEditor";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useDesignerActions } from "@/features/designer/hooks/useDesignerActions";
import { useWeaverNotification } from "@/components/common/notifications";
import { fetchWorkflowJsonByName } from "@/features/designer/services/designerApi";
import {
  normalizeWorkflowDtoJsonToTopology,
  extractWorkflowJsonDataFromResponse,
} from "@/features/designer/utils/workflowSerialization";
import {
  calculateWorkflowDiff,
  extractNodeComparableConfig,
  type DiffStatus,
  type ParameterDiffItem,
  type WorkflowDiffResult,
} from "@/features/designer/utils/workflowDiffUtils";

const diffNodeTypes = {
  diffNode: DiffNode,
  start: DiffNode,
  START_NODE: DiffNode,
  end: DiffNode,
  END_NODE: DiffNode,
  endFlag: DiffNode,
  HTTP_ACTION: DiffNode,
  DATABASE_ACTION: DiffNode,
  SCRIPT_ACTION: DiffNode,
  JEXL_ACTION: DiffNode,
  VALIDATION_ACTION: DiffNode,
  SWITCH_ACTION: DiffNode,
  WAIT_ACTION: DiffNode,
  DELAY_ACTION: DiffNode,
  FOREACH_ACTION: DiffNode,
  REDIS_ACTION: DiffNode,
  RULE_ENGINE_ACTION: DiffNode,
  SUBWORKFLOW_ACTION: DiffNode,
  WORKFLOW: DiffNode,
  TERMINATE: DiffNode,
  RESPOND: DiffNode,
  RESPOND_ACTION: DiffNode,
  default: DiffNode,
};

const diffEdgeTypes = {
  diffEdge: DiffBranchEdge,
  weaverBranchEdge: DiffBranchEdge,
  step: DiffBranchEdge,
  smoothstep: DiffBranchEdge,
  default: DiffBranchEdge,
};

export interface WorkflowVersionDiffModalProps {
  open?: boolean;
  onClose?: () => void;
  onRestoreVersion?: (version: number | string, topology: any) => void;
}

export const WorkflowVersionDiffModal: React.FC<WorkflowVersionDiffModalProps> = ({
  open: controlledOpen,
  onClose: controlledOnClose,
  onRestoreVersion: externalOnRestore,
}) => {
  const storeDiffOpen = useDesignerStore((s) => s.workflowDiffModalOpen);
  const setStoreDiffOpen = useDesignerStore((s) => s.setWorkflowDiffModalOpen);
  const workflowName = useDesignerStore((s) => s.workflowName);
  const currentVersion = useDesignerStore((s) => s.workflowVersion);
  const workflowVersions = useDesignerStore((s) => s.workflowVersions);
  const themeMode = useDesignerStore((s) => s.themeMode);

  const { applyLoadedWorkflowTopology } = useDesignerActions();
  const { success: showSuccess, error: showError } = useWeaverNotification();

  const isOpen = controlledOpen !== undefined ? controlledOpen : storeDiffOpen;

  const handleClose = useCallback(() => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setStoreDiffOpen(false);
    }
  }, [controlledOnClose, setStoreDiffOpen]);

  // Available versions sorted descending
  const availableVersions = useMemo(() => {
    const list = Array.isArray(workflowVersions) ? [...workflowVersions] : [];
    if (list.length === 0 && currentVersion) {
      const parsed = Number(currentVersion);
      if (!Number.isNaN(parsed)) list.push(parsed);
    }
    return Array.from(new Set(list)).sort((a, b) => Number(b) - Number(a));
  }, [workflowVersions, currentVersion]);

  // Version selection state
  const [targetVersion, setTargetVersion] = useState<number | string>("");
  const [baseVersion, setBaseVersion] = useState<number | string>("");

  // Initialize selected versions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const currentNum = Number(currentVersion) || availableVersions[0] || 1;
    const target = currentNum;
    // Base is previous version, or 1
    const baseCandidate = availableVersions.find((v) => Number(v) < Number(target));
    const base = baseCandidate !== undefined ? baseCandidate : availableVersions[availableVersions.length - 1] || target;

    setTargetVersion(target);
    setBaseVersion(base);
  }, [isOpen, currentVersion, availableVersions]);

  // View state
  const [viewMode, setViewMode] = useState<"dag" | "json">("dag");
  const [isCameraLocked, setIsCameraLocked] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Loaded topologies
  const [baseRawJson, setBaseRawJson] = useState<any>(null);
  const [targetRawJson, setTargetRawJson] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Restore Confirmation State
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<number | string | null>(null);

  // Fetch topologies when base or target version changes
  useEffect(() => {
    if (!isOpen || !workflowName || !baseVersion || !targetVersion) return;

    let cancelled = false;
    const loadWorkflows = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [baseRes, targetRes] = await Promise.all([
          fetchWorkflowJsonByName(workflowName, baseVersion),
          fetchWorkflowJsonByName(workflowName, targetVersion),
        ]);

        if (cancelled) return;

        const safeExtract = (res: any) => {
          try {
            return extractWorkflowJsonDataFromResponse(res);
          } catch {
            const raw = res?.data ?? res;
            if (raw && (Array.isArray(raw?.tasks) || Array.isArray(raw?.nodes) || typeof raw === "object")) {
              return raw;
            }
            throw new Error("Workflow JSON data not found in backend response.");
          }
        };

        const baseJson = safeExtract(baseRes);
        const targetJson = safeExtract(targetRes);

        setBaseRawJson(baseJson);
        setTargetRawJson(targetJson);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || "Failed to load workflow versions for comparison.";
        setLoadError(msg);
        showError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadWorkflows();

    return () => {
      cancelled = true;
    };
  }, [isOpen, workflowName, baseVersion, targetVersion, showError]);

  // Compute graph topologies
  const baseTopology = useMemo(() => {
    if (!baseRawJson) return { nodes: [], edges: [] };
    const normalized = normalizeWorkflowDtoJsonToTopology(baseRawJson);
    return {
      nodes: Array.isArray(normalized?.nodes) ? normalized.nodes : [],
      edges: Array.isArray(normalized?.edges) ? normalized.edges : [],
    };
  }, [baseRawJson]);

  const targetTopology = useMemo(() => {
    if (!targetRawJson) return { nodes: [], edges: [] };
    const normalized = normalizeWorkflowDtoJsonToTopology(targetRawJson);
    return {
      nodes: Array.isArray(normalized?.nodes) ? normalized.nodes : [],
      edges: Array.isArray(normalized?.edges) ? normalized.edges : [],
    };
  }, [targetRawJson]);

  // Node selection callback
  const handleSelectNode = useCallback((nodeId: string, nodeData: any) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Compute complete diff
  const diffResult: WorkflowDiffResult = useMemo(() => {
    const diff = calculateWorkflowDiff(
      baseTopology.nodes,
      baseTopology.edges,
      targetTopology.nodes,
      targetTopology.edges
    );

    // Attach onSelectNode callback to decorated nodes
    const baseWithHandler = diff.baseNodesDecorated.map((n) => ({
      ...n,
      type: "diffNode",
      data: {
        ...(n.data || {}),
        onSelectNode: handleSelectNode,
      },
    }));

    const targetWithHandler = diff.targetNodesDecorated.map((n) => ({
      ...n,
      type: "diffNode",
      data: {
        ...(n.data || {}),
        onSelectNode: handleSelectNode,
      },
    }));

    const baseEdgesDecorated = diff.baseEdgesDecorated.map((e) => ({
      ...e,
      type: "diffEdge",
    }));

    const targetEdgesDecorated = diff.targetEdgesDecorated.map((e) => ({
      ...e,
      type: "diffEdge",
    }));

    return {
      ...diff,
      baseNodesDecorated: baseWithHandler,
      targetNodesDecorated: targetWithHandler,
      baseEdgesDecorated,
      targetEdgesDecorated,
    };
  }, [baseTopology, targetTopology, handleSelectNode]);

  // Selected node detailed diff info
  const selectedNodeDiffInfo = useMemo(() => {
    if (!selectedNodeId) return null;

    // Search target first, then base
    const foundTarget = targetTopology.nodes.find((n) => n.id === selectedNodeId);
    const foundBase = baseTopology.nodes.find((n) => n.id === selectedNodeId);
    const node = foundTarget || foundBase;
    if (!node) return null;

    const refName =
      node.data?.config?.taskReferenceName ||
      node.data?.taskReferenceName ||
      node.id;

    const diffEntry = diffResult.nodeDiffs.get(refName) || diffResult.nodeDiffs.get(node.id);

    const baseNode = diffEntry?.baseNode || foundBase;
    const targetNode = diffEntry?.targetNode || foundTarget;

    const baseConfig = baseNode ? extractNodeComparableConfig(baseNode) : {};
    const targetConfig = targetNode ? extractNodeComparableConfig(targetNode) : {};

    return {
      id: selectedNodeId,
      taskReferenceName: refName,
      title: node.data?.config?.nodeName || node.data?.name || refName,
      nodeType: node.type || "default",
      status: diffEntry?.status || ("unchanged" as DiffStatus),
      parameterDiffs: diffEntry?.parameterDiffs || [],
      baseConfig,
      targetConfig,
    };
  }, [selectedNodeId, targetTopology.nodes, baseTopology.nodes, diffResult]);

  // Synchronized Dual Camera
  const instanceARef = useRef<ReactFlowInstance | null>(null);
  const instanceBRef = useRef<ReactFlowInstance | null>(null);
  const isSyncingRef = useRef(false);

  const handleMoveA = useCallback(
    (_: any, viewport: Viewport) => {
      if (!isCameraLocked || isSyncingRef.current || !instanceBRef.current) return;
      isSyncingRef.current = true;
      instanceBRef.current.setViewport(viewport, { duration: 0 });
      isSyncingRef.current = false;
    },
    [isCameraLocked]
  );

  const handleMoveB = useCallback(
    (_: any, viewport: Viewport) => {
      if (!isCameraLocked || isSyncingRef.current || !instanceARef.current) return;
      isSyncingRef.current = true;
      instanceARef.current.setViewport(viewport, { duration: 0 });
      isSyncingRef.current = false;
    },
    [isCameraLocked]
  );

  const handleFitBothViews = useCallback(() => {
    instanceARef.current?.fitView({ padding: 0.2, duration: 250 });
    instanceBRef.current?.fitView({ padding: 0.2, duration: 250 });
  }, []);

  // Restore Execution
  const triggerRestore = (version: number | string) => {
    setVersionToRestore(version);
    setConfirmRestoreOpen(true);
  };

  const executeRestore = () => {
    if (!versionToRestore) return;
    const restoreJson = versionToRestore === targetVersion ? targetRawJson : baseRawJson;

    if (!restoreJson) {
      showError("Unable to restore version: workflow definition missing.");
      return;
    }

    if (externalOnRestore) {
      externalOnRestore(versionToRestore, restoreJson);
    } else {
      applyLoadedWorkflowTopology({
        topology: restoreJson,
        workflowNameParam: workflowName,
        requestedVersion: versionToRestore,
      });
      showSuccess(`Workflow successfully restored to Version ${versionToRestore}.`);
    }

    setConfirmRestoreOpen(false);
    handleClose();
  };

  if (!isOpen) return null;

  const { summary } = diffResult;

  return (
    <>
      <div className={styles.diffModalOverlay} role="dialog" aria-modal="true">
        <div className={styles.diffModalContainer}>
          {/* Header Bar */}
          <header className={styles.diffHeaderBar}>
            {/* Left: Title & Summary */}
            <div className={styles.headerLeft}>
              <div className={styles.modalTitleGroup}>
                <span className={styles.modalTitleIcon}>
                  <GitCompare size={20} />
                </span>
                <span className={styles.modalTitleText}>Version Comparison</span>
              </div>

              <div className={styles.workflowNamePill} title={workflowName}>
                {workflowName || "Workflow"}
              </div>

              {/* Summary Telemetry Badges */}
              <div className={styles.summaryPills}>
                <span className={`${styles.summaryBadge} ${styles.badgeAdded}`} title="Added Nodes">
                  <Plus size={11} style={{ marginRight: 2 }} />
                  {summary.addedNodes} Added
                </span>
                <span className={`${styles.summaryBadge} ${styles.badgeRemoved}`} title="Removed Nodes">
                  <Minus size={11} style={{ marginRight: 2 }} />
                  {summary.removedNodes} Removed
                </span>
                <span className={`${styles.summaryBadge} ${styles.badgeModified}`} title="Modified Nodes">
                  <AlertCircle size={11} style={{ marginRight: 2 }} />
                  {summary.modifiedNodes} Modified
                </span>
              </div>
            </div>

            {/* Center: View Switcher */}
            <div className={styles.headerCenter}>
              <div className={styles.viewModeSwitcher}>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${
                    viewMode === "dag" ? styles.viewModeActive : ""
                  }`}
                  onClick={() => setViewMode("dag")}
                >
                  <Network size={14} />
                  Visual DAG Diff
                </button>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${
                    viewMode === "json" ? styles.viewModeActive : ""
                  }`}
                  onClick={() => setViewMode("json")}
                >
                  <FileCode size={14} />
                  JSON Diff
                </button>
              </div>
            </div>

            {/* Right: Actions */}
            <div className={styles.headerRight}>
              {viewMode === "dag" && (
                <>
                  <button
                    type="button"
                    className={`${styles.controlBtn} ${
                      isCameraLocked ? styles.controlBtnActive : ""
                    }`}
                    onClick={() => setIsCameraLocked((prev) => !prev)}
                    title={
                      isCameraLocked
                        ? "Pan & Zoom Synchronized (Click to Unlock)"
                        : "Pan & Zoom Independent (Click to Lock)"
                    }
                  >
                    {isCameraLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    {isCameraLocked ? "Locked Viewports" : "Free Viewports"}
                  </button>

                  <button
                    type="button"
                    className={styles.controlBtn}
                    onClick={handleFitBothViews}
                    title="Fit Both Workflows into View"
                  >
                    <Maximize2 size={14} />
                    Reset View
                  </button>
                </>
              )}

              {/* Restore Button */}
              {targetVersion && (
                <button
                  type="button"
                  className={styles.restorePrimaryBtn}
                  onClick={() => triggerRestore(targetVersion)}
                  title={`Restore Version ${targetVersion} into active canvas`}
                >
                  <RotateCcw size={14} />
                  Restore v{targetVersion}
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                className={styles.closeIconBtn}
                onClick={handleClose}
                aria-label="Close Version Comparison"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Version Selection Ribbon */}
          <div className={styles.versionRibbon}>
            {/* Version A (Baseline) */}
            <div className={styles.ribbonColumn}>
              <div className={styles.ribbonVersionSelectGroup}>
                <span className={styles.ribbonLabel}>Baseline (A):</span>
                <select
                  className={styles.versionSelect}
                  value={String(baseVersion)}
                  onChange={(e) => setBaseVersion(Number(e.target.value) || e.target.value)}
                  aria-label="Select Baseline Version"
                >
                  {availableVersions.map((v) => (
                    <option key={`base-v-${v}`} value={String(v)}>
                      v{v}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.ribbonStats}>
                {baseTopology.nodes.length} nodes · {baseTopology.edges.length} edges
              </div>
            </div>

            {/* Version B (Target) */}
            <div className={styles.ribbonColumn}>
              <div className={styles.ribbonVersionSelectGroup}>
                <span className={styles.ribbonLabel}>Target (B):</span>
                <select
                  className={styles.versionSelect}
                  value={String(targetVersion)}
                  onChange={(e) => setTargetVersion(Number(e.target.value) || e.target.value)}
                  aria-label="Select Target Version"
                >
                  {availableVersions.map((v) => (
                    <option key={`target-v-${v}`} value={String(v)}>
                      v{v}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.ribbonStats}>
                {targetTopology.nodes.length} nodes · {targetTopology.edges.length} edges
              </div>
            </div>
          </div>

          {/* Workspace Area */}
          <main className={styles.diffMainWorkspace}>
            {loading ? (
              <div className={styles.diffLoadingOverlay}>
                <div className={styles.spinner} />
                <span>Loading workflow version definitions...</span>
              </div>
            ) : loadError ? (
              <div className={styles.diffLoadingOverlay}>
                <AlertCircle size={32} color="var(--color-status-danger)" />
                <span>{loadError}</span>
              </div>
            ) : viewMode === "dag" ? (
              <div className={styles.dualCanvasContainer}>
                {/* Canvas A (Baseline) */}
                <div className={styles.canvasViewportWrapper}>
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={diffResult.baseNodesDecorated}
                      edges={diffResult.baseEdgesDecorated}
                      nodeTypes={diffNodeTypes}
                      edgeTypes={diffEdgeTypes}
                      onInit={(instance) => {
                        instanceARef.current = instance;
                        instance.fitView({ padding: 0.2 });
                      }}
                      onMove={handleMoveA}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={true}
                      zoomOnScroll={true}
                      panOnDrag={true}
                      minZoom={0.2}
                      maxZoom={2.0}
                    >
                      <Background color="var(--color-border-default, #e5e7eb)" gap={16} />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>

                {/* Center Divider with Lock Icon */}
                <div className={styles.canvasSeparator}>
                  <div className={styles.canvasSeparatorBadge} title="Synchronized Viewport Divider">
                    {isCameraLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  </div>
                </div>

                {/* Canvas B (Target) */}
                <div className={styles.canvasViewportWrapper}>
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={diffResult.targetNodesDecorated}
                      edges={diffResult.targetEdgesDecorated}
                      nodeTypes={diffNodeTypes}
                      edgeTypes={diffEdgeTypes}
                      onInit={(instance) => {
                        instanceBRef.current = instance;
                        instance.fitView({ padding: 0.2 });
                      }}
                      onMove={handleMoveB}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={true}
                      zoomOnScroll={true}
                      panOnDrag={true}
                      minZoom={0.2}
                      maxZoom={2.0}
                    >
                      <Background color="var(--color-border-default, #e5e7eb)" gap={16} />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>

                {/* Parameter Diff Drawer (Inspector) */}
                {selectedNodeDiffInfo && (
                  <ParameterDiffDrawer
                    selectedNode={selectedNodeDiffInfo}
                    baseVersion={baseVersion}
                    targetVersion={targetVersion}
                    onClose={() => setSelectedNodeId(null)}
                  />
                )}
              </div>
            ) : (
              <div className={styles.jsonDiffContainer}>
                <DiffJsonEditor
                  original={JSON.stringify(baseRawJson || {}, null, 2)}
                  modified={JSON.stringify(targetRawJson || {}, null, 2)}
                  height="100%"
                  theme={themeMode === "dark" ? "vs-dark" : "vs"}
                  renderSideBySide={true}
                  readOnly={true}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Restore Version Confirmation Dialog */}
      <WeaverConfirmDialog
        open={confirmRestoreOpen}
        title={`Restore Version ${versionToRestore}`}
        message={`Are you sure you want to restore Version ${versionToRestore} into your designer canvas?`}
        description="This will replace the workflow topology currently in your canvas workspace. Any unsaved edits will be lost."
        intent="warning"
        confirmLabel={`Restore v${versionToRestore}`}
        cancelLabel="Cancel"
        onConfirm={executeRestore}
        onCancel={() => setConfirmRestoreOpen(false)}
      />
    </>
  );
};

export default WorkflowVersionDiffModal;
