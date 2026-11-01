import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import "@/features/designer/components/actions/end/EndNode.css";

export interface EndNodeProps {
  id?: string;
  data?: {
    name?: string;
    [key: string]: unknown;
  };
}

export const EndNode = memo(({ id }: EndNodeProps) => {
  const layoutDirection = useDesignerStore((state) => state.layoutDirection) ?? "TB";
  const isLR = layoutDirection === "LR";

  return (
    <div
      className="end-node-wrapper nodrag"
      style={{ pointerEvents: "all" }}
      aria-label="End Node"
      title="End"
    >
      <Handle
        type="target"
        id="end-entry-point"
        position={isLR ? Position.Left : Position.Top}
        className={`end-node-handle-target ${isLR ? "handle-left" : ""}`}
        aria-label="Workflow end point"
      />

      <div className="end-node-circle">
        <span className="end-node-title">End</span>
      </div>
    </div>
  );
});

EndNode.displayName = "EndNode";
