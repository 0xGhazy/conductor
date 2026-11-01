import React from "react";
import Popover from "@mui/material/Popover";
import { ExecutionOptionsDeck } from "./ExecutionOptionsDeck";
import styles from "./ExecutionOptionsPopover.module.css";

export interface ExecutionOptionsPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export const ExecutionOptionsPopover: React.FC<ExecutionOptionsPopoverProps> = ({
  open,
  anchorEl,
  onClose,
}) => {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
      slotProps={{
        paper: {
          className: styles.popoverPaper,
          sx: {
            mt: 1,
            backgroundColor: "transparent",
            backgroundImage: "none",
            boxShadow: "none",
          },
        },
      }}
    >
      <ExecutionOptionsDeck onClose={onClose} />
    </Popover>
  );
};
