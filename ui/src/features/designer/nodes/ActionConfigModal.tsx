import React, { useState, useMemo, type ReactNode } from "react";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Modal from "@mui/material/Modal";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { WeaverButton } from "@/components/common/buttons";
import { WeaverCodeEditor, toWeaverSuggestions } from "@/components/common/editors";
import { modalStyle } from "@/utils/modalStyle";
import { useWeaverNotification } from "@/components/common/notifications";

export interface CustomTabDefinition {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface ActionConfigModalProps {
  open: boolean;
  title: string;
  nodeDisplayName?: string;
  initialData?: any;
  draftData?: any;
  isDirty?: boolean;
  modalWidth?: number;
  className?: string;
  onClose: () => void;
  onSave: () => void;
  onCancel?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  // Execution Run Action
  onRun?: () => void;
  runDisabled?: boolean;
  runLoading?: boolean;
  // Tabs & Content
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  customTabs?: CustomTabDefinition[];
  customTabContent?: Record<string, ReactNode>;
  // JSON Editor
  jsonRepresentation?: any;
  onJsonChange?: (jsonStr: string) => void;
  jsonReadOnly?: boolean;
  parameterOptions?: Array<string | { value?: string; label?: string; id?: string }>;
  // Children (Form for configurations tab)
  children?: ReactNode;
}

export const ActionConfigModal: React.FC<ActionConfigModalProps> = ({
  open,
  title,
  nodeDisplayName,
  initialData,
  draftData,
  isDirty,
  modalWidth = 950,
  className = "",
  onClose,
  onSave,
  onCancel,
  saveDisabled = false,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  onRun,
  runDisabled = false,
  runLoading = false,
  activeTab: controlledActiveTab,
  onTabChange,
  customTabs = [],
  customTabContent = {},
  jsonRepresentation,
  onJsonChange,
  jsonReadOnly = false,
  parameterOptions = [],
  children,
}) => {
  const { warning: showWarning } = useWeaverNotification();
  const [internalActiveTab, setInternalActiveTab] = useState<string>("configurations");

  const currentTab = controlledActiveTab ?? internalActiveTab;
  const setTab = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    if (typeof isDirty === "boolean") return isDirty;
    if (!draftData) return false;
    try {
      return JSON.stringify(draftData) !== JSON.stringify(initialData ?? {});
    } catch {
      return true;
    }
  }, [isDirty, draftData, initialData]);

  const handleModalClose = (_event: {}, _reason?: string) => {
    if (hasUnsavedChanges) {
      showWarning(
        `${nodeDisplayName || title} has unsaved changes. Please click Save first.`
      );
      return;
    }
    onClose();
  };

  const handleCancelClick = (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  // Only stringify while the JSON tab is the active one (callers pass null while closed).
  const jsonValue = useMemo(() => {
    if (currentTab !== "json") return "{}";
    if (typeof jsonRepresentation === "string") return jsonRepresentation;
    if (jsonRepresentation !== undefined && jsonRepresentation !== null) {
      try {
        return JSON.stringify(jsonRepresentation, null, 2);
      } catch {
        return "{}";
      }
    }
    return "{}";
  }, [currentTab, jsonRepresentation]);

  return (
    <Modal
      aria-labelledby="action-config-modal-title"
      open={open}
      onClose={handleModalClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 500 } }}
    >
      <Fade in={open}>
        <Box
          sx={{
            ...modalStyle,
            width: modalWidth,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--color-canvas-subtle, #ffffff)",
            color: "var(--color-fg-default, #111827)",
          }}
          className={`designer-modal node-config-modal ${className}`.trim()}
          onClick={(e) => e.stopPropagation()}
        >
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            sx={{ mb: 2, position: "relative" }}
          >
            <Typography
              id="action-config-modal-title"
              variant="h6"
              component="h2"
              sx={{ textAlign: "center", fontWeight: 600 }}
            >
              {title}
            </Typography>

            {onRun && (
              <IconButton
                onClick={onRun}
                disabled={runDisabled || runLoading}
                aria-label="run"
                title="Run"
                size="medium"
                sx={{
                  position: "absolute",
                  right: 0,
                  color: "primary.main",
                  "&:hover": { backgroundColor: "action.hover" },
                }}
              >
                {runLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              </IconButton>
            )}
          </Stack>

          <Tabs
            value={currentTab}
            onChange={(_, next) => setTab(next)}
            className="node-config-tabs"
            sx={{ mb: 2, borderBottom: "1px solid var(--color-border-default, #e5e7eb)" }}
          >
            <Tab
              icon={<TuneIcon fontSize="small" />}
              iconPosition="start"
              label="Metadata"
              value="configurations"
            />
            <Tab
              icon={<DataObjectIcon fontSize="small" />}
              iconPosition="start"
              label="JSON"
              value="json"
            />
            {customTabs.map((tab) => (
              <Tab
                key={tab.id}
                icon={tab.icon as any}
                iconPosition="start"
                label={tab.label}
                value={tab.id}
              />
            ))}
          </Tabs>

          <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0, pr: 0.5 }}>
            {currentTab === "configurations" && children}

            {currentTab === "json" && (
              <WeaverCodeEditor
                className="action-config-json-editor"
                language="json"
                value={jsonValue}
                onChange={onJsonChange || (() => {})}
                suggestions={toWeaverSuggestions(parameterOptions)}
                height="55vh"
                options={{
                  readOnly: jsonReadOnly || !onJsonChange,
                  lineNumbers: "on",
                  renderLineHighlight: "all",
                }}
              />
            )}

            {customTabs.some((t) => t.id === currentTab) &&
              customTabContent[currentTab]}
          </Box>

          <div
            className="node-config-footer"
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              borderTop: "1px solid var(--color-border-default, #e5e7eb)",
              paddingTop: 12,
            }}
          >
            <WeaverButton variant="outlined" color="inherit" onClick={handleCancelClick}>
              {cancelLabel}
            </WeaverButton>
            <WeaverButton variant="contained" color="primary" onClick={onSave} disabled={saveDisabled}>
              {saveLabel}
            </WeaverButton>
          </div>
        </Box>
      </Fade>
    </Modal>
  );
};

export default ActionConfigModal;
