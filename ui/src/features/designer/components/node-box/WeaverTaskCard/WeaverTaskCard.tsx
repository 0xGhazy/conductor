import React, { type DragEvent, memo } from "react";
import Tooltip from "@mui/material/Tooltip";
import type { WeaverTaskCardProps } from "./WeaverTaskCard.types";
import styles from "./WeaverTaskCard.module.css";

const DRAG_TYPE = "application/x-node-type";

export const WeaverTaskCard: React.FC<WeaverTaskCardProps> = memo(
  function WeaverTaskCard({
    type,
    name,
    shortName,
    icon,
    description,
    disabled = false,
    onAdd,
    onDisabledClick,
    className = "",
  }) {
    const displayName = shortName || name;
    const tooltipTitle = disabled
      ? `${description || name} (Coming soon)`
      : description || name;

    const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData(DRAG_TYPE, type);
      event.dataTransfer.effectAllowed = "move";
    };

    const handleClick = () => {
      if (disabled) {
        onDisabledClick?.({ type, name });
        return;
      }
      onAdd?.(type);
    };

    return (
      <Tooltip
        title={tooltipTitle}
        arrow
        placement="top"
        enterDelay={300}
        leaveDelay={100}
      >
        <span className={styles.cardWrapper}>
          <button
            type="button"
            draggable={!disabled}
            onDragStart={handleDragStart}
            onClick={handleClick}
            aria-disabled={disabled}
            aria-label={name}
            className={`${styles.card} ${disabled ? styles.disabled : ""} ${className}`}
            data-node-type={type}
          >
            <span className={styles.iconWrap} aria-hidden="true">
              {icon}
            </span>
            <span className={styles.label}>{displayName}</span>
            {description ? (
              <span className={styles.srOnly}>{description}</span>
            ) : null}
          </button>
        </span>
      </Tooltip>
    );
  }
);
