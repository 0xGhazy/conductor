import React, { memo, useRef, useCallback, useEffect, useContext } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import {
  pauseWorkflowExecution,
  resumeWorkflowExecution,
  terminateWorkflowExecution,
  restartWorkflowExecution,
  retryWorkflowExecution,
} from "@/features/designer/services/designerApi";
import { WeaverNotificationContext } from "@/components/common/notifications/WeaverNotificationProvider/WeaverNotificationProvider";
import { ExecutionControls } from "./components/ExecutionControls";
import { ExecutionOptionsDeck } from "./components/ExecutionOptionsDeck";
import type { WorkflowExecutionToolbarProps } from "./types";
import styles from "./WorkflowExecutionToolbar.module.css";

const WorkflowExecutionToolbarBase: React.FC<WorkflowExecutionToolbarProps> = ({
  className = "",
  onRun: onExternalRun,
}) => {
  const {
    status,
    workflowId,
    startTime,
    endTime,
    durationMs,
    pauseExecution,
    resumeExecution,
    terminateExecution,
    resetExecution,
    setExecutionStatus,
    isOptionsPopoverOpen,
    setOptionsPopoverOpen,
  } = useWorkflowExecutionStore(
    useShallow((state) => ({
      status: state.status,
      workflowId: state.workflowId,
      startTime: state.startTime,
      endTime: state.endTime,
      durationMs: state.durationMs,
      pauseExecution: state.pauseExecution,
      resumeExecution: state.resumeExecution,
      terminateExecution: state.terminateExecution,
      resetExecution: state.resetExecution,
      setExecutionStatus: state.setExecutionStatus,
      isOptionsPopoverOpen: state.isOptionsPopoverOpen,
      setOptionsPopoverOpen: state.setOptionsPopoverOpen,
    }))
  );

  const notify = useContext(WeaverNotificationContext);
  const showErrorNotification = notify?.error ?? ((msg: any) => console.error(msg));
  const showInfoNotification = notify?.info ?? ((msg: any) => console.info(msg));
  const hudRef = useRef<HTMLDivElement>(null);

  const handleRun = useCallback(() => {
    onExternalRun?.();
  }, [onExternalRun]);

  const handlePause = async () => {
    try {
      if (workflowId) {
        await pauseWorkflowExecution(workflowId);
      }
      pauseExecution();
      showInfoNotification("Workflow execution paused.");
    } catch (err: any) {
      showErrorNotification(`Failed to pause: ${err?.message || "Unknown error"}`);
    }
  };

  const handleResume = async () => {
    try {
      if (workflowId) {
        await resumeWorkflowExecution(workflowId);
      }
      resumeExecution();
      showInfoNotification("Workflow execution resumed.");
    } catch (err: any) {
      showErrorNotification(`Failed to resume: ${err?.message || "Unknown error"}`);
    }
  };

  const handleTerminate = async () => {
    try {
      if (workflowId) {
        await terminateWorkflowExecution(workflowId, "Terminated by user from Designer HUD");
      }
      terminateExecution();
      showInfoNotification("Workflow execution terminated.");
    } catch (err: any) {
      showErrorNotification(`Failed to terminate: ${err?.message || "Unknown error"}`);
    }
  };

  const handleRestart = async () => {
    try {
      if (workflowId) {
        await restartWorkflowExecution(workflowId);
        showInfoNotification("Workflow execution restarted.");
        setExecutionStatus("running");
      } else {
        handleRun();
      }
    } catch (err: any) {
      showErrorNotification(`Failed to restart: ${err?.message || "Unknown error"}`);
    }
  };

  const handleRetry = async () => {
    try {
      if (workflowId) {
        await retryWorkflowExecution(workflowId);
        showInfoNotification("Workflow retry initiated.");
        setExecutionStatus("running");
      }
    } catch (err: any) {
      showErrorNotification(`Failed to retry: ${err?.message || "Unknown error"}`);
    }
  };

  const handleOptionsToggle = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setOptionsPopoverOpen(!isOptionsPopoverOpen);
  };

  const handleOptionsClose = () => {
    setOptionsPopoverOpen(false);
  };

  // Click outside and Escape key handling to collapse the floating deck
  useEffect(() => {
    if (!isOptionsPopoverOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        hudRef.current &&
        !hudRef.current.contains(target) &&
        !target.closest(".MuiPopover-root") &&
        !target.closest(".MuiMenu-root") &&
        !target.closest(".MuiAutocomplete-popper")
      ) {
        setOptionsPopoverOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOptionsPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOptionsPopoverOpen, setOptionsPopoverOpen]);

  // Keyboard shortcut: Ctrl+Enter to trigger execution when idle or rerun
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (status === "idle" || status === "completed" || status === "failed" || status === "terminated") {
          handleRun();
        } else if (status === "paused") {
          handleResume();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, handleRun, handleResume]);

  return (
    <div
      ref={hudRef}
      className={`${styles.hudContainer} ${
        isOptionsPopoverOpen ? styles.hudContainerExpanded : ""
      } ${className}`}
      role="toolbar"
      aria-label="Workflow Execution HUD"
    >
      <div className={styles.deckContent}>
        <ExecutionControls
          status={status}
          workflowId={workflowId}
          startTime={startTime}
          endTime={endTime}
          durationMs={durationMs}
          onRun={handleRun}
          onPause={handlePause}
          onResume={handleResume}
          onTerminate={handleTerminate}
          onRestart={handleRestart}
          onRetry={handleRetry}
          onReset={resetExecution}
          onOptionsToggle={handleOptionsToggle}
          isOptionsOpen={isOptionsPopoverOpen}
        />

        {isOptionsPopoverOpen && (
          <ExecutionOptionsDeck onClose={handleOptionsClose} />
        )}
      </div>
    </div>
  );
};

export const WorkflowExecutionToolbar = memo(WorkflowExecutionToolbarBase);
WorkflowExecutionToolbar.displayName = "WorkflowExecutionToolbar";
