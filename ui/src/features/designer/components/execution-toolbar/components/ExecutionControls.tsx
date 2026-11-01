import React, { useState, useEffect } from "react";
import Tooltip from "@mui/material/Tooltip";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  Loader2,
  Clock,
  X,
} from "lucide-react";
import type { ExecutionControlsProps } from "../types";
import styles from "../WorkflowExecutionToolbar.module.css";

const formatTimer = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  status,
  workflowId,
  startTime,
  endTime,
  durationMs,
  onRun,
  onPause,
  onResume,
  onTerminate,
  onRestart,
  onRetry,
  onReset,
  onOptionsToggle,
  isOptionsOpen,
}) => {
  const isIdle = status === "idle";
  const isStarting = status === "starting";
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isFinished =
    status === "completed" || status === "failed" || status === "terminated";

  // Elapsed time state
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    if (!isRunning || !startTime) {
      if (durationMs) {
        setElapsedMs(durationMs);
      } else if (startTime && endTime) {
        setElapsedMs(Math.max(0, endTime - startTime));
      }
      return;
    }

    const updateTimer = () => {
      setElapsedMs(Math.max(0, Date.now() - startTime));
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 500);

    return () => clearInterval(timerInterval);
  }, [isRunning, startTime, endTime, durationMs]);

  // Beacon class & label
  const getBeaconInfo = () => {
    switch (status) {
      case "starting":
        return {
          dotClass: styles.beaconRunning,
          textClass: styles.statusRunningText,
          label: "Starting",
        };
      case "running":
        return {
          dotClass: styles.beaconRunning,
          textClass: styles.statusRunningText,
          label: "Running",
        };
      case "paused":
        return {
          dotClass: styles.beaconPaused,
          textClass: styles.statusPausedText,
          label: "Paused",
        };
      case "completed":
        return {
          dotClass: styles.beaconCompleted,
          textClass: styles.statusCompletedText,
          label: "Completed",
        };
      case "failed":
        return {
          dotClass: styles.beaconFailed,
          textClass: styles.statusFailedText,
          label: "Failed",
        };
      case "terminated":
        return {
          dotClass: styles.beaconFailed,
          textClass: styles.statusFailedText,
          label: "Terminated",
        };
      case "idle":
      default:
        return {
          dotClass: styles.beaconReady,
          textClass: "",
          label: "Ready",
        };
    }
  };

  const beacon = getBeaconInfo();

  return (
    <>
      {/* 1. Status Indicator & Beacon (only shown when not idle) */}
      {!isIdle && (
        <div className={styles.statusSection} role="status" aria-live="polite">
          <span className={`${styles.beaconDot} ${beacon.dotClass}`} />
          <span className={`${styles.statusLabel} ${beacon.textClass}`}>
            {beacon.label}
          </span>
        </div>
      )}

      {/* 2. Timer / Duration (when active or finished) */}
      {(isRunning || isPaused || isFinished) && (
        <div className={styles.timerBadge} title="Execution duration">
          <Clock size={11} style={{ opacity: 0.7 }} />
          <span>
            {isRunning || isPaused
              ? formatTimer(elapsedMs)
              : formatDuration(durationMs ?? elapsedMs)}
          </span>
        </div>
      )}

      {!isIdle && <div className={styles.hudDivider} />}

      {/* 3. Action Controls */}
      <div className={styles.controlsCluster}>
        {/* A. Standalone Run Button (circular icon-only button) */}
        <Tooltip
          title={
            isStarting
              ? "Starting workflow..."
              : isRunning
              ? "Workflow is currently running"
              : "Run workflow (Ctrl+Enter)"
          }
          arrow
          placement="bottom"
        >
          <span>
            <button
              type="button"
              className={styles.runButton}
              onClick={onRun}
              disabled={isRunning || isStarting}
              aria-label="Run workflow"
            >
              {isStarting ? (
                <Loader2 size={14} className={styles.spinningIcon} />
              ) : (
                <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />
              )}
            </button>
          </span>
        </Tooltip>

        {/* B. Pause / Resume Button (appeared in all states, disabled when not running) */}
        <Tooltip
          title={
            isPaused
              ? "Resume execution"
              : isRunning
              ? "Pause execution"
              : "Pause (disabled - not running)"
          }
          arrow
          placement="bottom"
        >
          <span>
            <button
              type="button"
              className={`${styles.hudIconButton} ${
                isPaused ? styles.resumeBtn : styles.pauseBtn
              }`}
              onClick={isPaused ? onResume : onPause}
              disabled={!isRunning && !isPaused}
              aria-label={isPaused ? "Resume execution" : "Pause execution"}
            >
              {isPaused ? (
                <Play size={13} fill="currentColor" />
              ) : (
                <Pause size={14} fill="currentColor" />
              )}
            </button>
          </span>
        </Tooltip>

        {/* C. Terminate Button (appeared in all states, disabled when not running) */}
        <Tooltip
          title={
            isRunning || isPaused || isStarting
              ? "Terminate execution"
              : "Terminate (disabled - not running)"
          }
          arrow
          placement="bottom"
        >
          <span>
            <button
              type="button"
              className={`${styles.hudIconButton} ${styles.terminateBtn}`}
              onClick={onTerminate}
              disabled={!isRunning && !isPaused && !isStarting}
              aria-label="Terminate execution"
            >
              <Square size={13} fill="currentColor" />
            </button>
          </span>
        </Tooltip>

        {/* D. Restart Button (appeared in all states, disabled when not running) */}
        <Tooltip
          title={
            workflowId
              ? "Restart execution"
              : "Restart (disabled - not running)"
          }
          arrow
          placement="bottom"
        >
          <span>
            <button
              type="button"
              className={`${styles.hudIconButton} ${styles.restartBtn}`}
              onClick={onRestart}
              disabled={!workflowId || (!isRunning && !isPaused && !isFinished)}
              aria-label="Restart execution"
            >
              <RotateCcw size={13} />
            </button>
          </span>
        </Tooltip>

        {/* E. Retry Button (appeared in all states, disabled when not running or no failure) */}
        <Tooltip
          title={
            status === "failed"
              ? "Retry failed tasks"
              : "Retry (disabled - not running)"
          }
          arrow
          placement="bottom"
        >
          <span>
            <button
              type="button"
              className={`${styles.hudIconButton} ${styles.retryBtn}`}
              onClick={onRetry}
              disabled={!workflowId || status !== "failed"}
              aria-label="Retry execution"
            >
              <RefreshCw size={13} />
            </button>
          </span>
        </Tooltip>

        {/* F. Deep Link to Execution Monitor */}
        {workflowId && (
          <Tooltip title="Open in Execution Monitor" arrow placement="bottom">
            <a
              href={`/monitoring/${encodeURIComponent(workflowId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.hudIconButton} ${styles.monitorBtn}`}
              aria-label="Open in Execution Monitor"
            >
              <ExternalLink size={13} />
            </a>
          </Tooltip>
        )}

        {/* G. Reset Button (to clear finished state back to idle) */}
        {isFinished && (
          <Tooltip title="Reset to ready" arrow placement="bottom">
            <button
              type="button"
              className={styles.resetBtn}
              onClick={onReset}
              aria-label="Reset to ready"
            >
              <X size={14} />
            </button>
          </Tooltip>
        )}

        {/* H. Execution Options Toggle Button */}
        <Tooltip title="Execution Options" arrow placement="bottom">
          <button
            type="button"
            className={`${styles.hudIconButton} ${styles.optionsBtn} ${
              isOptionsOpen ? styles.optionsBtnActive : ""
            }`}
            onClick={onOptionsToggle}
            aria-label="Open execution options"
          >
            <SlidersHorizontal size={13} />
          </button>
        </Tooltip>
      </div>
    </>
  );
};
