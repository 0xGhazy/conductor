import React from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { ArrowLeft, Moon, Sun, Workflow, Undo2, Redo2, GitCompare } from "lucide-react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useShallow } from "zustand/react/shallow";
import { WorkflowSaveStatus } from "./WorkflowSaveStatus";
import { WorkflowValidationIndicator } from "./WorkflowValidationIndicator";

interface DesignerHeaderProps {
  onWorkflowVersionChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const DesignerHeaderBase: React.FC<DesignerHeaderProps> = ({
  onWorkflowVersionChange,
}) => {
  const navigate = useNavigate();
  const {
    workflowName,
    workflowVersion,
    workflowVersions,
    workflowVersionsLoading,
    themeMode,
    toggleTheme,
    undo,
    redo,
    canUndo,
    canRedo,
    setWorkflowDiffModalOpen,
  } = useDesignerStore(
    useShallow((state) => ({
      workflowName: state.workflowName,
      workflowVersion: state.workflowVersion,
      workflowVersions: state.workflowVersions,
      workflowVersionsLoading: state.workflowVersionsLoading,
      themeMode: state.themeMode,
      toggleTheme: state.toggleTheme,
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      setWorkflowDiffModalOpen: state.setWorkflowDiffModalOpen,
    }))
  );

  const availableVersions = workflowVersions || [];

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        py: 1.5,
        borderBottom: "1px solid var(--color-border-default, #e5e7eb)",
        background: "var(--color-canvas-subtle, #f6f8fa)",
        color: "var(--color-fg-default, #1f2328)",
        zIndex: 100,
        fontFamily: "'VodafoneRegular', 'Segoe UI', Arial, sans-serif",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Tooltip title="Back to Workflows">
          <IconButton
            onClick={() => navigate("/workflows")}
            sx={{
              color: "var(--color-fg-default, #1f2328)",
              "&:hover": {
                backgroundColor:
                  "color-mix(in oklab, var(--color-fg-default) 10%, transparent)",
              },
            }}
            aria-label="Back to Workflows"
          >
            <ArrowLeft size={20} />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            width: "1px",
            height: "24px",
            backgroundColor: "var(--color-border-default, #e5e7eb)",
          }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              lineHeight: 1.2,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Workflow size={18} style={{ opacity: 0.8 }} />
            {workflowName || "Untitled Workflow"}
          </Typography>
          <WorkflowSaveStatus />
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {/* Undo / Redo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton
                onClick={undo}
                disabled={!canUndo}
                size="small"
                sx={{
                  color: "var(--color-fg-default, #1f2328)",
                  "&:hover": {
                    backgroundColor:
                      "color-mix(in oklab, var(--color-fg-default) 10%, transparent)",
                  },
                  "&.Mui-disabled": {
                    color: "var(--color-fg-muted, #9ca3af)",
                    opacity: 0.45,
                  },
                }}
                aria-label="Undo"
              >
                <Undo2 size={18} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Redo (Ctrl+Shift+Z, Ctrl+Y)">
            <span>
              <IconButton
                onClick={redo}
                disabled={!canRedo}
                size="small"
                sx={{
                  color: "var(--color-fg-default, #1f2328)",
                  "&:hover": {
                    backgroundColor:
                      "color-mix(in oklab, var(--color-fg-default) 10%, transparent)",
                  },
                  "&.Mui-disabled": {
                    color: "var(--color-fg-muted, #9ca3af)",
                    opacity: 0.45,
                  },
                }}
                aria-label="Redo"
              >
                <Redo2 size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box
          sx={{
            width: "1px",
            height: "20px",
            backgroundColor: "var(--color-border-default, #e5e7eb)",
          }}
        />

        {/* Validation Header Indicator */}
        <WorkflowValidationIndicator />



        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: 13,
              color: "var(--color-fg-muted, #6b7280)",
            }}
          >
            Version:
          </Typography>
          <select
            value={String(workflowVersion || "")}
            onChange={onWorkflowVersionChange}
            disabled={workflowVersionsLoading || availableVersions.length <= 1}
            style={{
              height: 30,
              minWidth: 86,
              border: "1px solid var(--color-border-default, #d1d5db)",
              borderRadius: 6,
              background: "var(--color-canvas-default, #ffffff)",
              color: "var(--color-fg-default, #111827)",
              padding: "0 8px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {workflowVersionsLoading ? (
              <option value={String(workflowVersion || "")}>Loading</option>
            ) : availableVersions.length === 0 ? (
              <option value={String(workflowVersion || "")}>
                v{workflowVersion || "1"}
              </option>
            ) : (
              availableVersions.map((version) => (
                <option key={version} value={String(version)}>
                  v{version}
                </option>
              ))
            )}
          </select>
          <Tooltip title="Compare Workflow Versions">
            <span>
              <IconButton
                onClick={() => setWorkflowDiffModalOpen(true)}
                disabled={!workflowName}
                size="small"
                sx={{
                  color: "var(--color-fg-default, #1f2328)",
                  "&:hover": {
                    backgroundColor:
                      "color-mix(in oklab, var(--color-fg-default) 10%, transparent)",
                  },
                  "&.Mui-disabled": {
                    color: "var(--color-fg-muted, #9ca3af)",
                    opacity: 0.45,
                  },
                }}
                aria-label="Compare Workflow Versions"
              >
                <GitCompare size={17} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box
          sx={{
            width: "1px",
            height: "20px",
            backgroundColor: "var(--color-border-default, #e5e7eb)",
          }}
        />

        <Tooltip
          title={
            themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          <IconButton
            onClick={toggleTheme}
            sx={{
              color: "var(--color-fg-default, #1f2328)",
              "&:hover": {
                backgroundColor:
                  "color-mix(in oklab, var(--color-fg-default) 10%, transparent)",
              },
            }}
            aria-label={
              themeMode === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            {themeMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export const DesignerHeader = React.memo(DesignerHeaderBase);
DesignerHeader.displayName = "DesignerHeader";
