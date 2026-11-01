import { useEffect, useCallback } from "react";

import "@xyflow/react/dist/style.css";
import "@/features/designer/styles/Designer.css";

import { useDesignerStore } from "@/features/designer";
import { useDesignerActions } from "@/features/designer";
import { useDesignerSession } from "@/features/designer";
import { useWorkflowLoader } from "@/features/designer";
import { useDesignerKeyboardShortcuts } from "@/features/designer";
import { useWeaverNotification } from "@/components/common/notifications";

import { DesignerHeader } from "@/features/designer";
import { ReplaceConfirmDialog } from "@/features/designer";
import { RunResultModal } from "@/features/designer";
import { WorkflowConfigurationModal } from "@/features/designer";
import { WorkflowVersionDiffModal } from "@/features/designer";
import { FlowDesigner } from "@/features/designer";
import { WeaverTaskPanelModal } from "@/features/designer";
import { WeaverNodeConfigurationPanel } from "@/features/designer";
import { WorkflowExecutionToolbar } from "@/features/designer";
import { useDesignerExecutionWatcher } from "@/features/designer";
import { useWorkflowExecutionStore } from "@/features/designer";
import { WorkflowValidationPanel } from "@/features/designer";
import { validateWorkflow } from "@/features/designer";

import { fetchWorkflowVersions } from "@/features/designer";

export default function DesignerPage() {
  const { error: showErrorNotification } = useWeaverNotification();
  // Narrow subscriptions only: graph changes must not re-render the page shell.
  const workflowName = useDesignerStore((state) => state.workflowName);
  const actionsPanelOpen = useDesignerStore((state) => state.actionsPanelOpen);
  const setActionsPanelOpen = useDesignerStore((state) => state.setActionsPanelOpen);
  const setPendingConnectionSource = useDesignerStore((state) => state.setPendingConnectionSource);
  const setWorkflowVersions = useDesignerStore((state) => state.setWorkflowVersions);
  const setWorkflowVersionsLoading = useDesignerStore((state) => state.setWorkflowVersionsLoading);
  const addNode = useDesignerStore((state) => state.addNode);

  const {
    handleRun,
    handleSaveCurrentWorkflowVersion,
    handleSaveIncrementedWorkflowVersion,
    handleExport,
    handleWorkflowVersionChange,
    applyLoadedWorkflowTopology,
    applyImportedWorkflowDraft,
    resolveWorkflowVersion,
  } = useDesignerActions();

  // Execution toolbar state
  const startExecution = useWorkflowExecutionStore((state) => state.startExecution);

  // Node-id normalization, save-status tracking and cleanup when leaving the designer
  useDesignerSession();

  // Monitor live execution progress directly from Conductor /api/workflow
  useDesignerExecutionWatcher();

  const handleInitiateRun = useCallback(() => {
    const { nodes, edges, workflowName: currentName, workflowVariables, setValidationPanelOpen } =
      useDesignerStore.getState();
    const validation = validateWorkflow({
      nodes,
      edges,
      workflowName: currentName,
      workflowVersion: resolveWorkflowVersion(),
      workflowVariables,
    });

    if (validation.summary.errors > 0) {
      setValidationPanelOpen(true);
      showErrorNotification(
        `Cannot execute workflow: ${validation.summary.errors} blocking validation error${
          validation.summary.errors > 1 ? "s" : ""
        } found. Please resolve them first.`
      );
      return;
    }

    startExecution();
    handleRun();
  }, [resolveWorkflowVersion, startExecution, handleRun, showErrorNotification]);

  // Load workflow from URL or state
  useWorkflowLoader({
    applyLoadedWorkflowTopology,
    applyImportedWorkflowDraft,
  });

  // Global keyboard shortcuts (Ctrl+S, Ctrl+Insert, Delete, Copy/Paste)
  useDesignerKeyboardShortcuts({
    onSaveCurrentVersion: handleSaveCurrentWorkflowVersion,
    onSaveIncrementedVersion: handleSaveIncrementedWorkflowVersion,
  });

  // Sync document title
  useEffect(() => {
    const trimmedName = String(workflowName || "").trim();
    document.title = trimmedName || "Untitled workflow";
  }, [workflowName]);

  // Fetch available versions for workflow
  useEffect(() => {
    const currentWorkflowName = String(workflowName || "").trim();
    if (!currentWorkflowName) {
      setWorkflowVersions([]);
      return;
    }

    let cancelled = false;
    setWorkflowVersionsLoading(true);
    fetchWorkflowVersions(currentWorkflowName)
      .then((versions) => {
        if (!cancelled) setWorkflowVersions(versions);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWorkflowVersions([]);
          const errorMessage = error instanceof Error ? error.message : "Unknown error.";
          showErrorNotification(`Failed to load versions: ${errorMessage}`);
        }
      })
      .finally(() => {
        if (!cancelled) setWorkflowVersionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workflowName, setWorkflowVersions, setWorkflowVersionsLoading, showErrorNotification]);

  const handleCloseActionsPanel = useCallback(() => {
    setActionsPanelOpen(false);
    setPendingConnectionSource(null);
  }, [setActionsPanelOpen, setPendingConnectionSource]);

  const handleAddNode = useCallback((kind: string) => addNode(kind), [addNode]);

  return (
    <>
      <ReplaceConfirmDialog />
      <RunResultModal />
      {/* Serializes the workflow JSON itself, and only while its JSON tab is open */}
      <WorkflowConfigurationModal />
      <WorkflowVersionDiffModal />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <DesignerHeader onWorkflowVersionChange={handleWorkflowVersionChange} />

        <div
          className="designer-workspace"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            gap: 0,
            padding: 0,
            background: "transparent",
            position: "relative",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <WorkflowExecutionToolbar onRun={handleInitiateRun} />

          <div style={{ flex: 1, minWidth: 0, height: "100%", position: "relative" }}>
            <FlowDesigner
              onRun={handleInitiateRun}
              onSaveCurrentVersion={handleSaveCurrentWorkflowVersion}
              onSaveNewVersion={handleSaveIncrementedWorkflowVersion}
              onExport={handleExport}
            />
          </div>

          <WeaverNodeConfigurationPanel />
          <WorkflowValidationPanel />

          <WeaverTaskPanelModal
            open={actionsPanelOpen}
            onClose={handleCloseActionsPanel}
            onAddNode={handleAddNode}
          />
        </div>
      </div>
    </>
  );
}
