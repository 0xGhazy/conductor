import React from "react";
import Modal from "@mui/material/Modal";
import Backdrop from "@mui/material/Backdrop";
import Fade from "@mui/material/Fade";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import DataObjectIcon from "@mui/icons-material/DataObject";
import { modalStyle } from "@/utils/modalStyle";
import { WeaverCodeEditor } from "@/components/common/editors";
import { WeaverButton } from "@/components/common/buttons";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useShallow } from "zustand/react/shallow";

const RunResultModalBase: React.FC = () => {
  const {
    runResultOpen,
    runResultTab,
    runResultData,
    setRunResultOpen,
    setRunResultTab,
  } = useDesignerStore(
    useShallow((state) => ({
      runResultOpen: state.runResultOpen,
      runResultTab: state.runResultTab,
      runResultData: state.runResultData,
      setRunResultOpen: state.setRunResultOpen,
      setRunResultTab: state.setRunResultTab,
    }))
  );

  const handleClose = () => {
    setRunResultOpen(false);
    setRunResultTab("summary");
  };

  const summaryItems = [
    ["Workflow ID", runResultData.runWorkflowId || "N/A"],
    ["Status", runResultData.runWorkflowStatus || "N/A"],
    ["Version", runResultData.runWorkflowVersion || "N/A"],
    ["Start Time", runResultData.runStartTime || "N/A"],
    ["End Time", runResultData.runEndTime || "N/A"],
    ["Duration", runResultData.runDurationText || "N/A"],
    ["Reason for Incompletion", runResultData.runReasonForIncompletion || "N/A"],
    ["Request Id", runResultData.runRequestId || "N/A"],
  ];

  return (
    <Modal
      aria-labelledby="run-result-title"
      open={runResultOpen}
      onClose={handleClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 300,
        },
      }}
    >
      <Fade in={runResultOpen}>
        <Box
          sx={{
            ...modalStyle,
            width: 1000,
            backgroundColor: "var(--color-canvas-subtle, #ffffff)",
            color: "var(--color-fg-default, #111827)",
          }}
          className="designer-modal node-config-modal start-config-modal run-result-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography
              id="run-result-title"
              variant="h6"
              component="h2"
              sx={{ textAlign: "center", width: "100%" }}
            >
              Run Result
            </Typography>
          </Stack>

          <Tabs
            value={runResultTab}
            onChange={(_, next) => setRunResultTab(next)}
            className="node-config-tabs"
            sx={{
              mb: 2,
              "& .MuiTab-root": { minHeight: 40 },
              "& .MuiTab-iconWrapper": {
                display: "inline-flex",
                marginBottom: "0 !important",
                mr: 0.75,
              },
            }}
          >
            <Tab
              icon={<SummarizeOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="Summary"
              value="summary"
            />
            <Tab
              icon={<CompareArrowsOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="Workflow Input/Output"
              value="io"
            />
            <Tab
              icon={<DataObjectIcon fontSize="small" />}
              iconPosition="start"
              label="Workflow JSON"
              value="workflowJson"
            />
          </Tabs>

          {runResultTab === "summary" ? (
            <Box
              sx={{
                mb: 1.5,
                border: "1px solid var(--color-border-default, #d1d5db)",
                borderRadius: 0,
                overflow: "hidden",
                backgroundColor: "var(--color-canvas-default, #ffffff)",
              }}
            >
              {summaryItems.map(([label, value], index, arr) => (
                <Box
                  key={label}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 1fr) 1.2fr",
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    backgroundColor:
                      index % 2 === 0
                        ? "var(--color-canvas-default, #ffffff)"
                        : "color-mix(in oklab, var(--color-canvas-default, #ffffff) 92%, var(--color-canvas-subtle, #f3f4f6))",
                    borderBottom:
                      index === arr.length - 1
                        ? "none"
                        : "1px solid var(--color-border-default, #e5e7eb)",
                    alignItems: "center",
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: 14, wordBreak: "break-word" }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : null}

          {runResultTab === "io" ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1.4fr" },
                gap: 2,
              }}
            >
              <Box>
                <Typography
                  className="start-config-section-title"
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  Input
                </Typography>
                <Box sx={{ borderRadius: 0, overflow: "hidden" }}>
                  <WeaverCodeEditor
                    className="start-config-json-editor"
                    language="json"
                    value={runResultData.runInputJsonText || "{}"}
                    onChange={() => {}}
                    height="20vh"
                    options={{
                      readOnly: true,
                      lineNumbers: "on",
                      renderLineHighlight: "none",
                      minimap: { enabled: false },
                    }}
                  />
                </Box>

                <Typography
                  className="start-config-section-title"
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1, mt: 1.5 }}
                >
                  Variables
                </Typography>
                <Box sx={{ borderRadius: 0, overflow: "hidden" }}>
                  <WeaverCodeEditor
                    className="start-config-json-editor"
                    language="json"
                    value={runResultData.runVariablesJsonText || "{}"}
                    onChange={() => {}}
                    height="20vh"
                    options={{
                      readOnly: true,
                      lineNumbers: "on",
                      renderLineHighlight: "none",
                      minimap: { enabled: false },
                    }}
                  />
                </Box>
              </Box>

              <Box>
                <Typography
                  className="start-config-section-title"
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  Output
                </Typography>
                <Box sx={{ borderRadius: 0, overflow: "hidden" }}>
                  <WeaverCodeEditor
                    className="start-config-json-editor"
                    language="json"
                    value={runResultData.runOutputJsonText || "{}"}
                    onChange={() => {}}
                    height="43.5vh"
                    options={{
                      readOnly: true,
                      lineNumbers: "on",
                      renderLineHighlight: "none",
                      minimap: { enabled: false },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          ) : null}

          {runResultTab === "workflowJson" ? (
            <Box sx={{ borderRadius: 0, overflow: "hidden" }}>
              <WeaverCodeEditor
                className="start-config-json-editor"
                language="json"
                value={runResultData.runWorkflowJsonText || "{}"}
                onChange={() => {}}
                height="58vh"
                options={{
                  readOnly: true,
                  lineNumbers: "on",
                  renderLineHighlight: "none",
                  minimap: { enabled: false },
                }}
              />
            </Box>
          ) : null}

          <div
            className="node-config-footer"
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <WeaverButton variant="outlined" color="inherit" onClick={handleClose}>
              Close
            </WeaverButton>
          </div>
        </Box>
      </Fade>
    </Modal>
  );
};

export const RunResultModal = React.memo(RunResultModalBase);
RunResultModal.displayName = "RunResultModal";
