import React, { memo } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import type { WeaverNotification as WeaverNotificationModel } from "../notification.types";
import styles from "./WeaverNotification.module.css";

export interface WeaverNotificationProps {
  notification: WeaverNotificationModel;
  onDismiss: (id: string) => void;
  onMouseEnter?: (id: string) => void;
  onMouseLeave?: (id: string) => void;
  showProgress?: boolean;
}

export const WeaverNotification: React.FC<WeaverNotificationProps> = memo(function WeaverNotification({
  notification,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
  showProgress = false,
}) {
  const {
    id,
    severity,
    title,
    message,
    dismissible = true,
    action,
    duration,
  } = notification;

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (action?.onClick) {
      action.onClick();
    }
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss(id);
  };

  const handleMouseEnter = () => {
    onMouseEnter?.(id);
  };

  const handleMouseLeave = () => {
    onMouseLeave?.(id);
  };

  // Accessibility semantics
  const isAssertive = severity === "error";
  const role = isAssertive ? "alert" : "status";
  const ariaLive = isAssertive ? "assertive" : "polite";

  return (
    <div
      className={`${styles.notificationCard} ${styles[`severity-${severity}`]}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={role}
      aria-live={ariaLive}
      data-testid={`weaver-notification-${id}`}
      data-severity={severity}
    >
      <Alert
        severity={severity}
        className={styles.alertRoot}
        action={
          dismissible ? (
            <IconButton
              size="small"
              aria-label="Dismiss notification"
              className={styles.closeButton}
              onClick={handleDismissClick}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          ) : undefined
        }
      >
        <div className={styles.contentWrapper}>
          {title && <AlertTitle className={styles.title}>{title}</AlertTitle>}
          <div className={styles.message}>{message}</div>

          {action && (
            <div className={styles.actionRow}>
              <Button
                size="small"
                variant={severity === "error" ? "outlined" : "contained"}
                color={severity === "error" ? "error" : "primary"}
                className={styles.actionButton}
                onClick={handleActionClick}
              >
                {action.label}
              </Button>
            </div>
          )}
        </div>
      </Alert>

      {/* Optional progress indicator if enabled and not persistent */}
      {showProgress && duration && duration > 0 && (
        <div
          className={`${styles.progressBar} ${styles[`progressBar-${severity}`]}`}
          style={{ width: "100%" }}
        />
      )}
    </div>
  );
});

export default WeaverNotification;
