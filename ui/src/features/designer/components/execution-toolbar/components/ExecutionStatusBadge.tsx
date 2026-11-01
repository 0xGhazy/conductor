import React from "react";
import { Play, Pause, Square, CircleDot } from "lucide-react";
import type { ExecutionStatusBadgeProps } from "../types";
import styles from "../WorkflowExecutionToolbar.module.css";

export const ExecutionStatusBadge: React.FC<ExecutionStatusBadgeProps> = ({ status }) => {
  const getBadgeContent = () => {
    switch (status) {
      case "running":
        return {
          label: "Running",
          className: styles.statusRunning,
          icon: <CircleDot size={14} className={styles.pulseIcon} />,
        };
      case "paused":
        return {
          label: "Paused",
          className: styles.statusPaused,
          icon: <Pause size={14} />,
        };
      case "terminated":
        return {
          label: "Terminated",
          className: styles.statusTerminated,
          icon: <Square size={13} fill="currentColor" />,
        };
      case "idle":
      default:
        return {
          label: "Ready",
          className: styles.statusIdle,
          icon: <Play size={13} />,
        };
    }
  };

  const { label, className, icon } = getBadgeContent();

  return (
    <div className={`${styles.statusBadge} ${className}`} role="status" aria-live="polite">
      <span className={styles.statusDot}>{icon}</span>
      <span className={styles.statusText}>{label}</span>
    </div>
  );
};
