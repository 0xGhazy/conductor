import React from "react";
import Tooltip from "@mui/material/Tooltip";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import styles from "./WorkflowSaveStatus.module.css";

export const WorkflowSaveStatus: React.FC = () => {
  const workflowStatus = useDesignerStore((s) => s.workflowStatus);

  let statusKey: "saved" | "unsaved" | "saving" | "failed" = "saved";
  let label = "Saved";
  let tooltip = "All changes are saved";
  let icon: React.ReactNode = <Check size={13} strokeWidth={2.5} />;

  if (workflowStatus === "SAVING") {
    statusKey = "saving";
    label = "Saving...";
    tooltip = "An existing manual save is in progress";
    icon = <Loader2 size={13} className={styles.spinIcon} />;
  } else if (workflowStatus === "FAILED") {
    statusKey = "failed";
    label = "Save Failed";
    tooltip = "The save operation failed. Local changes are retained.";
    icon = <AlertCircle size={13} strokeWidth={2} />;
  } else if (
    workflowStatus === "UNSAVED" ||
    workflowStatus === "MODIFIED" ||
    workflowStatus === "DRAFT"
  ) {
    statusKey = "unsaved";
    label = "Unsaved";
    tooltip = "Local changes exist";
    icon = <span className={styles.dot} />;
  }

  return (
    <Tooltip title={tooltip} arrow>
      <div
        className={`${styles.container} ${styles[statusKey]}`}
        role="status"
        aria-label={`Workflow Save Status: ${label}`}
        data-testid="workflow-save-status"
      >
        {icon}
        <span>{label}</span>
      </div>
    </Tooltip>
  );
};
