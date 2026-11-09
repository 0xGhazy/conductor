import React, { isValidElement } from "react";
import { User, Globe, Layers } from "lucide-react";
import type {
  WeaverCanvasConfig,
  WeaverCanvasItemContext,
  WeaverDataAction,
  WeaverDataField,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import { formatDisplayValue } from "./dataExplorerUtils";
import { DataActionsMenu } from "./DataActionsMenu";
import styles from "./DataCanvasCard.module.css";

export function WorkflowTreeGraphic({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M28 32H35V23H38 M35 32V41H38"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="14" y="24" width="14" height="15" rx="3.5" fill="#ffffff" />
      <rect x="38" y="15" width="14" height="15" rx="3.5" fill="#ffffff" />
      <rect x="38" y="33" width="14" height="15" rx="3.5" fill="#ffffff" />
    </svg>
  );
}

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

  // If a full custom item renderer is provided via props or canvas config, use it
  const customItemRenderer = canvas?.renderItem || renderCanvasItem;
  if (customItemRenderer) {
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
        {customItemRenderer(record, context)}
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

  // Selection controls
  const showCheckbox = selectionMode === "multiple";
  const showRadio = selectionMode === "single";
  const hasSelectionControl = showCheckbox || showRadio;

  // Row actions menu
  const showRowActions = canvas?.hideRowActions !== true;
  const visibleRowActions = showRowActions
    ? (rowActions || []).filter((action) => {
        if (typeof action.hidden === "function") {
          return !action.hidden(record);
        }
        return !action.hidden;
      })
    : [];
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

  // -------------------------------------------------------------
  // Centered SaaS Layout (Workflow Canvas & Reference Design)
  // -------------------------------------------------------------
  if (canvas?.layout === "centered") {
    // Version badge resolution
    const versionText = (() => {
      if (typeof resolvedStatus === "string" || typeof resolvedStatus === "number") {
        const str = String(resolvedStatus).trim();
        return str.startsWith("v") ? str : `v${str}`;
      }
      if (isValidElement(resolvedStatus)) {
        return resolvedStatus;
      }
      const rawVersion = (record as any)?.version;
      if (rawVersion !== undefined && rawVersion !== null && String(rawVersion).trim() !== "") {
        return `v${rawVersion}`;
      }
      return null;
    })();

    // Description resolution
    const descriptionText = (() => {
      if (canvas.getDescription) {
        const val = canvas.getDescription(record);
        return typeof val === "string" ? val.trim() : val;
      }
      const desc = (record as any)?.description;
      return typeof desc === "string" ? desc.trim() : null;
    })();

    // Created By resolution
    const createdByText = (() => {
      if (canvas.getCreatedBy) {
        const val = canvas.getCreatedBy(record);
        return typeof val === "string" ? val : val || "-";
      }
      const raw = (record as any)?.createdBy;
      if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
      if (raw && typeof raw === "object" && raw.name) return raw.name;
      const email = (record as any)?.ownerEmail;
      if (typeof email === "string" && email.trim() !== "") return email.trim();
      return "-";
    })();

    // Language resolution
    const languageText = (() => {
      if (canvas.getLanguage) {
        const val = canvas.getLanguage(record);
        return typeof val === "string" ? val.toUpperCase() : val || "EN";
      }
      const lang = (record as any)?.language || (record as any)?.defaultLanguage;
      return typeof lang === "string" && lang.trim() !== "" ? lang.trim().toUpperCase() : "EN";
    })();

    const showCreatedBy = Boolean(canvas.getCreatedBy);
    const showLanguage = Boolean(canvas.getLanguage);
    const hasFooter = showCreatedBy || showLanguage;

    return (
      <div
        data-testid={`canvas-card-${id}`}
        data-selected={isSelected}
        onClick={handleCardClick}
        className={`${styles.cardRoot} ${styles.cardRootCentered} ${
          isSelected ? styles.cardSelected : ""
        } ${onRecordClick || selectionMode !== "none" ? styles.cardClickable : ""}`}
      >
        {/* Decorative Mint Wave in Top-Right Corner */}
        <svg
          className={styles.decorativeWave}
          viewBox="0 0 170 110"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M170 0V85C150 95 125 90 108 72C90 50 98 22 55 12C36 8 18 10 0 0H170Z"
            fill="url(#mintWaveGrad)"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="mintWaveGrad" x1="170" y1="0" x2="30" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a7f3d0" stopOpacity="0.8" />
              <stop offset="0.6" stopColor="#6ee7b7" stopOpacity="0.3" />
              <stop offset="1" stopColor="#ccfbf1" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>

        {/* 1. Top Utility Bar: Selection on Left, Row Actions on Right */}
        {showTopControls && (
          <div className={styles.topUtilityBarCentered}>
            {hasSelectionControl && (
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
                    name="canvas-radio-selection"
                    className={styles.selectionInput}
                    checked={isSelected}
                    onChange={() => onToggleSelect()}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select record ${typeof resolvedTitle === "string" ? resolvedTitle : id}`}
                  />
                )}
              </div>
            )}

            {hasRowActions && (
              <div
                className={styles.actionsMenuWrapperCentered}
                onClick={(e) => e.stopPropagation()}
              >
                <DataActionsMenu
                  actions={rowActions}
                  context={{ record, selectedIds }}
                  ariaLabel={`Actions for ${typeof resolvedTitle === "string" ? resolvedTitle : id}`}
                />
              </div>
            )}
          </div>
        )}

        {/* 2. Centered Identity & Body */}
        <div className={styles.centeredBody}>
          {/* Top Center: Circular Container with Overlapping Version Badge */}
          <div className={styles.centeredIconWrapper}>
            <div
              data-testid="canvas-card-icon"
              className={styles.centeredIconCircle}
              style={
                iconColor
                  ? {
                      backgroundColor: iconColor,
                    }
                  : undefined
              }
            >
              {rawIcon || <Layers size={38} color="#ffffff" strokeWidth={2.2} />}
            </div>

            {versionText && (
              <span
                data-testid="canvas-card-version"
                className={styles.versionPillBadge}
                title={typeof versionText === "string" ? versionText : undefined}
              >
                {versionText}
              </span>
            )}
          </div>

          {/* Centered Workflow Title */}
          <h4
            className={styles.centeredTitle}
            title={typeof resolvedTitle === "string" ? resolvedTitle : undefined}
          >
            {resolvedTitle}
          </h4>

          {/* Centered Description (2-3 lines truncated) or Custom Content */}
          {hasCustomContent ? (
            <div className={styles.centeredContentCustom}>{resolvedContent}</div>
          ) : (
            <p
              className={`${styles.centeredDescription} ${
                !descriptionText ? styles.centeredDescriptionEmpty : ""
              }`}
              title={typeof descriptionText === "string" ? descriptionText : undefined}
            >
              {descriptionText || "No description provided."}
            </p>
          )}
        </div>

        {/* 3. Thin Horizontal Divider & Structured Footer (when configured) */}
        {hasFooter && (
          <>
            <div className={styles.centeredDivider} />
            <div className={styles.centeredFooter}>
              {showCreatedBy && (
                <div className={styles.footerSection}>
                  <div className={styles.footerIconBox}>
                    <User size={19} color="#475569" strokeWidth={1.8} />
                  </div>
                  <div className={styles.footerTextStack}>
                    <span className={styles.footerLabel}>Created by</span>
                    <span
                      className={styles.footerAuthorText}
                      title={typeof createdByText === "string" ? createdByText : undefined}
                    >
                      {createdByText}
                    </span>
                  </div>
                </div>
              )}

              {showCreatedBy && showLanguage && (
                <div className={styles.footerVerticalDivider} />
              )}

              {showLanguage && (
                <div className={styles.footerSectionRight}>
                  <div className={styles.footerIconBox}>
                    <Globe size={19} color="#475569" strokeWidth={1.8} />
                  </div>
                  <div className={styles.footerTextStack}>
                    <span className={styles.footerLabel}>Language</span>
                    <span className={styles.languagePill}>{languageText}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* 4. Action Section at the Bottom */}
        {hasQuickActions && (
          <>
            <div className={styles.centeredDivider} />
            <div
              className={styles.centeredActionsBar}
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
          </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // Default Layout (General Purpose / Backward Compatibility)
  // -------------------------------------------------------------

  // Filter out primary title, status if rendered as badge, and action columns
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
