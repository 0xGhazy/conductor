import React, { useMemo } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import {
  DEFAULT_START_TIMEOUT_SECONDS,
  isStartNode,
} from "@/features/designer/utils/designerGraphUtils";
import {
  useWorkflowExecutionStore,
  DEFAULT_EXECUTION_OPTIONS,
} from "@/features/designer/store/useWorkflowExecutionStore";
import styles from "./ExecutionOptionsDeck.module.css";

export interface ExecutionOptionsDeckProps {
  onClose: () => void;
  className?: string;
}

export const ExecutionOptionsDeck: React.FC<ExecutionOptionsDeckProps> = ({
  onClose,
  className = "",
}) => {
  const options = useWorkflowExecutionStore((state) => state.options);
  const setOption = useWorkflowExecutionStore((state) => state.setOption);
  const setOptions = useWorkflowExecutionStore((state) => state.setOptions);

  const nodes = useDesignerStore((state) => state.nodes);

  const workflowTimeout = useMemo(() => {
    const startNode = nodes.find(
      (n) =>
        isStartNode(n) ||
        n.id === "start" ||
        n.type === "start" ||
        n.type === "startFlag"
    );
    const rawTimeout = Number(startNode?.data?.config?.timeoutSeconds);
    return Number.isFinite(rawTimeout) && rawTimeout > 0
      ? rawTimeout
      : DEFAULT_START_TIMEOUT_SECONDS;
  }, [nodes]);

  const taskOptions = useMemo(() => {
    const list = [{ label: "None (Do not pause)", value: "" }];
    nodes.forEach((node) => {
      if (
        node.id === "start" ||
        node.type === "start" ||
        (node.data as any)?.kind === "start"
      ) {
        return;
      }
      const refName =
        (node.data as any)?.config?.taskReferenceName ||
        (node.data as any)?.config?.referenceName ||
        (node.data as any)?.name ||
        node.id;

      if (!refName) return;

      const nodeName = (node.data as any)?.name;
      const label =
        nodeName && nodeName !== refName
          ? `${nodeName} (${refName})`
          : refName;

      if (!list.some((item) => item.value === refName)) {
        list.push({ label, value: refName });
      }
    });
    return list;
  }, [nodes]);

  const hasTasks = taskOptions.length > 1;
  const isSync = options.executionMode === "Sync";
  const refreshIntervals = ["1s", "2s", "5s", "10s"];

  const handleResetDefaults = () => {
    setOptions({
      ...DEFAULT_EXECUTION_OPTIONS,
      waitSeconds: workflowTimeout,
    });
  };

  const handleGenerateUUID = () => {
    const uuid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `corr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setOption("correlationId", uuid);
  };

  return (
    <div
      className={`${styles.deckWrapper} ${className}`}
      role="region"
      aria-label="Execution Options"
    >
      <div className={styles.inlineDivider} />

      {/* 1. Mode Segmented Control */}
      <div className={styles.inlineGroup}>
        <span className={styles.inlineLabel}>Mode</span>
        <div
          className={styles.segmentedControl}
          role="radiogroup"
          aria-label="Mode"
        >
          <button
            type="button"
            className={`${styles.segmentButton} ${
              options.executionMode === "Async" ? styles.segmentActive : ""
            }`}
            onClick={() => setOption("executionMode", "Async")}
            role="radio"
            aria-checked={options.executionMode === "Async"}
          >
            Async
          </button>
          <button
            type="button"
            className={`${styles.segmentButton} ${
              options.executionMode === "Sync" ? styles.segmentActive : ""
            }`}
            onClick={() => setOption("executionMode", "Sync")}
            role="radio"
            aria-checked={options.executionMode === "Sync"}
          >
            Sync
          </button>
        </div>
      </div>

      {/* 2. Correlation ID Field with UUID Generator */}
      <div className={styles.inlineGroup}>
        <span className={styles.inlineLabel}>Correlation ID</span>
        <div className={styles.inputWithQuickAction}>
          <input
            type="text"
            className={styles.deckInput}
            placeholder="Optional correlation ID"
            value={options.correlationId || ""}
            onChange={(e) => setOption("correlationId", e.target.value)}
            aria-label="Correlation ID"
          />
          <button
            type="button"
            className={styles.quickActionBtn}
            onClick={handleGenerateUUID}
            title="Generate random UUID"
            aria-label="Generate UUID"
          >
            <Sparkles size={11} />
            <span>UUID</span>
          </button>
        </div>
      </div>

      {/* 3. Controls depending on Execution Mode (Wait & Breakpoint only in Sync mode; Polling only in Async) */}
      {isSync ? (
        <>
          {/* Wait Seconds (Sync mode waitForSeconds) */}
          <div className={styles.inlineGroup}>
            <span className={styles.inlineLabel}>Wait</span>
            <div className={styles.inputWithSuffix}>
              <input
                type="number"
                min={0}
                className={`${styles.deckInput} ${styles.numberInput}`}
                placeholder={`${workflowTimeout}`}
                value={options.waitSeconds ?? workflowTimeout}
                onChange={(e) => {
                  const val =
                    e.target.value === ""
                      ? undefined
                      : Math.max(0, parseInt(e.target.value, 10) || 0);
                  setOption("waitSeconds", val);
                }}
                aria-label="Wait Seconds"
              />
              <span className={styles.suffix}>s</span>
            </div>
          </div>

          {/* Pause At Breakpoint */}
          <div className={styles.inlineGroup}>
            <span className={styles.inlineLabel}>Pause At Breakpoint</span>
            {hasTasks ? (
              <select
                className={`${styles.deckInput} ${styles.deckSelect}`}
                value={options.pauseAtTaskReferenceName || ""}
                onChange={(e) =>
                  setOption("pauseAtTaskReferenceName", e.target.value)
                }
                aria-label="Pause At Breakpoint"
              >
                {taskOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className={styles.deckInput}
                placeholder="Task reference name"
                value={options.pauseAtTaskReferenceName || ""}
                onChange={(e) =>
                  setOption("pauseAtTaskReferenceName", e.target.value)
                }
                aria-label="Pause At Breakpoint"
              />
            )}
          </div>
        </>
      ) : (
        /* Polling Interval (Async mode) */
        <div className={styles.inlineGroup}>
          <span className={styles.inlineLabel}>Polling</span>
          <div
            className={styles.pillsGroup}
            role="group"
            aria-label="Polling interval"
          >
            {refreshIntervals.map((interval) => (
              <button
                key={interval}
                type="button"
                className={`${styles.pillButton} ${
                  (options.refreshEvery || "2s") === interval
                    ? styles.pillActive
                    : ""
                }`}
                onClick={() => setOption("refreshEvery", interval)}
              >
                {interval}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Right-Aligned Utilities: Reset & Done */}
      <div className={styles.rightActionsGroup}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleResetDefaults}
          title="Reset options to defaults"
          aria-label="Reset Defaults"
        >
          <RotateCcw size={11} />
          <span>Reset Defaults</span>
        </button>

        <button
          type="button"
          className={styles.doneButton}
          onClick={onClose}
          aria-label="Done"
          title="Collapse execution options (Esc)"
        >
          Done
        </button>
      </div>
    </div>
  );
};
