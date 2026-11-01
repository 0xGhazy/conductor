import React from "react";
import Modal from "@mui/material/Modal";
import Backdrop from "@mui/material/Backdrop";
import Fade from "@mui/material/Fade";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { modalStyle } from "@/utils/modalStyle";
import { WeaverTextField, WeaverSelectField } from "@/components/common/fields";
import { WeaverButton } from "@/components/common/buttons";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useShallow } from "zustand/react/shallow";
import {
  START_TIMEOUT_POLICIES,
  DEFAULT_START_TIMEOUT_SECONDS,
  parseStartInputsJson,
  parseStartVariablesJson,
  buildStartInputDefinitions,
  isStartNode,
} from "@/features/designer/utils/designerGraphUtils";
import { useWeaverNotification } from "@/components/common/notifications";
import {
  buildExportPayload,
  buildNestedWorkflowTasksFromGraph,
} from "@/features/designer/utils/workflowSerialization";
import { resolveWorkflowVersionValue } from "@/features/designer/utils/workflowVersion";
import { useKeepMountedWhileOpen } from "@/features/designer/hooks/useKeepMountedWhileOpen";

export interface WorkflowConfigurationModalProps {
  workflowDtoJsonText?: string;
}

const WorkflowConfigurationModalBase: React.FC<WorkflowConfigurationModalProps> = ({
  workflowDtoJsonText = "{}",
}) => {
  const {
    workflowConfigModalOpen,
    workflowConfigModalTab,
    setWorkflowConfigModalOpen,
    setWorkflowConfigModalTab,
    startModalOpen,
    startModalTab,
    setStartModalOpen,
    setStartModalTab,
    startMetaDraft,
    startInputsJsonText,
    startInputsError,
    startVariablesJsonText,
    startVariablesError,
    startNameError,
    startTimeoutError,
    setStartMetaDraft,
    setStartInputsJsonText,
    setStartInputsError,
    setStartVariablesJsonText,
    setStartVariablesError,
    setStartNameError,
    setStartTimeoutError,
    workflowName,
    workflowVersion,
    workflowVariables,
    setWorkflowVariables,
    workflowDescription,
    workflowLanguage,
    workflowSupportedLanguages,
    setWorkflowName,
    setWorkflowVersion,
    setWorkflowDescription,
    setWorkflowLanguage,
    setWorkflowSupportedLanguages,
    nodes,
    setNodes,
  } = useDesignerStore(
    useShallow((state) => ({
      workflowConfigModalOpen: state.workflowConfigModalOpen,
      workflowConfigModalTab: state.workflowConfigModalTab,
      setWorkflowConfigModalOpen: state.setWorkflowConfigModalOpen,
      setWorkflowConfigModalTab: state.setWorkflowConfigModalTab,
      startModalOpen: state.startModalOpen,
      startModalTab: state.startModalTab,
      setStartModalOpen: state.setStartModalOpen,
      setStartModalTab: state.setStartModalTab,
      startMetaDraft: state.startMetaDraft,
      startInputsJsonText: state.startInputsJsonText,
      startInputsError: state.startInputsError,
      startVariablesJsonText: state.startVariablesJsonText,
      startVariablesError: state.startVariablesError,
      startNameError: state.startNameError,
      startTimeoutError: state.startTimeoutError,
      setStartMetaDraft: state.setStartMetaDraft,
      setStartInputsJsonText: state.setStartInputsJsonText,
      setStartInputsError: state.setStartInputsError,
      setStartVariablesJsonText: state.setStartVariablesJsonText,
      setStartVariablesError: state.setStartVariablesError,
      setStartNameError: state.setStartNameError,
      setStartTimeoutError: state.setStartTimeoutError,
      workflowName: state.workflowName,
      workflowVersion: state.workflowVersion,
      workflowVariables: state.workflowVariables,
      setWorkflowVariables: state.setWorkflowVariables,
      workflowDescription: state.workflowDescription,
      workflowLanguage: state.workflowLanguage,
      workflowSupportedLanguages: state.workflowSupportedLanguages,
      setWorkflowName: state.setWorkflowName,
      setWorkflowVersion: state.setWorkflowVersion,
      setWorkflowDescription: state.setWorkflowDescription,
      setWorkflowLanguage: state.setWorkflowLanguage,
      setWorkflowSupportedLanguages: state.setWorkflowSupportedLanguages,
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  );

  const isOpen = Boolean(workflowConfigModalOpen || startModalOpen);
  const activeTab = workflowConfigModalTab || startModalTab || "configurations";

  const closeModal = React.useCallback(() => {
    setWorkflowConfigModalOpen?.(false);
    setStartModalOpen?.(false);
  }, [setWorkflowConfigModalOpen, setStartModalOpen]);

  const handleTabChange = React.useCallback(
    (nextTab: "configurations" | "json") => {
      setWorkflowConfigModalTab?.(nextTab);
      setStartModalTab?.(nextTab);
    },
    [setWorkflowConfigModalTab, setStartModalTab]
  );

  const { error: triggerError } = useWeaverNotification();

  React.useEffect(() => {
    if (!isOpen) return;
    const startNode = nodes.find((n) => isStartNode(n));
    const startConfig = startNode?.data?.config || {};
    const rawSupported =
      startConfig.supportedLanguages ??
      startConfig.supported_languages ??
      workflowSupportedLanguages ??
      [];
    const supportedLangs = Array.isArray(rawSupported)
      ? rawSupported.map((l: any) => String(l).trim().toLowerCase()).filter(Boolean)
      : [];

    const parsedTimeout = Number(startConfig.timeoutSeconds);
    const timeoutSeconds =
      Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : DEFAULT_START_TIMEOUT_SECONDS;

    setStartMetaDraft({
      name: workflowName || startNode?.data?.name || "Start",
      version: String(workflowVersion || 1),
      description: workflowDescription || "",
      timeoutSeconds: String(timeoutSeconds),
      timeoutPolicy: startConfig.timeoutPolicy || "TIME_OUT_WF",
      language: startConfig.language ?? workflowLanguage ?? "",
      supportedLanguages: supportedLangs,
    });
    const inputs = {
      _language: startConfig.inputParameters?._language ?? startConfig.language ?? workflowLanguage ?? "",
      ...(startConfig.inputParameters ?? {}),
    };
    setStartInputsJsonText(JSON.stringify(inputs, null, 2));
    setStartInputsError("");
    const vars = startConfig.variables ?? workflowVariables ?? {};
    setStartVariablesJsonText(JSON.stringify(vars, null, 2));
    setStartVariablesError("");
    setStartNameError("");
    setStartTimeoutError("");
  }, [isOpen]);

  const handleStartInputsJsonChange = (value: string | undefined) => {
    const nextValue = value ?? "";
    setStartInputsJsonText(nextValue);
    const parsedInputs = parseStartInputsJson(nextValue);
    setStartInputsError(parsedInputs.error || "");
  };

  const handleStartVariablesJsonChange = (value: string | undefined) => {
    const nextValue = value ?? "";
    setStartVariablesJsonText(nextValue);
    const parsedVariables = parseStartVariablesJson(nextValue);
    setStartVariablesError(parsedVariables.error || "");
  };

  const handleStartTimeoutChange = (value: string) => {
    const rawValue = value ?? "";
    setStartMetaDraft((prev) => ({ ...prev, timeoutSeconds: rawValue }));

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setStartTimeoutError("Timeout must be a positive number greater than 0.");
      return;
    }
    setStartTimeoutError("");
  };

  const handleSave = () => {
    const nextName = String(startMetaDraft.name || "").trim();
    const parsedVersion = Number(startMetaDraft.version);
    const parsedTimeout = Number(startMetaDraft.timeoutSeconds);
    const nextVersion =
      Number.isFinite(parsedVersion) && parsedVersion > 0
        ? String(Math.floor(parsedVersion))
        : "1";
    const nextTimeout =
      Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : null;
    const nextTimeoutPolicy =
      startMetaDraft.timeoutPolicy === "ALERT_ONLY" ? "ALERT_ONLY" : "TIME_OUT_WF";

    if (!nextName) {
      setStartNameError("Workflow Name is required.");
      triggerError("Please enter Workflow Name before saving.");
      return;
    }

    if (startTimeoutError || nextTimeout === null) {
      setStartTimeoutError("Timeout must be a positive number greater than 0.");
      triggerError("Please fix Timeout (seconds) before saving.");
      return;
    }

    const parsedInputs = parseStartInputsJson(startInputsJsonText);
    if (parsedInputs.error) {
      setStartInputsError(parsedInputs.error);
      triggerError("Please fix Start Inputs JSON before saving.");
      return;
    }

    const parsedVariables = parseStartVariablesJson(startVariablesJsonText);
    if (parsedVariables.error) {
      setStartVariablesError(parsedVariables.error);
      triggerError("Please fix Start Variables JSON before saving.");
      return;
    }

    const nextInputParameters = parsedInputs.value;
    const nextInputDefinitions = buildStartInputDefinitions(nextInputParameters);
    const nextVariables = parsedVariables.value ?? {};
    const nextLanguage = String(nextInputParameters?._language || "").trim();
    const nextSupportedLanguages = Array.isArray(startMetaDraft.supportedLanguages)
      ? startMetaDraft.supportedLanguages.map((l: any) => String(l).trim().toLowerCase()).filter(Boolean)
      : [];

    setWorkflowName(nextName);
    setWorkflowVersion(nextVersion);
    setWorkflowDescription(String(startMetaDraft.description || ""));
    setWorkflowVariables(nextVariables);
    setWorkflowLanguage(nextLanguage);
    setWorkflowSupportedLanguages(nextSupportedLanguages);

    setNodes((nds) =>
      nds.map((n) =>
        isStartNode(n)
          ? {
              ...n,
              data: {
                ...(n.data || {}),
                name: nextName || n.data?.name || "Start",
                config: {
                  ...(n.data?.config || {}),
                  timeoutSeconds: nextTimeout,
                  timeoutPolicy: nextTimeoutPolicy,
                  language: nextLanguage,
                  supportedLanguages: nextSupportedLanguages,
                  inputDefinitions: nextInputDefinitions,
                  inputParameters: nextInputParameters,
                  variables: nextVariables,
                },
              },
            }
          : n
      )
    );

    closeModal();
  };

  return (
    <Modal
      aria-labelledby="workflow-metadata-title"
      open={isOpen}
      onClose={closeModal}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
        },
      }}
    >
      <Fade in={isOpen}>
        <Box
          sx={{
            ...modalStyle,
            width: 1200,
            backgroundColor: "var(--color-canvas-subtle, #ffffff)",
            color: "var(--color-fg-default, #111827)",
          }}
          className="designer-modal node-config-modal start-config-modal workflow-config-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography
              id="workflow-metadata-title"
              variant="h6"
              component="h2"
              sx={{ textAlign: "center", width: "100%" }}
            >
              Workflow Configurations
            </Typography>
          </Stack>
          <Tabs
            value={activeTab}
            onChange={(_, next) => handleTabChange(next)}
            className="start-config-tabs"
            sx={{ mb: 2 }}
          >
            <Tab label="Configurations" value="configurations" />
            <Tab label="JSON" value="json" />
          </Tabs>

          {activeTab === "configurations" ? (
            <div className="settings-fields">
              <Box
                className="start-config-metadata-grid"
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1.4fr" },
                  columnGap: 2,
                  rowGap: 2,
                  alignItems: "start",
                }}
              >
                <Box sx={{ gridColumn: { xs: "1", md: "1" } }}>
                  <WeaverTextField
                    label="Workflow Name *"
                    value={startMetaDraft.name}
                    onChange={(value) => {
                      const nextValue = value;
                      setStartMetaDraft((prev) => ({ ...prev, name: nextValue }));
                      if (String(nextValue || "").trim()) {
                        setStartNameError("");
                      }
                    }}
                    errorMessage={startNameError || undefined}
                    fullWidth
                  />
                </Box>
                <Box
                  sx={{
                    gridColumn: { xs: "1", md: "2" },
                    gridRow: { md: "1 / span 2" },
                  }}
                >
                  <WeaverTextField
                    label="Description"
                    value={startMetaDraft.description}
                    onChange={(value) =>
                      setStartMetaDraft((prev) => ({
                        ...prev,
                        description: value,
                      }))
                    }
                    multiline
                    rows={4}
                    inputProps={{ maxLength: 280 }}
                    fullWidth
                  />
                </Box>
                <Box sx={{ gridColumn: { xs: "1", md: "1" } }}>
                  <WeaverTextField
                    label="Version"
                    type="number"
                    value={startMetaDraft.version}
                    onChange={(value) =>
                      setStartMetaDraft((prev) => ({
                        ...prev,
                        version: value,
                      }))
                    }
                    inputProps={{ min: 1, step: 1 }}
                    fullWidth
                    disabled
                  />
                </Box>
                <Box
                  sx={{
                    gridColumn: { xs: "1", md: "1" },
                    gridRow: { md: "3" },
                  }}
                >
                  <WeaverTextField
                    label="Timeout (seconds)"
                    type="number"
                    value={startMetaDraft.timeoutSeconds}
                    onChange={handleStartTimeoutChange}
                    inputProps={{ min: 1, step: 1 }}
                    errorMessage={startTimeoutError || undefined}
                    fullWidth
                  />
                </Box>
                <Box
                  sx={{
                    gridColumn: { xs: "1", md: "2" },
                    gridRow: { md: "3" },
                  }}
                >
                  <WeaverSelectField
                    label="Timeout Policy"
                    value={startMetaDraft.timeoutPolicy}
                    onChange={(value) =>
                      setStartMetaDraft((prev) => ({
                        ...prev,
                        timeoutPolicy: value as string,
                      }))
                    }
                    options={Object.keys(START_TIMEOUT_POLICIES).map((policy) => ({
                      label: `${policy} (${START_TIMEOUT_POLICIES[policy]})`,
                      value: policy,
                    }))}
                    fullWidth
                  />
                </Box>
              </Box>

              <Typography
                className="start-config-section-title"
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 0.5 }}
              >
                Inputs
              </Typography>
              <WeaverCodeEditor
                className="start-config-json-editor"
                language="json"
                value={startInputsJsonText}
                onChange={handleStartInputsJsonChange}
                height="24vh"
                options={{
                  lineNumbers: "on",
                  renderLineHighlight: "line",
                  folding: true,
                  minimap: { enabled: false },
                  scrollbar: {
                    vertical: "auto",
                    horizontal: "auto",
                  },
                }}
              />
              {startInputsError ? (
                <Typography
                  variant="caption"
                  sx={{ color: "error.main", display: "block", mt: 0.75 }}
                >
                  {startInputsError}
                </Typography>
              ) : null}

              <Typography
                className="start-config-section-title"
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 0.5, mt: 2 }}
              >
                Variables
              </Typography>
              <WeaverCodeEditor
                className="start-config-json-editor"
                language="json"
                value={startVariablesJsonText}
                onChange={handleStartVariablesJsonChange}
                height="24vh"
                options={{
                  lineNumbers: "on",
                  renderLineHighlight: "line",
                  folding: true,
                  minimap: { enabled: false },
                  scrollbar: {
                    vertical: "auto",
                    horizontal: "auto",
                  },
                }}
              />
              {startVariablesError ? (
                <Typography
                  variant="caption"
                  sx={{ color: "error.main", display: "block", mt: 0.75 }}
                >
                  {startVariablesError}
                </Typography>
              ) : null}
            </div>
          ) : (
            <WeaverCodeEditor
              className="start-config-json-editor"
              language="json"
              value={workflowDtoJsonText}
              onChange={() => {}}
              height="55vh"
              options={{
                readOnly: true,
                lineNumbers: "on",
                renderLineHighlight: "none",
                folding: true,
                scrollbar: {
                  vertical: "auto",
                  horizontal: "auto",
                },
              }}
            />
          )}

          <div
            className="start-config-footer"
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <WeaverButton
              variant="outlined"
              color="inherit"
              onClick={closeModal}
            >
              Cancel
            </WeaverButton>
            <WeaverButton variant="contained" color="primary" onClick={handleSave}>Save</WeaverButton>
          </div>
        </Box>
      </Fade>
    </Modal>
  );
};

/** Serializes the current graph to the workflow DTO JSON shown in the "JSON" tab. */
function useWorkflowDtoJsonText(enabled: boolean): string {
  const inputs = useDesignerStore(
    useShallow((state) =>
      enabled
        ? {
            nodes: state.nodes,
            edges: state.edges,
            workflowName: state.workflowName,
            workflowVersion: state.workflowVersion,
            workflowVariables: state.workflowVariables,
            workflowDescription: state.workflowDescription,
            workflowLanguage: state.workflowLanguage,
            workflowSupportedLanguages: state.workflowSupportedLanguages,
          }
        : null
    )
  );

  return React.useMemo(() => {
    if (!inputs) return "{}";
    try {
      const workflowTasks = buildNestedWorkflowTasksFromGraph(inputs.nodes, inputs.edges);
      const payload = buildExportPayload({
        ...inputs,
        workflowVersion: resolveWorkflowVersionValue(inputs.workflowVersion),
        workflowTasks,
      });
      return JSON.stringify(payload, null, 2);
    } catch {
      return "{}";
    }
  }, [inputs]);
}

const WorkflowConfigurationModalContent: React.FC<{ workflowDtoJsonText?: string }> = ({
  workflowDtoJsonText,
}) => {
  const isJsonTabOpen = useDesignerStore(
    (state) =>
      Boolean(state.workflowConfigModalOpen || state.startModalOpen) &&
      (state.workflowConfigModalTab || state.startModalTab) === "json"
  );
  // Only serialize the graph while the JSON tab is visible (and no explicit text was given).
  const computedJsonText = useWorkflowDtoJsonText(isJsonTabOpen && workflowDtoJsonText === undefined);
  return (
    <WorkflowConfigurationModalBase workflowDtoJsonText={workflowDtoJsonText ?? computedJsonText} />
  );
};

/**
 * Workflow configurations modal. Stays unmounted while closed (after its exit transition), so the
 * designer does not pay for its store subscriptions on every graph change.
 */
export const WorkflowConfigurationModal = React.memo(function WorkflowConfigurationModal({
  workflowDtoJsonText,
}: WorkflowConfigurationModalProps) {
  const isOpen = useDesignerStore((state) => Boolean(state.workflowConfigModalOpen || state.startModalOpen));
  const mounted = useKeepMountedWhileOpen(isOpen);
  if (!mounted) return null;
  return <WorkflowConfigurationModalContent workflowDtoJsonText={workflowDtoJsonText} />;
});

export const StartNodeModal = WorkflowConfigurationModal;
