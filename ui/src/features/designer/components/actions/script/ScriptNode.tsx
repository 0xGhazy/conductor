import React, { useState, useMemo, useEffect } from "react";
import { FileCode2 as FileCodeIcon } from "lucide-react";
import { FaJava } from "react-icons/fa";
import { SiJavascript, SiPython } from "react-icons/si";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { TASK_NODE_COLORS, WeaverTaskNode } from "@/features/designer/nodes/WeaverTaskNode";
import { ActionConfigModal } from "@/features/designer/nodes/ActionConfigModal";
import { useScopedParameterOptions } from "@/features/designer/hooks/useScopedSuggestions";
import { config } from "@/config/appConfig";
import { logError } from "@/utils/logger";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useWeaverNotification } from "@/components/common/notifications";
import { isValidJavaVariableName } from "@/utils/validation";
import { executeScriptAction } from "@/features/designer/components/actions/script/api/scriptActionApi";
import {
  normalizeScriptLanguage,
  resolveScriptTimeoutMs,
  parseVariablesMap,
} from "@/features/designer/components/actions/script/model/scriptActionDto";
import { ScriptConfigForm } from "@/features/designer/components/actions/script/ScriptConfigForm";
import "@/features/designer/components/actions/script/ScriptNode.css";
import { create } from "zustand";

interface ScriptTemplate {
  id: string;
  name: string;
  script: string;
  language: string;
  variables: Record<string, any>;
}

interface ScriptStore {
  templates: ScriptTemplate[];
  loading: boolean;
  error: string;
  lastFetched: number;
  fetchTemplates: (force?: boolean) => Promise<void>;
}

export const useScriptStore = create<ScriptStore>((set, get) => ({
  templates: [],
  loading: false,
  error: "",
  lastFetched: 0,
  fetchTemplates: async (force = false) => {
    const { lastFetched, loading } = get();
    if (loading) return;
    const now = Date.now();
    const cacheTtl = config.scriptsTtlMs || 30000;
    if (!force && get().templates.length > 0 && now - lastFetched < cacheTtl) {
      return;
    }
    set({ loading: true, error: "" });
    try {
      const url = `${config.apiBaseUrl}/api/scripts`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.json();
      const raw = Array.isArray(body?.data) ? body.data : [];
      const templates = raw.map((t: any, idx: number) => ({
        id: t?.id ?? t?.name ?? String(idx),
        name: t?.name || `Script ${idx + 1}`,
        script: t?.script ?? t?.expression ?? t?.expr ?? t?.content ?? "",
        language: normalizeScriptLanguage(
          t?.language ?? t?.scriptLanguage ?? t?.config?.language ?? t?.config?.scriptLanguage
        ),
        variables: t?.variables ?? t?.params ?? t?.config?.variables ?? {},
      })).filter((t: any) => Boolean(t.id));
      set({ templates, loading: false, lastFetched: now });
    } catch (e: any) {
      set({ error: e.message || "Failed to fetch script templates", loading: false });
    }
  }
}));

const SCRIPT_LANGUAGE_OPTIONS = [
  { value: "PYTHON", label: "Python", editorLanguage: "python", icon: SiPython, color: "#3776ab" },
  { value: "JAVASCRIPT", label: "JavaScript", editorLanguage: "javascript", icon: SiJavascript, color: "#f7df1e" },
  { value: "JEXL", label: "JEXL", editorLanguage: "jexl", icon: FaJava, color: "#f89820" },
];

const getScriptLanguageOption = (value: string) => {
  const language = normalizeScriptLanguage(value);
  return SCRIPT_LANGUAGE_OPTIONS.find((option) => option.value === language) || SCRIPT_LANGUAGE_OPTIONS[2];
};

const generateReferenceName = (prefix: string) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${suffix}`;
};

export function exportScriptActionData(data: any, id?: string, position: any = {}) {
  const cfg = data?.config || {};
  const refName =
    String(
      cfg.name ||
      cfg.referenceName ||
      cfg.taskReferenceName ||
      cfg.reference ||
      (data?.name && data.name !== "Script Action" && data.name !== "SCRIPT" && data.name !== "Script" ? data.name : null) ||
      `script_${id || "ref"}`
    ).trim();

  const script = String(cfg.expression ?? "");
  const variables = parseVariablesMap(cfg.variables, {});
  const language = normalizeScriptLanguage(cfg.language ?? cfg.scriptLanguage ?? "JEXL");
  const timeout = resolveScriptTimeoutMs(cfg);

  const inputParameters = {
    script,
    variables,
    language,
    timeout,
  };

  return {
    name: "ScriptWorker",
    taskReferenceName: refName,
    inputParameters,
    type: "SIMPLE",
  };
}

export const exportJexlActionData = (data: any, id?: string, position: any = {}) =>
  exportScriptActionData(data, id, position);

interface ScriptNodeProps extends NodeProps {
  parameterOptions?: Array<string | { value: string; label: string }>;
  onRun?: (data: any) => void;
}

const ORIGIN_POSITION = { x: 0, y: 0 };

function ScriptNodeBase({ id, data, onRun, parameterOptions: parameterOptionsProp }: ScriptNodeProps) {
  const nodeLanguageOption = getScriptLanguageOption(data?.config?.language ?? data?.config?.scriptLanguage);
  const CardIcon = nodeLanguageOption?.icon || FileCodeIcon;

  const { setNodes, getNode } = useReactFlow();
  const { show: showNotification, error: showError } = useWeaverNotification();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("configurations");
  const [runResultText, setRunResultText] = useState("");
  const [runStatus, setRunStatus] = useState("N/A");
  const [runExecutionTime, setRunExecutionTime] = useState("N/A");
  const [runRequestId, setRunRequestId] = useState("N/A");
  const [isRunning, setIsRunning] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Suggestions are only needed (and computed) while the config modal is open.
  const lazyParameterOptions = useScopedParameterOptions(open && parameterOptionsProp === undefined);
  const parameterOptions = parameterOptionsProp ?? lazyParameterOptions;

  const currentNode = getNode ? getNode(id) : null;
  const nodePosition = currentNode?.position || ORIGIN_POSITION;

  const jsonRepresentation = useMemo(() => {
    if (!open) return null;
    return exportScriptActionData(draftData ?? data, id, nodePosition);
  }, [open, draftData, data, id, nodePosition]);

  useEffect(() => {
    const existingRefName = String(
      data?.config?.name ??
      data?.config?.referenceName ??
      data?.config?.reference ??
      data?.config?.taskReferenceName ??
      ""
    ).trim();
    if (existingRefName) return;

    const defaultRefName = generateReferenceName("script");
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const config = node.data?.config ?? {};
        return {
          ...node,
          data: {
            ...(node.data ?? {}),
            config: {
              ...config,
              name: defaultRefName,
              referenceName: defaultRefName,
              reference: defaultRefName,
              taskReferenceName: defaultRefName,
            },
          },
        };
      })
    );
  }, [data?.config?.name, data?.config?.reference, data?.config?.referenceName, data?.config?.taskReferenceName, id, setNodes]);

  const referenceName =
    (draftData ?? data)?.config?.name ||
    (draftData ?? data)?.config?.referenceName ||
    (draftData ?? data)?.config?.reference ||
    (draftData ?? data)?.config?.taskReferenceName ||
    "";
  const nodeBaseName = data?.name || "Script";
  const nodeDisplayName = hasUnsavedChanges ? `${nodeBaseName} (Draft)` : nodeBaseName;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const existingRefName = String(
      data?.config?.name ??
      data?.config?.referenceName ??
      data?.config?.reference ??
      data?.config?.taskReferenceName ??
      ""
    ).trim();
    const existingConfig: any = data?.config ?? {};
    const refName = existingRefName || generateReferenceName("script");
    const nextConfig: any = {
      ...existingConfig,
      name: refName,
      referenceName: refName,
      reference: refName,
      taskReferenceName: refName,
    };
    delete nextConfig.timeoutMs;
    delete nextConfig.timeoutSeconds;
    delete nextConfig.timeoutMilliseconds;
    nextConfig.expression = String(existingConfig.expression || existingConfig.script || "");
    delete nextConfig.script;
    nextConfig.language = normalizeScriptLanguage(existingConfig.language ?? existingConfig.scriptLanguage);
    nextConfig.timeout = resolveScriptTimeoutMs(existingConfig);

    const cloned = {
      ...(data ?? {}),
      name: data?.name || "Script",
      config: nextConfig,
    };
    setDraftData(cloned);
    setHasUnsavedChanges(false);
    setValidationErrors({});
    setActiveTab("configurations");
    setOpen(true);
  };

  const closeAndResetModal = () => {
    setOpen(false);
    setDraftData(null);
    setHasUnsavedChanges(false);
    setValidationErrors({});
    setActiveTab("configurations");
  };

  const handleRun = async () => {
    if (isRunning) return;

    const sourceData = draftData ?? data;
    const cfg = sourceData?.config ?? {};
    const script = String(cfg.expression || "").trim();

    if (!script) {
      showError(`Script node "${sourceData?.name || "Script"}" script is required before running.`);
      setActiveTab("configurations");
      return;
    }

    const payload = exportScriptActionData(sourceData, id, nodePosition).inputParameters;
    const startedAt = performance.now();
    setIsRunning(true);

    try {
      const { response: res, body: responseBody } = await executeScriptAction(payload);

      if (!res.ok) {
        const prettyError =
          typeof responseBody === "string"
            ? responseBody
            : JSON.stringify(responseBody, null, 2);
        showError(`Script node "${data?.name || "Script"}" failed: HTTP ${res.status}${prettyError ? ` - ${prettyError}` : ""}`);
        setRunResultText(typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody ?? {}, null, 2));
        setRunStatus("FAILED");
        setRunExecutionTime(`${Math.round(performance.now() - startedAt)} ms`);
        setRunRequestId(
          typeof responseBody === "object" && responseBody != null && (responseBody as any).requestId != null
            ? String((responseBody as any).requestId)
            : "N/A"
        );
        setActiveTab("result");
        return;
      }

      const elapsed = Math.round(performance.now() - startedAt);
      const mappedStatus =
        typeof responseBody === "object" && responseBody != null
          ? String((responseBody as any).status ?? "SUCCESS")
          : "SUCCESS";
      const isFailedResult = mappedStatus.toUpperCase() === "FAILED";
      const mappedRequestId =
        typeof responseBody === "object" && responseBody != null && (responseBody as any).requestId != null
          ? String((responseBody as any).requestId)
          : "N/A";
      const mappedExecutionTime =
        typeof responseBody === "object" && responseBody != null && (responseBody as any).executionTimeMs != null
          ? `${String((responseBody as any).executionTimeMs)} ms`
          : typeof responseBody === "object" && responseBody != null && (responseBody as any).executionTime != null
            ? `${String((responseBody as any).executionTime)} ms`
            : typeof responseBody === "object" && responseBody != null && (responseBody as any).responseTime != null
              ? `${String((responseBody as any).responseTime)} ms`
              : `${elapsed} ms`;
      const resultPayload =
        typeof responseBody === "object" &&
          responseBody != null &&
          Object.prototype.hasOwnProperty.call(responseBody, "output")
          ? (responseBody as any).output
          : typeof responseBody === "object" &&
            responseBody != null &&
          Object.prototype.hasOwnProperty.call(responseBody, "result")
          ? (responseBody as any).result
          : responseBody;
      const prettyResult =
        typeof resultPayload === "string"
          ? resultPayload
          : JSON.stringify(resultPayload ?? {}, null, 2);

      setRunResultText(prettyResult || "");
      setActiveTab("result");
      setRunStatus(mappedStatus);
      setRunExecutionTime(mappedExecutionTime);
      setRunRequestId(mappedRequestId);
      showNotification({
        message: isFailedResult
          ? `Script node "${data?.name || "Script"}" failed: ${String((responseBody as any)?.reason || (responseBody as any)?.message || "Execution failed")}`
          : `Script node "${data?.name || "Script"}" executed successfully.`,
        severity: isFailedResult ? "error" : "success",
      });
    } catch (error: any) {
      logError(`Script execute error`, error);
      showError(`Script node "${data?.name || "Script"}" error: ${error?.message || String(error)}`);
      setRunResultText("{}");
      setRunStatus("FAILED");
      setRunExecutionTime(`${Math.round(performance.now() - startedAt)} ms`);
      setRunRequestId("N/A");
      setActiveTab("result");
    } finally {
      setIsRunning(false);
    }

    if (typeof onRun === "function") onRun(sourceData);
  };

  const handleConfigChange = (nextData: any) => {
    let nextConfig = nextData?.config ? { ...nextData.config } : undefined;
    if (nextConfig) {
      const updatedRef =
        nextConfig.name ??
        nextConfig.referenceName ??
        nextConfig.reference ??
        nextConfig.taskReferenceName;

      if (updatedRef !== undefined) {
        nextConfig.name = updatedRef;
        nextConfig.referenceName = updatedRef;
        nextConfig.reference = updatedRef;
        nextConfig.taskReferenceName = updatedRef;

        const trimmed = String(updatedRef).trim();
        if (trimmed && isValidJavaVariableName(trimmed)) {
          setValidationErrors((prev) => {
            if (!prev.referenceName) return prev;
            const next = { ...prev };
            delete next.referenceName;
            return next;
          });
        }
      }
    }

    setDraftData((prev: any) => {
      const prevData = prev ?? data ?? {};
      setHasUnsavedChanges(true);
      return {
        ...prevData,
        ...nextData,
        ...(nextData?.name !== undefined ? { name: nextData.name } : {}),
        config: {
          ...(prevData.config ?? {}),
          ...(nextConfig ?? {}),
        },
      };
    });
  };

  const handleSave = () => {
    const sourceData = draftData ?? data;
    const cfg = sourceData?.config ?? {};
    const referenceNameValue = String(
      cfg.name ??
      cfg.referenceName ??
      cfg.reference ??
      cfg.taskReferenceName ??
      ""
    ).trim();

    const nextErrors: Record<string, string> = {};
    if (!referenceNameValue) {
      nextErrors.referenceName = "Reference Name is required.";
    } else if (!isValidJavaVariableName(referenceNameValue)) {
      nextErrors.referenceName = "Reference Name must be a valid Java variable name.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      showError("Please fix validation errors before saving.");
      return;
    }
    setValidationErrors({});
    const finalData = {
      ...sourceData,
      name: sourceData?.name || "Script",
      config: {
        ...cfg,
        name: referenceNameValue,
        referenceName: referenceNameValue,
        reference: referenceNameValue,
        taskReferenceName: referenceNameValue,
      },
    };
    setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: finalData } : node)));
    closeAndResetModal();
  };

  const customTabs = useMemo(
    () => [{ id: "result", label: "Result", icon: <QueryStatsIcon fontSize="small" /> }],
    []
  );

  const resultTabContent = (
    <Box>
      <Box className="http-result-cards">
        <Box className="http-result-card">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <CheckCircleOutlineOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Status</Typography>
          </Box>
          <Typography className="http-result-card-value">{runStatus}</Typography>
        </Box>
        <Box className="http-result-card">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <AccessTimeOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Execution Time</Typography>
          </Box>
          <Typography className="http-result-card-value">{runExecutionTime}</Typography>
        </Box>
        <Box className="http-result-card">
          <Box className="http-result-card-head">
            <Box className="http-result-card-icon">
              <FingerprintOutlinedIcon fontSize="small" />
            </Box>
            <Typography className="http-result-card-label">Request Id</Typography>
          </Box>
          <Typography className="http-result-card-value">{runRequestId}</Typography>
        </Box>
      </Box>
      <WeaverCodeEditor
        className="start-config-json-editor"
        language="json"
        value={runResultText || "{}"}
        height="42vh"
        options={{ readOnly: true, lineNumbers: "on", renderLineHighlight: "none" }}
      />
    </Box>
  );

  return (
    <>
      <WeaverTaskNode
        id={id}
        title={nodeDisplayName}
        taskReferenceName={referenceName}
        description={data?.config?.description || data?.description || "Execute JavaScript or custom scripts"}
        icon={CardIcon}
        color={TASK_NODE_COLORS.script}
        className="script-node-card"
        sourceHandleId="scriptResult"
        onDoubleClick={handleOpen}
        contextMenuItems={[
          {
            label: "Run",
            icon: <PlayArrowIcon fontSize="small" />,
            onClick: () => handleRun(),
          },
        ]}
      />

      <ActionConfigModal
        open={open}
        title={hasUnsavedChanges ? "Script Node (Draft)" : "Script Node"}
        nodeDisplayName={data?.name || "Script Node"}
        initialData={data}
        draftData={draftData}
        isDirty={hasUnsavedChanges}
        modalWidth={1200}
        onClose={closeAndResetModal}
        onSave={handleSave}
        onRun={handleRun}
        runDisabled={isRunning}
        runLoading={isRunning}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        customTabs={customTabs}
        customTabContent={{ result: resultTabContent }}
        jsonRepresentation={jsonRepresentation}
        jsonReadOnly={true}
        parameterOptions={parameterOptions as any}
        className="script-config-modal jexl-config-modal"
      >
        <ScriptConfigForm
          data={draftData ?? data}
          onChange={handleConfigChange}
          validationErrors={validationErrors}
          parameterOptions={parameterOptions}
          nodeLabel="Script"
          referencePlaceholder="script_xxxxxxxx"
          expressionLabel="Script"
          showLanguageSelector={true}
        />
      </ActionConfigModal>
    </>
  );
}

export const ScriptNode = React.memo(ScriptNodeBase);

export default ScriptNode;

interface ScriptActionNodeProps {
  id: string;
  data: any;
  onRun?: (data: any) => void;
  parameterOptions?: Array<string | { value: string; label: string }>;
}

export function ScriptActionNode(props: ScriptActionNodeProps) {
  return (
    <ScriptNode
      id={props.id}
      data={props.data}
      onRun={props.onRun}
      parameterOptions={props.parameterOptions}
    />
  );
}
