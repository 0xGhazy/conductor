import React from "react";
import type {
  WeaverCanvasConfig,
  WeaverCanvasItemContext,
  WeaverDataAction,
  WeaverDataField,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import { formatDisplayValue } from "./dataExplorerUtils";
import { DataActionsMenu } from "./DataActionsMenu";
import styles from "./DataCanvasCard.module.css";

export interface DataCanvasCardProps<TRecord> {
  record: TRecord;
  getRecordId: (record: TRecord) => string | number;
  visibleFields: WeaverDataField<TRecord>[];
  allFields?: WeaverDataField<TRecord>[];
  selectionMode?: "none" | "single" | "multiple";
  isSelected: boolean;
  onToggleSelect: () => void;
  rowActions?: WeaverDataAction<TRecord>[];
  selectedIds?: Array<string | number>;
  onRecordClick?: (record: TRecord) => void;

  // Canvas Config & Direct Props
  canvas?: WeaverCanvasConfig<TRecord>;
  renderCanvasIcon?: (record: TRecord) => React.ReactNode;
  renderCanvasStatus?: (record: TRecord) => React.ReactNode;
  getCanvasTitle?: (record: TRecord) => React.ReactNode;
  renderCanvasContent?: (
    record: TRecord,
    context?: { visibleFields: WeaverDataField<TRecord>[]; visibleFieldKeys: string[] }
  ) => React.ReactNode;
  canvasQuickActions?: WeaverDataAction<TRecord>[];
  renderCanvasQuickActions?: (record: TRecord) => React.ReactNode;

  // Custom Full Card Item Renderer (if provided)
  renderCanvasItem?: (
    record: TRecord,
    context: WeaverCanvasItemContext<TRecord>
  ) => React.ReactNode;
}

export function DataCanvasCard<TRecord>({
  record,
  getRecordId,
  visibleFields,
  allFields,
  selectionMode = "multiple",
  isSelected,
  onToggleSelect,
  rowActions,
  selectedIds = [],
  onRecordClick,
  canvas,
  renderCanvasIcon,
  renderCanvasStatus,
  getCanvasTitle,
  renderCanvasContent,
  canvasQuickActions,
  renderCanvasQuickActions,
  renderCanvasItem,
}: DataCanvasCardProps<TRecord>) {
  const id = getRecordId(record);

  // If a full custom item renderer is provided, use it
  if (renderCanvasItem) {
    const context: WeaverCanvasItemContext<TRecord> = {
      isSelected,
      onToggleSelect,
      visibleFields,
      rowActions,
      quickActions: canvas?.quickActions || canvasQuickActions,
    };
    return (
      <div
        data-testid={`canvas-card-${id}`}
        data-selected={isSelected}
        className={styles.customCardWrapper}
      >
        {renderCanvasItem(record, context)}
      </div>
    );
  }

  // Resolving Title
  const titleResolver = canvas?.getTitle || getCanvasTitle;
  const primaryField =
    visibleFields.find(
      (f) =>
        f.key.toLowerCase() === "name" ||
        f.key.toLowerCase() === "title" ||
        f.label.toLowerCase() === "name" ||
        f.label.toLowerCase() === "title"
    ) ||
    visibleFields.find((f) => f.key.toLowerCase() !== "id") ||
    visibleFields[0];

  const defaultTitle = primaryField
    ? formatDisplayValue(primaryField.getValue(record))
    : String(id);
  const resolvedTitle = titleResolver ? titleResolver(record) : defaultTitle;

  // Resolving Icon & Optional Fill Color
  const iconRenderer = canvas?.renderIcon || renderCanvasIcon;
  const rawIcon = iconRenderer ? iconRenderer(record) : null;
  const hasIcon = Boolean(rawIcon);
  const iconColor =
    (canvas?.getIconColor ? canvas.getIconColor(record) : canvas?.iconColor) ||
    null;

  // Resolving Status
  const statusRenderer = canvas?.renderStatus || renderCanvasStatus;
  const statusFieldExists = (allFields || visibleFields).some(
    (f) => f.key.toLowerCase() === "status"
  );
  const isStatusFieldVisible = visibleFields.some(
    (f) => f.key.toLowerCase() === "status"
  );
  const isStatusHiddenByManager = statusFieldExists && !isStatusFieldVisible;

  const resolvedStatus =
    statusRenderer && !isStatusHiddenByManager
      ? statusRenderer(record)
      : null;
  const hasStatus = Boolean(resolvedStatus);

  // Resolving Content / Details
  const contentRenderer = canvas?.renderContent || renderCanvasContent;
  const hasCustomContent = Boolean(contentRenderer);
  const resolvedContent = contentRenderer
    ? contentRenderer(record, {
        visibleFields,
        visibleFieldKeys: visibleFields.map((f) => f.key),
      })
    : null;

  // Resolving Quick Actions
  const quickActions = canvas?.quickActions || canvasQuickActions;
  const quickActionsRenderer =
    canvas?.renderQuickActions || renderCanvasQuickActions;
  const hasQuickActions = Boolean(
    (quickActions && quickActions.length > 0) || quickActionsRenderer
  );

  // Filter out the primary title field from default details list, status if rendered as badge, and action columns
  const detailFields = visibleFields.filter((f) => {
    if (f === primaryField) return false;
    const lowerKey = f.key.toLowerCase();
    if (lowerKey === "name" || lowerKey === "title") return false;
    if (hasStatus && lowerKey === "status") return false;
    if (
      lowerKey === "actions" ||
      lowerKey === "quickactions" ||
      lowerKey === "quickping" ||
      lowerKey === "rowactions"
    ) {
      return false;
    }
    return true;
  });

  // Selection controls
  const showCheckbox = selectionMode === "multiple";
  const showRadio = selectionMode === "single";
  const hasSelectionControl = showCheckbox || showRadio;

  // Row actions menu
  const visibleRowActions = (rowActions || []).filter((action) => {
    if (typeof action.hidden === "function") {
      return !action.hidden(record);
    }
    return !action.hidden;
  });
  const hasRowActions = visibleRowActions.length > 0;

  const showTopControls = hasSelectionControl || hasRowActions;

  // Handle Card Click (Drill-down navigation)
  const handleCardClick = () => {
    if (onRecordClick) {
      onRecordClick(record);
    } else if (selectionMode !== "none") {
      onToggleSelect();
    }
  };

  return (
    <div
      data-testid={`canvas-card-${id}`}
      data-selected={isSelected}
      onClick={handleCardClick}
      className={`${styles.cardRoot} ${isSelected ? styles.cardSelected : ""} ${
        onRecordClick || selectionMode !== "none" ? styles.cardClickable : ""
      }`}
    >
      {/* 1. Top Utility Row: Selection on Left, Row Actions on Right */}
      {showTopControls && (
        <div className={styles.topUtilityBar}>
          <div className={styles.selectionWrapper}>
            {showCheckbox && (
              <input
                type="checkbox"
                className={styles.selectionInput}
                checked={isSelected}
                onChange={() => onToggleSelect()}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select record ${typeof resolvedTitle === "string" ? resolvedTitle : id}`}
              />
            )}
            {showRadio && (
              <input
                type="radio"
                name={`canvas-radio-selection`}
                className={styles.selectionInput}
                checked={isSelected}
                onChange={() => onToggleSelect()}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select record ${typeof resolvedTitle === "string" ? resolvedTitle : id}`}
              />
            )}
          </div>

          {hasRowActions && (
            <div className={styles.actionsMenuWrapper} onClick={(e) => e.stopPropagation()}>
              <DataActionsMenu
                actions={rowActions}
                context={{ record, selectedIds }}
                ariaLabel={`Actions for ${typeof resolvedTitle === "string" ? resolvedTitle : id}`}
              />
            </div>
          )}
        </div>
      )}

      {/* 2. Identity Row: Icon Badge, Title, and Status Pill */}
      <div className={styles.cardIdentity}>
        {hasIcon && (
          <div
            data-testid="canvas-card-icon"
            className={styles.iconContainer}
            style={
              iconColor
                ? {
                    backgroundColor: iconColor,
                    color: "#ffffff",
                  }
                : undefined
            }
          >
            {rawIcon}
          </div>
        )}

        <div className={styles.identityText}>
          <h4
            className={styles.cardTitle}
            title={typeof resolvedTitle === "string" ? resolvedTitle : undefined}
          >
            {resolvedTitle}
          </h4>

          {hasStatus && (
            <div data-testid="canvas-card-status" className={styles.statusWrapper}>
              {resolvedStatus}
            </div>
          )}
        </div>
      </div>

      {/* 3. Properties & Details Area */}
      <div className={styles.propertiesList}>
        {hasCustomContent ? (
          resolvedContent
        ) : detailFields.length > 0 ? (
          detailFields.map((field) => {
            const rawVal = field.getValue(record);
            const renderedVal = field.render
              ? field.render(rawVal, record)
              : formatDisplayValue(rawVal);

            return (
              <div key={field.key} className={styles.propertyRow}>
                <span className={styles.propertyLabel} title={field.label}>
                  {field.label}:
                </span>
                <span
                  className={styles.propertyValue}
                  title={
                    typeof rawVal === "string" || typeof rawVal === "number"
                      ? String(rawVal)
                      : undefined
                  }
                >
                  {renderedVal}
                </span>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyProperties}>No fields visible</div>
        )}
      </div>

      {/* 4. Pinned Quick-Actions Footer */}
      {hasQuickActions && (
        <div
          className={styles.quickActionsFooter}
          onClick={(e) => e.stopPropagation()}
        >
          {quickActionsRenderer ? (
            quickActionsRenderer(record)
          ) : quickActions && quickActions.length > 0 ? (
            quickActions.map((action) => {
              const isDisabled =
                typeof action.disabled === "function"
                  ? action.disabled(record)
                  : Boolean(action.disabled);
              const isHidden =
                typeof action.hidden === "function"
                  ? action.hidden(record)
                  : Boolean(action.hidden);

              if (isHidden) return null;

              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={isDisabled}
                  className={`${styles.quickActionButton} ${
                    action.danger ? styles.quickActionDanger : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick({ record, selectedIds });
                  }}
                >
                  {action.icon && <span>{action.icon}</span>}
                  <span>{action.label}</span>
                </button>
              );
            })
          ) : null}
        </div>
      )}
    </div>
  );
}

export default DataCanvasCard;
