import React, { memo, useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import "./WeaverBranchEdge.css";

export interface WeaverBranchEdgeData {
  branchIndex?: number;
  totalBranches?: number;
  centerX?: number;
  centerY?: number;
  labelColor?: string;
  note?: string;
  [key: string]: any;
}

export const WeaverBranchEdge: React.FC<EdgeProps> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data = {},
  selected = false,
  interactionWidth = 24,
}) => {
  const edgeData = (data || {}) as WeaverBranchEdgeData;
  const branchIndex = edgeData.branchIndex;
  const totalBranches = edgeData.totalBranches ?? 1;
  const labelColor = edgeData.labelColor;

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
      hoverTimeoutRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const isVisible = isHovered || Boolean(selected);

  const isLR =
    sourcePosition === "right" ||
    targetPosition === "left" ||
    (sourcePosition !== "bottom" && Math.abs(targetX - sourceX) > Math.abs(targetY - sourceY));

  const { edgePath, labelX, labelY } = useMemo(() => {
    let centerX: number | undefined;
    let centerY: number | undefined;

    if (isLR) {
      const deltaX = targetX - sourceX;
      if (typeof edgeData.centerX === "number") {
        centerX = edgeData.centerX;
      } else if (typeof branchIndex === "number" && deltaX > 40) {
        const baseOffset = 28;
        const stepOffset = 18;
        const rawCenterX = sourceX + baseOffset + branchIndex * stepOffset;
        const maxCenterX = targetX - 45;
        if (rawCenterX <= maxCenterX) {
          centerX = Math.round(rawCenterX);
        } else {
          const availableSpace = Math.max(10, deltaX - 60);
          const step = availableSpace / Math.max(1, totalBranches);
          centerX = Math.round(sourceX + 25 + branchIndex * step);
        }
      }
    } else {
      const deltaY = targetY - sourceY;
      if (typeof edgeData.centerY === "number") {
        centerY = edgeData.centerY;
      } else if (typeof branchIndex === "number" && deltaY > 40) {
        const baseOffset = 28;
        const stepOffset = 18;
        const rawCenterY = sourceY + baseOffset + branchIndex * stepOffset;
        const maxCenterY = targetY - 45;
        if (rawCenterY <= maxCenterY) {
          centerY = Math.round(rawCenterY);
        } else {
          const availableSpace = Math.max(10, deltaY - 60);
          const step = availableSpace / Math.max(1, totalBranches);
          centerY = Math.round(sourceY + 25 + branchIndex * step);
        }
      }
    }

    const [computedPath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
      centerX: isLR ? centerX : undefined,
      centerY: !isLR ? centerY : undefined,
    });

    let lx: number;
    let ly: number;

    if (isLR) {
      const effectiveCenterX = centerX ?? Math.round((sourceX + targetX) / 2);
      if (Math.abs(targetY - sourceY) < 8) {
        lx = Math.round((sourceX + targetX) / 2);
        ly = targetY;
      } else {
        lx = Math.round((effectiveCenterX + targetX) / 2);
        ly = targetY;
      }
    } else {
      const effectiveCenterY = centerY ?? Math.round((sourceY + targetY) / 2);
      if (Math.abs(targetX - sourceX) < 8) {
        lx = targetX;
        ly = Math.round((sourceY + targetY) / 2);
      } else {
        const distanceToTarget = targetY - effectiveCenterY;
        if (distanceToTarget >= 44) {
          ly = Math.round(targetY - 26);
        } else {
          ly = Math.round(effectiveCenterY + distanceToTarget / 2);
        }
        lx = targetX;
      }
    }

    return { edgePath: computedPath, labelX: lx, labelY: ly };
  }, [
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    edgeData.centerX,
    edgeData.centerY,
    branchIndex,
    totalBranches,
    isLR,
  ]);

  const wrapperStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      pointerEvents: isVisible ? "all" : "none",
      opacity: isVisible ? 1 : 0,
      transition: "opacity 0.15s ease",
      zIndex: 10,
    }),
    [labelX, labelY, isVisible]
  );

  const innerStyle = useMemo<React.CSSProperties>(
    () => ({
      borderColor: labelColor || "#94a3b8",
      color: labelColor || "var(--color-fg-default, #1f2937)",
    }),
    [labelColor]
  );

  const isGhost = Boolean(edgeData.isGhost || id?.startsWith("ghost-edge-"));

  if (isGhost) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: "#94a3b8",
          strokeDasharray: "5 5",
          strokeOpacity: 0.65,
          strokeWidth: 2,
          pointerEvents: "none",
          ...style,
        }}
        interactionWidth={0}
      />
    );
  }

  return (
    <>
      <g
        className="weaver-branch-edge-group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={style}
          interactionWidth={interactionWidth}
        />
        {/* Invisible interaction path with hit area for hovering the edge line */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeOpacity={0}
          strokeWidth={interactionWidth}
          className="react-flow__edge-interaction"
          style={{ cursor: "pointer", pointerEvents: "stroke" }}
        />
      </g>
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="weaver-branch-edge-label-wrapper"
            style={wrapperStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="weaver-branch-edge-label" style={innerStyle}>
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

WeaverBranchEdge.displayName = "WeaverBranchEdge";
export default WeaverBranchEdge;


