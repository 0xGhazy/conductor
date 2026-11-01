import React, { useCallback } from "react";
import Modal from "@mui/material/Modal";
import Backdrop from "@mui/material/Backdrop";
import Fade from "@mui/material/Fade";
import Box from "@mui/material/Box";
import { Plus, X } from "lucide-react";
import { WeaverTaskPanel } from "../WeaverTaskPanel";
import type { WeaverTaskPanelModalProps } from "./WeaverTaskPanelModal.types";
import styles from "./WeaverTaskPanelModal.module.css";

export const WeaverTaskPanelModal: React.FC<WeaverTaskPanelModalProps> = ({
  open,
  onClose,
  onAddNode,
  items,
}) => {
  const handleSelectNode = useCallback(
    (type: string) => {
      onAddNode?.(type);
      onClose();
    },
    [onAddNode, onClose]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 220,
          sx: {
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
          },
        },
      }}
      aria-labelledby="weaver-task-panel-modal-title"
    >
      <Fade in={open}>
        <Box className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div className={styles.headerTitleGroup}>
              <Plus size={16} className={styles.headerIcon} />
              <h2 id="weaver-task-panel-modal-title" className={styles.headerTitle}>
                Add Task
              </h2>
            </div>

            <div className={styles.headerActions}>
              <kbd className={styles.escKey}>Esc</kbd>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close task panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className={styles.modalBody}>
            <WeaverTaskPanel
              items={items}
              onAddNode={handleSelectNode}
            />
          </div>
        </Box>
      </Fade>
    </Modal>
  );
};
