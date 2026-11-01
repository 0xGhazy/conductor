import React from "react";
import type {
  WeaverCanvasConfig,
  WeaverCanvasItemContext,
  WeaverDataAction,
  WeaverDataField,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import { DataCanvasCard } from "./DataCanvasCard";
import styles from "./DataCanvasView.module.css";

export interface DataCanvasViewProps<TRecord> {
  records: TRecord[];
  getRecordId: (record: TRecord) => string | number;
  visibleFields: WeaverDataField<TRecord>[];
  allFields?: WeaverDataField<TRecord>[];
  selectionMode?: "none" | "single" | "multiple";
  selectedIds: Array<string | number>;
  onToggleSelectRecord: (id: string | number) => void;
  rowActions?: WeaverDataAction<TRecord>[];
  loading?: boolean;

  // Structured Canvas Config & Direct Props
  canvas?: WeaverCanvasConfig<TRecord>;
  renderCanvasIcon?: (record: TRecord) => React.ReactNode;
  renderCanvasStatus?: (record: TRecord) => React.ReactNode;
  getCanvasTitle?: (record: TRecord) => React.ReactNode;
  renderCanvasContent?: (record: TRecord) => React.ReactNode;
  canvasQuickActions?: WeaverDataAction<TRecord>[];
  renderCanvasQuickActions?: (record: TRecord) => React.ReactNode;

  // Custom Full Card Item Renderer Override (if custom shell needed)
  renderCanvasItem?: (
    record: TRecord,
    context: WeaverCanvasItemContext<TRecord>
  ) => React.ReactNode;

  // Record Click
  onRecordClick?: (record: TRecord) => void;
}

export function DataCanvasView<TRecord>({
  records,
  getRecordId,
  visibleFields,
  allFields,
  selectionMode = "multiple",
  selectedIds,
  onToggleSelectRecord,
  rowActions,
  loading = false,
  canvas,
  renderCanvasIcon,
  renderCanvasStatus,
  getCanvasTitle,
  renderCanvasContent,
  canvasQuickActions,
  renderCanvasQuickActions,
  renderCanvasItem,
  onRecordClick,
}: DataCanvasViewProps<TRecord>) {
  if (loading) {
    return (
      <div className={styles.canvasGrid} aria-label="Loading records" aria-busy="true">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className={styles.skeletonCard}>
            {/* Top utility skeleton: selection and action */}
            <div className={styles.skeletonHeader}>
              <div className={styles.skeletonCheckbox} />
              <div className={styles.skeletonAction} />
            </div>

            {/* Identity row skeleton: icon and title */}
            <div className={styles.skeletonIdentity}>
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonTitleGroup}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonTag} />
              </div>
            </div>

            {/* Metric properties skeleton */}
            <div className={styles.skeletonMetrics}>
              <div className={styles.skeletonMetricRow}>
                <div className={styles.skeletonMetricLabel} />
                <div className={styles.skeletonMetricValue} />
              </div>
              <div className={styles.skeletonMetricRow}>
                <div className={styles.skeletonMetricLabel} />
                <div className={styles.skeletonMetricValue} />
              </div>
              <div className={styles.skeletonMetricRow}>
                <div className={styles.skeletonMetricLabel} />
                <div className={styles.skeletonMetricValue} />
              </div>
            </div>

            {/* Footer skeleton */}
            <div className={styles.skeletonFooter}>
              <div className={styles.skeletonButton} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.canvasGrid} role="grid" aria-label="Card canvas view">
      {records.map((record) => {
        const id = getRecordId(record);
        const isSelected = selectedIds.includes(id);

        return (
          <DataCanvasCard
            key={id}
            record={record}
            getRecordId={getRecordId}
            visibleFields={visibleFields}
            allFields={allFields}
            selectionMode={selectionMode}
            isSelected={isSelected}
            onToggleSelect={() => onToggleSelectRecord(id)}
            rowActions={rowActions}
            selectedIds={selectedIds}
            onRecordClick={onRecordClick}
            canvas={canvas}
            renderCanvasIcon={renderCanvasIcon}
            renderCanvasStatus={renderCanvasStatus}
            getCanvasTitle={getCanvasTitle}
            renderCanvasContent={renderCanvasContent}
            canvasQuickActions={canvasQuickActions}
            renderCanvasQuickActions={renderCanvasQuickActions}
            renderCanvasItem={renderCanvasItem}
          />
        );
      })}
    </div>
  );
}

export default DataCanvasView;
