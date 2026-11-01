import { memo, type MouseEvent } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";
import Tooltip from "@mui/material/Tooltip";
import type { StartNodeData } from "@/features/designer/components/actions/start/model/startDto";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";
import "@/features/designer/components/actions/start/StartNode.css";

export interface StartNodeProps {
  data?: StartNodeData;
  onStartDoubleClick?: () => void;
  onPlusClick?: () => void;
}

function StartNodeBase({ onStartDoubleClick, onPlusClick }: StartNodeProps) {
  const setActionsPanelOpen = useDesignerStore((state) => state.setActionsPanelOpen);
  const pendingConnectionSource = useDesignerStore((state) => state.pendingConnectionSource);
  const setPendingConnectionSource = useDesignerStore((state) => state.setPendingConnectionSource);
  const clearSelection = useDesignerStore((state) => state.clearSelection);

  const isPending = pendingConnectionSource === START_NODE_ID;

  const layoutDirection = useDesignerStore((state) => state.layoutDirection) ?? "TB";
  const isLR = layoutDirection === "LR";

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (typeof onStartDoubleClick === "function") {
      onStartDoubleClick();
    }
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    // Start is not selectable; a click only clears the selection (double-click opens its configuration).
    clearSelection();
  };

  const handlePlusClick = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (isPending) {
      setPendingConnectionSource(null);
    } else {
      setPendingConnectionSource(START_NODE_ID);
      setActionsPanelOpen(true);
      if (typeof onPlusClick === "function") {
        onPlusClick();
      }
    }
  };

  return (
    <div
      className="start-node-wrapper nodrag"
      style={{ pointerEvents: "all" }}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      aria-label="Start Node"
      title="Start"
    >
      <div className="start-node-circle">
        <span className="start-node-title">Start</span>
      </div>

      <Tooltip
        title={isPending ? "Click to cancel node connection" : "Add next node"}
        arrow
        placement={isLR ? "right" : "bottom"}
      >
        <Handle
          type="source"
          id="workflow-entry-point"
          position={isLR ? Position.Right : Position.Bottom}
          className={`start-node-handle-plus ${isLR ? "handle-right" : ""} ${isPending ? "start-node-handle-plus-active" : ""}`}
          onClick={handlePlusClick}
          aria-label="Add next node"
        >
          <Plus size={13} strokeWidth={2.8} className="start-node-plus-icon" />
        </Handle>
      </Tooltip>
    </div>
  );
}

export const StartNode = memo(StartNodeBase);
StartNode.displayName = "StartNode";
