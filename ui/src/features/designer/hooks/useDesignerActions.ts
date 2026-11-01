import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import { useWeaverNotification } from "@/components/common/notifications";
import { logInfo, logError, logDebug } from "@/utils/logger";
import {
  executeWorkflowByName,
  upsertNewWorkflowStructure,
} from "@/features/designer/services/designerApi";
import {
  buildExportPayload,
  buildWorkflowSignature,
  extractWorkflowImportMetadata,
  normalizeWorkflowDtoJsonToTopology,
  buildNestedWorkflowTasksFromGraph,
} from "@/features/designer/utils/workflowSerialization";
import {
  validateOrphanNodes,
  getMissingVariableKeys,
  formatDateTime,
  isStartNode,
  isStartNodeId,
  DEFAULT_START_TIMEOUT_SECONDS,
} from "@/features/designer/utils/designerGraphUtils";
import { resolveWorkflowVersionValue } from "@/features/designer/utils/workflowVersion";

export { resolveWorkflowVersionValue };

const getState = () => useDesignerStore.getState();

const downloadJSON = (obj: any, filename: string) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const parseImportedVariables = (raw: any) => {
  let importedVariables = raw ?? {};
  if (typeof importedVariables === "string") {
    try {
      importedVariables = JSON.parse(importedVariables);
    } catch {
      importedVariables = {};
    }
  }
  return importedVariables;
};

/**
 * Designer page actions. State is read lazily via `getState()` inside each callback, so this
 * hook does not subscribe its caller to the store and every returned callback is stable.
 */
export function useDesignerActions() {
  const navigate = useNavigate();
  const { show: showNotification, error: showErrorNotification } = useWeaverNotification();

  const resolveWorkflowVersion = useCallback(
    () => resolveWorkflowVersionValue(getState().workflowVersion),
    []
  );

  const buildExportFilename = useCallback(() => {
    const { workflowName, workflowVersion } = getState();
    const sanitized = (workflowName || "workflow")
      .replace(/[^a-z0-9_-]/gi, "_")
      .toLowerCase();
    return `${sanitized}_v${workflowVersion || 1}.json`;
  }, []);

  /** Parses + validates workflow JSON without touching the store. */
  const parseWorkflowTopology = useCallback(
    (jsonData: any): { success: false } | { success: true; nodes: any[]; edges: any[] } => {
      logInfo("Importing workflow from JSON", jsonData);

      try {
        const topologyData = normalizeWorkflowDtoJsonToTopology(jsonData);

        if (!topologyData || typeof topologyData !== "object") {
          logError("Invalid JSON format");
          showErrorNotification("Invalid JSON format");
          return { success: false };
        }

        if (!Array.isArray(topologyData.nodes) || !Array.isArray(topologyData.edges)) {
          logError("JSON must contain nodes and edges arrays or workflow DTO tasks and edges");
          showErrorNotification("Invalid JSON format: missing nodes or edges array");
          return { success: false };
        }

        const orphanValidation = validateOrphanNodes(topologyData.nodes, topologyData.edges);
        if (!orphanValidation.valid) {
          logError("Import contains orphan nodes");
          logError(orphanValidation.message || "Orphan nodes detected");
        }

        return { success: true, nodes: topologyData.nodes, edges: topologyData.edges };
      } catch (err: any) {
        logError(`Failed to import workflow: ${err?.message || err}`);
        showErrorNotification(`Import failed: ${err?.message || "Unknown error"}`);
        return { success: false };
      }
    },
    [showErrorNotification]
  );

  const importFromJSON = useCallback(
    (jsonData: any) => {
      const parsed = parseWorkflowTopology(jsonData);
      if (!parsed.success) return parsed;
      const { setNodes, setEdges, clearSelection } = getState();
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      clearSelection();
      showNotification({ message: "Workflow imported successfully", severity: "success" });
      return parsed;
    },
    [parseWorkflowTopology, showNotification]
  );

  const applyLoadedWorkflowTopology = useCallback(
    ({
      topology,
      workflowNameParam,
      requestedVersion,
    }: {
      topology: any;
      workflowNameParam?: string;
      requestedVersion?: any;
      routeLoadKey?: string;
    }) => {
      const imported = parseWorkflowTopology(topology);
      if (!imported.success) {
        showErrorNotification("Workflow UI topology is invalid.");
        return;
      }

      const topologyMeta = extractWorkflowImportMetadata(topology);
      const workflowNameValue = topologyMeta.workflowName || workflowNameParam || "";
      const workflowVersionValue = requestedVersion ?? topologyMeta.version ?? 1;
      const importedVariables = parseImportedVariables(topologyMeta.variables);

      getState().hydrateWorkflow({
        nodes: imported.nodes,
        edges: imported.edges,
        workflowName: workflowNameValue,
        workflowVersion: String(workflowVersionValue),
        workflowVariables: importedVariables ?? {},
        workflowDescription: topologyMeta.description || "",
        workflowCorrelationId: topologyMeta.correlationId || "",
        workflowLanguage: topologyMeta.language || "",
        workflowSupportedLanguages: topologyMeta.supportedLanguages || [],
        startMetaDraft: {
          name: workflowNameValue || "",
          version: String(workflowVersionValue || 1),
          description: topologyMeta.description || "",
          timeoutSeconds: String(topologyMeta.timeoutSeconds ?? DEFAULT_START_TIMEOUT_SECONDS),
          timeoutPolicy: topologyMeta.timeoutPolicy || "TIME_OUT_WF",
          language: topologyMeta.language || "",
          supportedLanguages: topologyMeta.supportedLanguages || [],
        },
        startInputsJsonText: JSON.stringify(
          {
            _language: topologyMeta.inputs?._language ?? topologyMeta.language ?? "",
            ...(topologyMeta.inputs || {}),
          },
          null,
          2
        ),
        startVariablesJsonText: JSON.stringify(
          importedVariables || topologyMeta.variables || {},
          null,
          2
        ),
        workflowStatus: "SAVED",
        lastSavedSignature: buildWorkflowSignature(imported.nodes, imported.edges, {
          workflowName: workflowNameValue,
          workflowVersion: workflowVersionValue,
          workflowVariables: importedVariables ?? {},
          workflowDescription: topologyMeta.description || "",
          workflowCorrelationId: topologyMeta.correlationId || "",
          workflowLanguage: topologyMeta.language || "",
          workflowSupportedLanguages: topologyMeta.supportedLanguages || [],
        }),
      });
      showNotification({ message: "Workflow imported successfully", severity: "success" });

      navigate(
        `/designer/${encodeURIComponent(workflowNameValue)}?version=${encodeURIComponent(
          String(workflowVersionValue)
        )}`,
        { replace: true }
      );
    },
    [parseWorkflowTopology, showErrorNotification, showNotification, navigate]
  );

  const applyImportedWorkflowDraft = useCallback(
    (workflowJson: any) => {
      const imported = parseWorkflowTopology(workflowJson);
      if (!imported.success) {
        showErrorNotification("Workflow JSON is invalid.");
        return;
      }

      const meta = extractWorkflowImportMetadata(workflowJson);
      const workflowNameValue = meta.workflowName || "";
      const workflowVersionValue = meta.version ?? 1;
      const importedVariables = parseImportedVariables(meta.variables);

      getState().hydrateWorkflow({
        nodes: imported.nodes,
        edges: imported.edges,
        workflowName: workflowNameValue,
        workflowVersion: String(workflowVersionValue || 1),
        workflowVariables: importedVariables ?? {},
        workflowDescription: meta.description || "",
        workflowCorrelationId: meta.correlationId || "",
        workflowLanguage: meta.language || "",
        workflowSupportedLanguages: meta.supportedLanguages || [],
        startMetaDraft: {
          name: workflowNameValue || "",
          version: String(workflowVersionValue || 1),
          description: meta.description || "",
          timeoutSeconds: String(meta.timeoutSeconds ?? DEFAULT_START_TIMEOUT_SECONDS),
          timeoutPolicy: meta.timeoutPolicy || "TIME_OUT_WF",
          language: meta.language || "",
          supportedLanguages: meta.supportedLanguages || [],
        },
        startInputsJsonText: JSON.stringify(
          {
            _language: meta.inputs?._language ?? meta.language ?? "",
            ...(meta.inputs || {}),
          },
          null,
          2
        ),
        startVariablesJsonText: JSON.stringify(importedVariables || meta.variables || {}, null, 2),
        workflowStatus: "UNSAVED",
        lastSavedSignature: null,
      });
      showNotification({ message: "Workflow imported successfully", severity: "success" });
    },
    [parseWorkflowTopology, showErrorNotification, showNotification]
  );

  const handleSaveNewStructure = useCallback(
    async ({ incrementVersion = false } = {}) => {
      const {
        nodes,
        edges,
        workflowName,
        workflowVariables,
        workflowDescription,
        workflowCorrelationId,
        workflowLanguage,
        workflowSupportedLanguages,
        setWorkflowStatus,
        setWorkflowVersion,
        setWorkflowVersions,
        setLastSavedSignature,
      } = getState();
      try {
        setWorkflowStatus("SAVING");
        const workflowTasks = buildNestedWorkflowTasksFromGraph(nodes, edges);
        const payload = buildExportPayload({
          nodes,
          edges,
          workflowName,
          workflowVersion: resolveWorkflowVersion(),
          workflowVariables,
          workflowDescription,
          workflowLanguage,
          workflowSupportedLanguages,
          workflowTasks,
        });

        const response = await upsertNewWorkflowStructure(payload, {
          incrementVersion,
          version: incrementVersion ? null : resolveWorkflowVersion(),
        });
        const savedVersion =
          response?.data?.version ??
          response?.version ??
          payload?.version ??
          resolveWorkflowVersion();
        const savedName =
          response?.data?.name ?? response?.name ?? payload?.name ?? workflowName ?? "";
        const message =
          response?.message ||
          response?.data?.message ||
          (incrementVersion
            ? "Workflow new version saved successfully."
            : "Workflow new structure saved successfully.");

        showNotification({ message, severity: "success" });
        setWorkflowVersion(String(savedVersion));
        setWorkflowVersions((prev: number[]) =>
          Array.from(
            new Set([
              ...(prev || []).map((v) => Number(v)).filter((v) => Number.isFinite(v)),
              Number(savedVersion),
            ])
          ).sort((a, b) => b - a)
        );
        setWorkflowStatus("SAVED");
        setLastSavedSignature(
          buildWorkflowSignature(nodes, edges, {
            workflowName: savedName,
            workflowVersion: savedVersion,
            workflowVariables: payload?.variables ?? {},
            workflowDescription: payload?.description || "",
            workflowCorrelationId: workflowCorrelationId || "",
            workflowLanguage: workflowLanguage || "",
            workflowSupportedLanguages: workflowSupportedLanguages || [],
          })
        );
      } catch (error: any) {
        setWorkflowStatus("FAILED");
        showErrorNotification(
          `Failed to save new structure: ${error?.message || "Unknown error."}`
        );
      }
    },
    [resolveWorkflowVersion, showNotification, showErrorNotification]
  );

  const handleSaveCurrentWorkflowVersion = useCallback(
    () => handleSaveNewStructure({ incrementVersion: false }),
    [handleSaveNewStructure]
  );

  const handleSaveIncrementedWorkflowVersion = useCallback(
    () => handleSaveNewStructure({ incrementVersion: true }),
    [handleSaveNewStructure]
  );

  const handleRun = useCallback(async () => {
    const {
      nodes,
      edges,
      workflowName,
      workflowVariables,
      workflowDescription,
      workflowCorrelationId,
      workflowLanguage,
      workflowSupportedLanguages,
      setRunResultData,
      setRunResultTab,
      setRunResultOpen,
    } = getState();

    if (!String(workflowName || "").trim()) {
      showErrorNotification("Please provide a workflow name before running.");
      return;
    }
    const missingVars = getMissingVariableKeys(workflowVariables);
    if (missingVars.length > 0) {
      showErrorNotification(`Please fill the required variables: ${missingVars.join(", ")}`);
      return;
    }
    const validation = (() => {
      const orphanValidation = validateOrphanNodes(nodes, edges);
      if (!orphanValidation.valid) return orphanValidation;
      const startNode = nodes.find((node) => isStartNode(node));
      if (!startNode) return { valid: false, message: "Start node not found" };
      const hasStartConnection = edges.some((e) => isStartNodeId(e.source));
      if (!hasStartConnection) {
        return {
          valid: false,
          message: "Flow must start from the start node. Connect the start node to an action.",
        };
      }
      return { valid: true, message: null };
    })();
    if (!validation.valid) {
      showErrorNotification(validation.message || "Invalid flow configuration");
      return;
    }

    try {
      const startedAt = Date.now();
      const startNode = nodes.find((n) => isStartNode(n));
      const startConfig = startNode?.data?.config || {};
      const executionLanguage =
        String(
          startConfig.language ??
            workflowLanguage ??
            (workflowSupportedLanguages && workflowSupportedLanguages.length > 0
              ? workflowSupportedLanguages[0]
              : "en")
        ).trim() || "en";

      const startInputParameters =
        startConfig?.inputParameters &&
        typeof startConfig.inputParameters === "object" &&
        !Array.isArray(startConfig.inputParameters)
          ? startConfig.inputParameters
          : {};
      const hasStartInputs = Object.keys(startInputParameters).length > 0;
      const executionInputs = hasStartInputs ? startInputParameters : {};

      const executionOptions = useWorkflowExecutionStore.getState().options;
      const resolvedVersion = resolveWorkflowVersion();
      const effectiveCorrelationId =
        executionOptions.correlationId || workflowCorrelationId || undefined;

      useWorkflowExecutionStore.getState().startExecution();

      const isSyncExecution = executionOptions.executionMode === "Sync";

      logInfo(
        `Executing workflow '${workflowName}' via Conductor (${isSyncExecution ? "Sync /api/workflow/execute" : "Async /api/workflow"}) with language '${executionLanguage}' and version '${resolvedVersion}'`
      );
      const result = await executeWorkflowByName(workflowName, executionInputs, {
        language: executionLanguage,
        version: resolvedVersion,
        correlationId: effectiveCorrelationId,
        executionMode: executionOptions.executionMode,
        waitForSeconds: executionOptions.waitSeconds ?? 60,
      });
      logInfo(`Execution result: ${JSON.stringify(result)}`);

      const responsePayload = result && typeof result === "object" ? result : {};
      const dataPayload =
        responsePayload && typeof responsePayload === "object" && "data" in responsePayload
          ? responsePayload.data
          : responsePayload;
      const executionTimeRaw =
        responsePayload?.executionTime ??
        responsePayload?.data?.executionTime ??
        responsePayload?.data?.query?.executionTime;
      const parsedExecutionTime = Number(executionTimeRaw);
      const mappedExecutionTime = Number.isFinite(parsedExecutionTime)
        ? parsedExecutionTime
        : Date.now() - startedAt;
      const mappedRequestId =
        responsePayload?.requestId != null
          ? String(responsePayload.requestId)
          : responsePayload?.requestid != null
            ? String(responsePayload.requestid)
            : "";
      const mappedStatus =
        typeof responsePayload?.success === "boolean" ? responsePayload.success : null;
      const workflowIdFromMessage = String(responsePayload?.message || "").match(
        /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/
      )?.[1];
      const mappedWorkflowId =
        responsePayload?.workflowId ??
        responsePayload?.targetWorkflowId ??
        responsePayload?.data?.workflowId ??
        responsePayload?.data?.id ??
        (typeof result === "string" ? result : "") ??
        workflowIdFromMessage ??
        "";

      if (mappedWorkflowId) {
        useWorkflowExecutionStore.getState().setWorkflowId(String(mappedWorkflowId).trim());
        useWorkflowExecutionStore
          .getState()
          .setExecutionStatus(isSyncExecution ? "completed" : "running");
      }

      const rawConductorStatus = String(
        responsePayload?.targetWorkflowStatus ??
          responsePayload?.status ??
          responsePayload?.data?.status ??
          ""
      ).toUpperCase();

      const mappedWorkflowStatus =
        rawConductorStatus === "COMPLETED"
          ? "COMPLETED"
          : rawConductorStatus === "FAILED" ||
              rawConductorStatus === "TIMED_OUT" ||
              mappedStatus === false
            ? "FAILED"
            : mappedStatus === true
              ? "COMPLETED"
              : "COMPLETED";

      // If sync execution returned tasks array, populate the task status map directly
      if (Array.isArray(responsePayload?.tasks) && responsePayload.tasks.length > 0) {
        const taskMap: Record<string, { status: string; durationMs?: number; errorMessage?: string }> =
          {};
        for (const t of responsePayload.tasks) {
          const ref = t.referenceTaskName || t.taskDefName || t.taskId;
          if (ref) {
            taskMap[ref] = {
              status: t.status || "COMPLETED",
              durationMs: t.endTime && t.startTime ? t.endTime - t.startTime : undefined,
              errorMessage: t.reasonForIncompletion || undefined,
            };
          }
        }
        useWorkflowExecutionStore.getState().setTaskStatusMap(taskMap);
      }
      const mappedWorkflowVersion =
        responsePayload?.version ?? responsePayload?.data?.version ?? resolveWorkflowVersion();
      const rawStartTime =
        responsePayload?.startTime ??
        responsePayload?.data?.startTime ??
        responsePayload?.data?.workflow?.startTime ??
        startedAt;
      const rawEndTime =
        responsePayload?.endTime ??
        responsePayload?.data?.endTime ??
        responsePayload?.data?.workflow?.endTime ??
        Date.now();
      const mappedStartTime = formatDateTime(rawStartTime);
      const mappedEndTime = formatDateTime(rawEndTime);
      const mappedDuration = `${Math.max(0, Math.round(mappedExecutionTime))}ms`;
      const mappedReason =
        responsePayload?.reasonForIncompletion ??
        responsePayload?.data?.reasonForIncompletion ??
        responsePayload?.data?.workflow?.reasonForIncompletion ??
        (mappedStatus === true ? "Workflow terminated" : "");
      const inputPayload = hasStartInputs
        ? (responsePayload?.input ??
          responsePayload?.data?.input ??
          responsePayload?.data?.workflowInput ??
          executionInputs ??
          {})
        : {};
      const startVariables =
        startNode?.data?.config?.variables &&
        typeof startNode.data.config.variables === "object" &&
        !Array.isArray(startNode.data.config.variables)
          ? startNode.data.config.variables
          : {};
      const resolvedVariables = {
        ...(workflowVariables ?? {}),
        ...startVariables,
      };
      const variablesPayload =
        responsePayload?.variables ?? responsePayload?.data?.variables ?? resolvedVariables ?? {};
      const outputPayload =
        responsePayload?.output ??
        responsePayload?.data?.output ??
        responsePayload?.data?.workflowOutput ??
        dataPayload ??
        {};
      const prettyResult =
        typeof dataPayload === "string" ? dataPayload : JSON.stringify(dataPayload ?? {}, null, 2);

      const workflowTasks = buildNestedWorkflowTasksFromGraph(nodes, edges);
      const workflowDtoPayload = buildExportPayload({
        nodes,
        edges,
        workflowName,
        workflowVersion: resolveWorkflowVersion(),
        workflowVariables,
        workflowDescription,
        workflowLanguage,
        workflowSupportedLanguages,
        workflowTasks,
      });

      setRunResultData({
        runExecutionTimeMs: mappedExecutionTime,
        runRequestId: mappedRequestId,
        runSuccessStatus: mappedStatus,
        runWorkflowId: String(mappedWorkflowId || ""),
        runWorkflowStatus: String(mappedWorkflowStatus || ""),
        runWorkflowVersion: String(mappedWorkflowVersion ?? ""),
        runStartTime: mappedStartTime,
        runEndTime: mappedEndTime,
        runDurationText: mappedDuration,
        runReasonForIncompletion: String(mappedReason || ""),
        runInputJsonText: JSON.stringify(inputPayload ?? {}, null, 2),
        runVariablesJsonText: JSON.stringify(variablesPayload ?? {}, null, 2),
        runOutputJsonText: JSON.stringify(outputPayload ?? {}, null, 2),
        runWorkflowJsonText: JSON.stringify(workflowDtoPayload, null, 2),
        runResultText: prettyResult || "{}",
      });
      setRunResultTab("summary");
      setRunResultOpen(true);
    } catch (err: any) {
      useWorkflowExecutionStore.getState().setExecutionStatus("failed");
      logError(`Execution failed: ${err?.message || err}`);
      showErrorNotification(
        `Execution failed: ${err && err.message ? err.message : "Unknown error"}`
      );
    }
  }, [resolveWorkflowVersion, showErrorNotification]);

  const buildCurrentExportPayload = useCallback(() => {
    const {
      nodes,
      edges,
      workflowName,
      workflowVariables,
      workflowDescription,
      workflowLanguage,
      workflowSupportedLanguages,
    } = getState();
    const workflowTasks = buildNestedWorkflowTasksFromGraph(nodes, edges);
    return buildExportPayload({
      nodes,
      edges,
      workflowName,
      workflowVersion: resolveWorkflowVersion(),
      workflowVariables,
      workflowDescription,
      workflowLanguage,
      workflowSupportedLanguages,
      workflowTasks,
    });
  }, [resolveWorkflowVersion]);

  const handleExport = useCallback(async () => {
    logDebug("Attempting to export workflow to JSON");
    const { nodes, edges, workflowName } = getState();
    if (!String(workflowName || "").trim()) {
      showErrorNotification("Please provide a workflow name before exporting.");
      return;
    }
    const orphanValidation = validateOrphanNodes(nodes, edges);
    if (!orphanValidation.valid) {
      logError("Export aborted due to orphan nodes");
      showErrorNotification(orphanValidation.message || "Orphan nodes detected");
      return;
    }

    const payload = buildCurrentExportPayload();
    logInfo("JSON prepared successfully - starting download");

    try {
      downloadJSON(payload, buildExportFilename());
      logInfo("Download triggered successfully");
    } catch (err: any) {
      logError(`Failed to download workflow JSON: ${err?.message || err}`);
    }
  }, [buildCurrentExportPayload, buildExportFilename, showErrorNotification]);

  const handleExportNewStructure = useCallback(async () => {
    logDebug("Attempting to export workflow new structure JSON");
    if (!String(getState().workflowName || "").trim()) {
      showErrorNotification("Please provide a workflow name before exporting.");
      return;
    }

    try {
      const payload = buildCurrentExportPayload();
      downloadJSON(payload, buildExportFilename());
      logInfo("New structure workflow JSON download triggered successfully");
    } catch (error: any) {
      logError(`Failed to export workflow new structure JSON: ${error?.message || error}`);
      showErrorNotification(`Failed to export new structure: ${error?.message || "Unknown error."}`);
    }
  }, [buildCurrentExportPayload, buildExportFilename, showErrorNotification]);

  const handleWorkflowVersionChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const { workflowName, workflowVersion } = getState();
      const selectedVersion = event.target.value;
      if (!selectedVersion || selectedVersion === workflowVersion) return;
      navigate(
        `/designer/${encodeURIComponent(workflowName)}?version=${encodeURIComponent(selectedVersion)}`
      );
    },
    [navigate]
  );

  return {
    handleRun,
    handleSaveCurrentWorkflowVersion,
    handleSaveIncrementedWorkflowVersion,
    handleExport,
    handleExportNewStructure,
    handleWorkflowVersionChange,
    importFromJSON,
    applyLoadedWorkflowTopology,
    applyImportedWorkflowDraft,
    resolveWorkflowVersion,
    buildExportFilename,
  };
}
