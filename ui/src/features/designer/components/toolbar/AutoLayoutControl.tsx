import React from "react";
import Tooltip from "@mui/material/Tooltip";
import { ArrowDownUp, ArrowRight, ArrowDown } from "lucide-react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { deriveVisibleScopeGraph } from "@/features/designer/services/scopeGraph";
import {
  calculateAutoLayout,
  type LayoutDirection,
  getStoredLayoutDirection,
  setStoredLayoutDirection,
} from "@/features/designer/utils/autoLayout";
import { useWeaverNotification } from "@/components/common/notifications";
import styles from "./AutoLayoutControl.module.css";

export const AutoLayoutControl: React.FC = () => {
  const layoutDirection = useDesignerStore((state) => state.layoutDirection) ?? "TB";
  const setLayoutDirection = useDesignerStore((state) => state.setLayoutDirection);

  const { success: showSuccess } = useWeaverNotification();

  const arrangeWithDirection = (direction: LayoutDirection) => {
    const { nodes, edges, focusedScopeId, setNodes, flowInstance } = useDesignerStore.getState();
    const visibleGraph = deriveVisibleScopeGraph(nodes, edges, focusedScopeId);
    if (!visibleGraph.nodes || visibleGraph.nodes.length === 0) {
      return;
    }

    const { nodes: layoutedVisibleNodes } = calculateAutoLayout(
      visibleGraph.nodes,
      visibleGraph.edges,
      { direction }
    );

    const positionMap = new Map(
      layoutedVisibleNodes.map((n) => [n.id, n.position])
    );

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const newPos = positionMap.get(node.id);
        return newPos
          ? {
              ...node,
              position: newPos,
              sourcePosition: direction === "LR" ? "right" : "bottom",
              targetPosition: direction === "LR" ? "left" : "top",
            }
          : node;
      })
    );

    window.requestAnimationFrame(() => {
      flowInstance?.fitView?.({ duration: 450, padding: 0.1, minZoom: 0.2, maxZoom: 1.2 });
    });

    const dirLabel = direction === "LR" ? "Left to Right" : "Top to Bottom";
    showSuccess(`Workflow auto-arranged (${dirLabel})`);
  };

  const handleAutoArrange = () => {
    const currentStoredDir = getStoredLayoutDirection() || layoutDirection || "TB";
    arrangeWithDirection(currentStoredDir);
  };

  const handleDirectionChange = (newDir: LayoutDirection) => {
    setStoredLayoutDirection(newDir);
    setLayoutDirection(newDir);
    arrangeWithDirection(newDir);
  };

  return (
    <div className={styles.container}>
      <Tooltip
        title={`Auto Arrange (${layoutDirection === "LR" ? "Left to Right" : "Top to Bottom"}) (Shift+Alt+F)`}
        arrow
        placement="bottom"
      >
        <button
          type="button"
          className={styles.mainButton}
          onClick={handleAutoArrange}
          aria-label={`Auto Arrange (${layoutDirection === "LR" ? "Left to Right" : "Top to Bottom"})`}
        >
          <span className={styles.buttonIcon}>
            {layoutDirection === "LR" ? <ArrowRight size={15} /> : <ArrowDownUp size={15} />}
          </span>
          <span>Auto Arrange</span>
        </button>
      </Tooltip>

      <div className={styles.divider} />

      <div className={styles.directionToggle} role="group" aria-label="Layout Direction">
        <Tooltip title="Layout: Top to Bottom (TB)" arrow placement="bottom">
          <button
            type="button"
            className={`${styles.directionButton} ${layoutDirection === "TB" ? styles.directionButtonActive : ""}`}
            onClick={() => handleDirectionChange("TB")}
            aria-pressed={layoutDirection === "TB"}
            aria-label="Top to Bottom Layout"
          >
            <ArrowDown size={12} className={styles.dirIcon} />
            <span>TB</span>
          </button>
        </Tooltip>
        <Tooltip title="Layout: Left to Right (LR)" arrow placement="bottom">
          <button
            type="button"
            className={`${styles.directionButton} ${layoutDirection === "LR" ? styles.directionButtonActive : ""}`}
            onClick={() => handleDirectionChange("LR")}
            aria-label="Left to Right Layout"
            aria-pressed={layoutDirection === "LR"}
          >
            <ArrowRight size={12} className={styles.dirIcon} />
            <span>LR</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

