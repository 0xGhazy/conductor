import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import { WeaverButton } from "@/components/common/buttons";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useShallow } from "zustand/react/shallow";

const ReplaceConfirmDialogBase: React.FC = () => {
  const {
    replaceConfirmOpen,
    replaceConfirmContext,
    pendingReplaceAction,
    setReplaceConfirmOpen,
    setPendingReplaceAction,
  } = useDesignerStore(
    useShallow((state) => ({
      replaceConfirmOpen: state.replaceConfirmOpen,
      replaceConfirmContext: state.replaceConfirmContext,
      pendingReplaceAction: state.pendingReplaceAction,
      setReplaceConfirmOpen: state.setReplaceConfirmOpen,
      setPendingReplaceAction: state.setPendingReplaceAction,
    }))
  );

  const handleClose = () => {
    setReplaceConfirmOpen(false);
    setPendingReplaceAction(null);
  };

  const handleConfirm = () => {
    const action = pendingReplaceAction;
    handleClose();
    action?.();
  };

  return (
    <Dialog
      open={replaceConfirmOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {replaceConfirmContext === "open" ? "Open Workflow" : "Import Workflow"}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will replace the current workflow on the canvas. Unsaved changes will be lost.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <WeaverButton variant="outlined" color="inherit" onClick={handleClose}>
          Cancel
        </WeaverButton>
        <WeaverButton variant="contained" color="primary" onClick={handleConfirm}>
          Continue
        </WeaverButton>
      </DialogActions>
    </Dialog>
  );
};

export const ReplaceConfirmDialog = React.memo(ReplaceConfirmDialogBase);
ReplaceConfirmDialog.displayName = "ReplaceConfirmDialog";
