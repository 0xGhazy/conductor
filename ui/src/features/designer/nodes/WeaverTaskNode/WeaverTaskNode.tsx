import React, {
  isValidElement,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Plus } from "lucide-react";
import { HoldProgress } from "@/components/common/buttons/WeaverButton";
import { DELETE_HOLD_DURATION_MS } from "@/features/designer/hooks/useDesignerKeyboardShortcuts";
import { useWeaverNotification } from "@/components/common/notifications";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import { parsePendingConnection } from "@/features/designer/utils/designerGraphUtils";
import { SelectionTrace } from "@/features/designer/nodes/SelectionTrace";
import type {
  WeaverTaskNodeIconProps,
  WeaverTaskNodeProps,
} from "@/features/designer/nodes/WeaverTaskNode/WeaverTaskNode.types";
import "@/features/designer/nodes/WeaverTaskNode/WeaverTaskNode.css";

interface ContextMenuPosition {
  mouseX: number;
  mouseY: number;
}

const isIconComponent = (
  icon: WeaverTaskNodeProps["icon"]
): icon is ElementType<WeaverTaskNodeIconProps> =>
  typeof icon === "function" ||
  (typeof icon === "object" && icon !== null && !isValidElement(icon) && "$$typeof" in icon);

const renderIcon = (icon: WeaverTaskNodeProps["icon"]): ReactNode => {
  if (isIconComponent(icon)) {
    const Icon = icon;
    return <Icon size={14} className="action-node-icon" />;
  }
  return icon as ReactNode;
};

/**
 * Shared canvas node used by every workflow task. Renders the modern framed architectural card
 * (domain stripe, icon badge, title, reference pill, subtitle), the input handle, the (+) output
 * handle that opens the task panel, and the right-click menu (copy reference / custom items / delete).
 */
const WeaverTaskNodeBase: React.FC<WeaverTaskNodeProps> = ({
  id,
  title,
  taskReferenceName = "",
  subtitle,
  description,
  icon,
  color,
  status,
  durationMs,
  errorMessage,
  renderStatusBadge,
  className = "",
  style,
  wrapperClassName = "",
  wrapperStyle,
  readOnly = false,
  selected,
  onDoubleClick,
  onContextMenu,
  contextMenuItems = [],
  hideTargetHandle = false,
  targetHandleId,
  targetHandlePosition,
  targetHandleStyle,
  hideSourceHandle = false,
  sourceHandleId,
  sourceHandlePosition,
  sourceHandleStyle,
  customHandles,
  children,
}) => {
  const { deleteElements } = useReactFlow();
  const { success: showSuccess, error: showError } = useWeaverNotification();
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);

  const executionTaskStatus = useWorkflowExecutionStore((state) =>
    taskReferenceName ? state.taskStatusMap[taskReferenceName] : undefined
  );
  const effectiveStatus = status || executionTaskStatus?.status;
  const effectiveDuration = durationMs ?? executionTaskStatus?.durationMs;
  const effectiveErrorMessage = errorMessage || executionTaskStatus?.errorMessage;

  const layoutDirection = useDesignerStore((state) => state.layoutDirection) ?? "TB";
  const isLR = layoutDirection === "LR";
  const effectiveTargetHandlePosition =
    targetHandlePosition ?? (isLR ? Position.Left : Position.Top);
  const effectiveSourceHandlePosition =
    sourceHandlePosition ?? (isLR ? Position.Right : Position.Bottom);
  const isSourceRight = effectiveSourceHandlePosition === Position.Right;

  const pendingConnectionSource = useDesignerStore((state) => state.pendingConnectionSource);
  const setPendingConnectionSource = useDesignerStore((state) => state.setPendingConnectionSource);
  const setActionsPanelOpen = useDesignerStore((state) => state.setActionsPanelOpen);
  const isHoldDeleting = useDesignerStore((state) => state.holdDeleteNodeId === id);
  // Selection comes from the designer store only (single source of truth).
  const isStoreSelected = useDesignerStore((state) => state.selectedNodeIds.includes(id));
  const isSelected = selected ?? (readOnly ? false : isStoreSelected);
  const cardRef = useRef<HTMLDivElement>(null);

  const parsedPending = parsePendingConnection(pendingConnectionSource);
  const isPending =
    parsedPending?.nodeId === id &&
    (!parsedPending.handleId || parsedPending.handleId === sourceHandleId);

  const handlePlusClick = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (isPending) {
      setPendingConnectionSource(null);
    } else {
      setPendingConnectionSource(sourceHandleId ? `${id}::${sourceHandleId}` : id);
      setActionsPanelOpen(true);
    }
  };

  const handleContextMenuOpen = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(event);
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleCopyReference = async () => {
    const value = taskReferenceName || (typeof title === "string" ? title : id);
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(`Copied reference: ${value}`);
    } catch {
      showError("Failed to copy reference.");
    } finally {
      handleContextMenuClose();
    }
  };

  const handleDeleteNode = async () => {
    try {
      await deleteElements({ nodes: [{ id }] });
    } finally {
      handleContextMenuClose();
    }
  };

  const resolvedWrapperStyle = {
    pointerEvents: "all",
    ...(color ? { "--action-node-color": color } : null),
    ...wrapperStyle,
  } as CSSProperties;

  return (
    <>
      <div
        className={`action-node-shell relative ${isSelected ? "action-node-selected" : ""} ${wrapperClassName}`.trim()}
        style={resolvedWrapperStyle}
        onDoubleClick={onDoubleClick}
        onContextMenu={readOnly ? undefined : handleContextMenuOpen}
      >
        {!hideTargetHandle && (
          <Handle
            type="target"
            id={targetHandleId}
            position={effectiveTargetHandlePosition}
            style={{ opacity: 0, pointerEvents: "auto", ...targetHandleStyle }}
          />
        )}

        <Tooltip
          title={description || ""}
          arrow
          placement="top"
          enterDelay={300}
          leaveDelay={100}
          disableHoverListener={!description}
        >
          <div className="action-node-card-frame">
            <div
              ref={cardRef}
              className={`action-node-card ${isSelected ? "action-node-card--selected" : ""} ${
                isHoldDeleting ? "action-node-card--hold-deleting" : ""
              } ${effectiveStatus ? `action-node-card--status-${effectiveStatus.toLowerCase()}` : ""} ${className}`.trim()}
              style={style}
            >
              <span className="action-node-delete-hold" aria-hidden="true">
                <HoldProgress active={isHoldDeleting} duration={DELETE_HOLD_DURATION_MS} showBar={false} />
              </span>

              {/* Header: Icon, Title, and Telemetry Badge */}
              <div className="action-node-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", flex: 1 }}>
                  <div className="action-node-icon-wrap">{renderIcon(icon)}</div>
                  <span className="action-node-title">{title}</span>
                </div>

                {renderStatusBadge ? (
                  renderStatusBadge(effectiveStatus || "")
                ) : effectiveStatus ? (
                  <div className={`action-node-status-badge action-node-status--${effectiveStatus.toLowerCase()}`}>
                    <span className="action-node-status-dot" />
                    <span>{effectiveStatus}</span>
                    {effectiveDuration !== undefined && (
                      <span style={{ opacity: 0.8, marginLeft: 2 }}>
                        ({effectiveDuration < 1000 ? `${effectiveDuration}ms` : `${(effectiveDuration / 1000).toFixed(1)}s`})
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Content: Task Reference Tag, Subtitle, and Optional Error Message */}
              {taskReferenceName || subtitle || effectiveErrorMessage ? (
                <div style={{ padding: "4px 12px 10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {taskReferenceName ? (
                    <span className="action-node-reference" title={taskReferenceName}>
                      {taskReferenceName}
                    </span>
                  ) : null}
                  {subtitle ? (
                    <span className="action-node-secondary" title={typeof subtitle === "string" ? subtitle : undefined}>
                      {subtitle}
                    </span>
                  ) : null}
                  {effectiveErrorMessage && (
                    <span
                      style={{
                        color: "var(--color-status-danger)",
                        fontSize: 10,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={effectiveErrorMessage}
                    >
                      {effectiveErrorMessage}
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            <SelectionTrace active={isSelected && !isHoldDeleting} targetRef={cardRef} />
          </div>
        </Tooltip>

        {children}

        {customHandles ? (
          customHandles
        ) : !hideSourceHandle && !readOnly ? (
          <div className="relative pb-2">
            <Tooltip
              title={isPending ? "Click to cancel node connection" : "Add next node"}
              arrow
              placement={isSourceRight ? "right" : "bottom"}
            >
              <Handle
                type="source"
                id={sourceHandleId}
                position={effectiveSourceHandlePosition}
                className={`action-node-handle-plus ${isSourceRight ? "handle-right" : ""} ${
                  isPending ? "action-node-handle-plus-active" : ""
                }`}
                onClick={handlePlusClick}
                aria-label="Add next node"
                style={sourceHandleStyle}
              >
                <Plus size={12} strokeWidth={2.8} className="action-node-plus-icon" />
              </Handle>
            </Tooltip>
          </div>
        ) : (
          <Handle
            type="source"
            position={effectiveSourceHandlePosition}
            style={{ opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
          />
        )}
      </div>

      <Menu
        open={!readOnly && Boolean(contextMenu)}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleCopyReference}>
          <ContentCopyIcon fontSize="small" style={{ marginRight: 8 }} />
          Copy Reference
        </MenuItem>
        {contextMenuItems.map((item, idx) => (
          <MenuItem
            key={idx}
            onClick={() => {
              handleContextMenuClose();
              item.onClick();
            }}
          >
            {item.icon ? (
              <span style={{ display: "inline-flex", marginRight: 8 }}>{item.icon}</span>
            ) : null}
            {item.label}
          </MenuItem>
        ))}
        <MenuItem onClick={handleDeleteNode} sx={{ color: "error.main" }}>
          <DeleteOutlineIcon fontSize="small" style={{ marginRight: 8 }} />
          Delete
        </MenuItem>
      </Menu>
    </>
  );
};

export const WeaverTaskNode = React.memo(WeaverTaskNodeBase);
WeaverTaskNode.displayName = "WeaverTaskNode";

export default WeaverTaskNode;
