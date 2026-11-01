import React from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export const DiffBranchEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const diffStatus = (data as any)?.diffStatus || "unchanged";

  let stroke = "var(--color-border-strong, #64748B)";
  let strokeDasharray: string | undefined = undefined;
  let strokeWidth = 2;

  if (diffStatus === "added") {
    stroke = "var(--color-status-success, #15803D)";
    strokeWidth = 2.5;
  } else if (diffStatus === "removed") {
    stroke = "var(--color-status-danger, #C81E2D)";
    strokeDasharray = "5, 4";
    strokeWidth = 2;
  }

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke,
    strokeWidth,
    strokeDasharray,
    transition: "stroke 0.2s ease, stroke-width 0.2s ease",
  };

  return <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />;
};
