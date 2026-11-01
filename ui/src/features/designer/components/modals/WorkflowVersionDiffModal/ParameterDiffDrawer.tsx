import React from "react";
import { X, ArrowRight, Check, AlertCircle, Plus, Minus } from "lucide-react";
import styles from "./WorkflowVersionDiffModal.module.css";
import {
  formatDiffValue,
  type ParameterDiffItem,
  type DiffStatus,
} from "@/features/designer/utils/workflowDiffUtils";

export interface ParameterDiffDrawerProps {
  selectedNode: {
    id: string;
    taskReferenceName: string;
    title: string;
    nodeType: string;
    status: DiffStatus;
    parameterDiffs: ParameterDiffItem[];
    baseConfig?: Record<string, any>;
    targetConfig?: Record<string, any>;
  } | null;
  baseVersion: number | string;
  targetVersion: number | string;
  onClose: () => void;
}

export const ParameterDiffDrawer: React.FC<ParameterDiffDrawerProps> = ({
  selectedNode,
  baseVersion,
  targetVersion,
  onClose,
}) => {
  if (!selectedNode) return null;

  const {
    taskReferenceName,
    title,
    nodeType,
    status,
    parameterDiffs,
    baseConfig = {},
    targetConfig = {},
  } = selectedNode;

  return (
    <aside className={styles.parameterDrawer} aria-label="Parameter Diff Drawer">
      {/* Drawer Header */}
      <div className={styles.drawerHeader}>
        <div className={styles.drawerHeaderInfo}>
          <div className={styles.drawerTitleGroup}>
            <span className={styles.drawerTitle}>{title || taskReferenceName}</span>
            <span className={styles.drawerTypeTag}>{nodeType}</span>
          </div>
          <div className={styles.drawerSubtitle}>
            Ref: <code>{taskReferenceName}</code>
          </div>
        </div>

        <div className={styles.drawerHeaderActions}>
          <div
            className={`${styles.drawerStatusBadge} ${
              status === "added"
                ? styles.badgeAdded
                : status === "removed"
                ? styles.badgeRemoved
                : status === "modified"
                ? styles.badgeModified
                : styles.badgeUnchanged
            }`}
          >
            {status === "added" && <Plus size={13} style={{ marginRight: 4 }} />}
            {status === "removed" && <Minus size={13} style={{ marginRight: 4 }} />}
            {status === "modified" && <AlertCircle size={13} style={{ marginRight: 4 }} />}
            {status === "unchanged" && <Check size={13} style={{ marginRight: 4 }} />}
            {status === "added" && "Added"}
            {status === "removed" && "Removed"}
            {status === "modified" && `Modified (${parameterDiffs.length})`}
            {status === "unchanged" && "Unchanged"}
          </div>

          <button
            type="button"
            className={styles.drawerCloseBtn}
            onClick={onClose}
            aria-label="Close Parameter Inspector"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className={styles.drawerBody}>
        {status === "modified" && (
          <div className={styles.diffTableSection}>
            <div className={styles.diffTableHeader}>
              <div className={styles.colParam}>Parameter</div>
              <div className={styles.colBase}>Version {baseVersion} (Old)</div>
              <div className={styles.colDivider} />
              <div className={styles.colTarget}>Version {targetVersion} (New)</div>
            </div>

            <div className={styles.diffTableRows}>
              {parameterDiffs.map((diff) => {
                const isObj =
                  typeof diff.oldValue === "object" || typeof diff.newValue === "object";

                return (
                  <div key={diff.path} className={styles.diffTableRow}>
                    <div className={styles.colParam}>
                      <span className={styles.paramPath} title={diff.path}>
                        {diff.path}
                      </span>
                    </div>

                    <div className={`${styles.colBase} ${styles.cellRemoved}`}>
                      <pre className={styles.valuePreview}>
                        {formatDiffValue(diff.oldValue)}
                      </pre>
                    </div>

                    <div className={styles.colDivider}>
                      <ArrowRight size={14} className={styles.arrowIcon} />
                    </div>

                    <div className={`${styles.colTarget} ${styles.cellAdded}`}>
                      <pre className={styles.valuePreview}>
                        {formatDiffValue(diff.newValue)}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {status === "added" && (
          <div className={styles.singleConfigSection}>
            <div className={styles.statusDescription}>
              This task was newly added in Version {targetVersion}. Below is its configured state:
            </div>
            <pre className={styles.fullConfigBlock}>
              {JSON.stringify(targetConfig, null, 2)}
            </pre>
          </div>
        )}

        {status === "removed" && (
          <div className={styles.singleConfigSection}>
            <div className={styles.statusDescription}>
              This task existed in Version {baseVersion} and was removed in Version {targetVersion}.
            </div>
            <pre className={styles.fullConfigBlock}>
              {JSON.stringify(baseConfig, null, 2)}
            </pre>
          </div>
        )}

        {status === "unchanged" && (
          <div className={styles.singleConfigSection}>
            <div className={styles.statusDescription}>
              This task has identical configuration across Version {baseVersion} and Version{" "}
              {targetVersion}.
            </div>
            <pre className={styles.fullConfigBlock}>
              {JSON.stringify(targetConfig || baseConfig, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
};
