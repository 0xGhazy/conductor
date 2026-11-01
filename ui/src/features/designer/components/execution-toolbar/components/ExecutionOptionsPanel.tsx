import React, { useMemo } from "react";
import {
  WeaverTextField,
  WeaverSelectField,
  WeaverNumberField,
  type WeaverSelectOption,
} from "@/components/common/fields";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import {
  DEFAULT_START_TIMEOUT_SECONDS,
  isStartNode,
} from "@/features/designer/utils/designerGraphUtils";
import type { ExecutionOptionsPanelProps } from "../types";
import styles from "./ExecutionOptionsPanel.module.css";

export const ExecutionOptionsPanel: React.FC<ExecutionOptionsPanelProps> = ({
  options,
  onChangeOption,
}) => {
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

  const taskOptions = useMemo<WeaverSelectOption<string>[]>(() => {
    const list: WeaverSelectOption<string>[] = [
      { label: "None (Do not pause)", value: "" },
    ];
    nodes.forEach((node) => {
      // Exclude start node
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

  const executionModeOptions: WeaverSelectOption<string>[] = [
    { label: "Async", value: "Async" },
    { label: "Sync", value: "Sync" },
  ];

  const refreshEveryOptions: WeaverSelectOption<string>[] = [
    { label: "1s", value: "1s" },
    { label: "2s", value: "2s" },
    { label: "5s", value: "5s" },
    { label: "10s", value: "10s" },
  ];

  const isSync = options.executionMode === "Sync";

  return (
    <div
      className={styles.panelContainer}
      role="region"
      aria-label="Execution Options"
    >
      <div className={styles.fieldsGrid}>
        {/* Correlation ID */}
        <div className={styles.fieldItem}>
          <WeaverTextField
            label="Correlation ID"
            placeholder="Enter correlation ID"
            value={options.correlationId || ""}
            onChange={(val) => onChangeOption("correlationId", val)}
            size="small"
            fullWidth
          />
        </div>

        {/* Execution Mode */}
        <div className={styles.fieldItem}>
          <WeaverSelectField<string>
            label="Execution Mode"
            value={options.executionMode || "Async"}
            options={executionModeOptions}
            onChange={(val) =>
              onChangeOption(
                "executionMode",
                (val as "Async" | "Sync") || "Async"
              )
            }
            size="small"
            fullWidth
          />
        </div>

        {/* Only show wait seconds, pause at task, refresh every, and show logs in Async mode */}
        {!isSync && (
          <>
            {/* Wait Seconds - defaults to workflow timeout */}
            <div className={styles.fieldItem}>
              <WeaverNumberField
                label="Wait Seconds"
                placeholder="Enter wait time in seconds"
                value={options.waitSeconds ?? workflowTimeout}
                onChange={(val) =>
                  onChangeOption(
                    "waitSeconds",
                    val === null || val === undefined
                      ? undefined
                      : Math.max(0, val)
                  )
                }
                min={0}
                allowNegative={false}
                allowDecimal={false}
                size="small"
                fullWidth
              />
            </div>

            {/* Pause At Task Reference Name (without placeholder text) */}
            <div className={styles.fieldItem}>
              {hasTasks ? (
                <WeaverSelectField<string>
                  label="Pause At Task"
                  value={options.pauseAtTaskReferenceName || ""}
                  options={taskOptions}
                  onChange={(val) =>
                    onChangeOption(
                      "pauseAtTaskReferenceName",
                      (val as string) || ""
                    )
                  }
                  size="small"
                  fullWidth
                />
              ) : (
                <WeaverTextField
                  label="Pause At Task"
                  value={options.pauseAtTaskReferenceName || ""}
                  onChange={(val) =>
                    onChangeOption("pauseAtTaskReferenceName", val)
                  }
                  size="small"
                  fullWidth
                />
              )}
            </div>

            {/* Refresh Every */}
            <div className={styles.fieldItem}>
              <WeaverSelectField<string>
                label="Refresh Every"
                value={options.refreshEvery || "2s"}
                options={refreshEveryOptions}
                onChange={(val) =>
                  onChangeOption("refreshEvery", (val as string) || "2s")
                }
                size="small"
                fullWidth
              />
            </div>

            {/* Show Logs Toggle */}
            <div className={styles.fieldItem}>
              <div className={styles.toggleContainer}>
                <label
                  htmlFor="weaver-execution-show-logs-switch"
                  className={styles.toggleLabelWrap}
                >
                  <span className={styles.toggleLabel}>Show Logs</span>
                  <span className={styles.toggleHint}>
                    Add Logs tab to node configuration
                  </span>
                </label>
                <label className={styles.switchRoot}>
                  <input
                    id="weaver-execution-show-logs-switch"
                    type="checkbox"
                    className={styles.switchInput}
                    checked={Boolean(options.showLogs)}
                    onChange={(e) => onChangeOption("showLogs", e.target.checked)}
                    aria-label="Toggle Show Logs"
                  />
                  <span className={styles.switchSlider} />
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
