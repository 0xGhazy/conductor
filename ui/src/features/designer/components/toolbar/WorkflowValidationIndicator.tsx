import React from "react";
import Tooltip from "@mui/material/Tooltip";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWorkflowValidation } from "@/features/designer/validation/useWorkflowValidation";
import styles from "./WorkflowValidationIndicator.module.css";

export const WorkflowValidationIndicator: React.FC = () => {
  const { summary } = useWorkflowValidation();
  const toggleValidationPanel = useDesignerStore((s) => s.toggleValidationPanel);
  const validationPanelOpen = useDesignerStore((s) => s.validationPanelOpen);

  const { errors, warnings } = summary;

  let stateClass = styles.valid;
  let label = "Valid";
  let tooltipText = "Workflow is valid. Click to open Validation Panel.";
  let icon = <CheckCircle2 size={16} />;

  if (errors > 0) {
    stateClass = styles.hasErrors;
    label = `${errors} Error${errors > 1 ? "s" : ""}`;
    tooltipText = `${errors} blocking error${errors > 1 ? "s" : ""} found. Click to view.`;
    icon = <AlertCircle size={16} />;
  } else if (warnings > 0) {
    stateClass = styles.hasWarnings;
    label = `${warnings} Warning${warnings > 1 ? "s" : ""}`;
    tooltipText = `${warnings} warning${warnings > 1 ? "s" : ""} found. Click to view.`;
    icon = <AlertTriangle size={16} />;
  }

  return (
    <Tooltip title={tooltipText} arrow>
      <button
        type="button"
        className={`${styles.indicatorButton} ${stateClass}`}
        onClick={toggleValidationPanel}
        aria-label={`Workflow Validation: ${label}`}
        aria-expanded={validationPanelOpen}
        data-testid="workflow-validation-indicator"
      >
        {icon}
        <span>{label}</span>
      </button>
    </Tooltip>
  );
};
