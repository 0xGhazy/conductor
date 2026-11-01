import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import {
  FiPlay,
  FiCopy,
  FiCheck,
  FiClock,
  FiRotateCcw,
  FiCode,
  FiTerminal,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiTrash2,
  FiLayers,
} from "react-icons/fi";
import { WeaverCodeEditor } from "@/components/common/editors";
import { WeaverSelectField, WeaverTextField } from "@/components/common/fields";
import { config } from "@/config/appConfig";
import {
  buildExecuteUrl,
  executeWorkflow,
  formatJson,
  parseJsonSafe,
  wrapWorkflowExecutePayload,
  useWorkbenchWorkflows,
  type WorkbenchWorkflow,
} from "@/features/workbench";
import styles from "./WorkbenchPage.module.css";

interface ExecutionHistoryItem {
  id: string;
  workflowName: string;
  version: string;
  correlationId?: string;
  status: "SUCCESS" | "FAILED";
  duration: number;
  timestamp: string;
  payload: string;
  result: any;
}

const HISTORY_STORAGE_KEY = "weaver_workbench_history";
const HISTORY_LIMIT = 20;
/** Results whose serialized JSON exceeds this size are persisted as a truncated preview. */
const HISTORY_RESULT_MAX_CHARS = 20_000;
const HISTORY_RESULT_PREVIEW_CHARS = 2_000;

const EMPTY_WORKFLOWS: WorkbenchWorkflow[] = [];

const PAYLOAD_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  wordWrap: "on",
} as const;

const READONLY_EDITOR_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  wordWrap: "on",
} as const;

const noop = () => {};

/** Replace oversized results with a small preview marker so localStorage stays cheap to read/write. */
function compactHistoryResult(result: unknown): unknown {
  if (result === null || typeof result !== "object") return result;
  if ((result as { truncated?: unknown }).truncated === true) return result;
  let serialized: string;
  try {
    serialized = JSON.stringify(result);
  } catch {
    return { truncated: true, preview: "[unserializable result]" };
  }
  if (serialized === undefined || serialized.length <= HISTORY_RESULT_MAX_CHARS) return result;
  return {
    truncated: true,
    originalSize: serialized.length,
    preview: serialized.slice(0, HISTORY_RESULT_PREVIEW_CHARS),
  };
}

function loadExecutionHistory(): ExecutionHistoryItem[] {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ExecutionHistoryItem => !!item && typeof item === "object" && typeof item.id === "string")
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveExecutionHistory(history: ExecutionHistoryItem[]) {
  try {
    const compact = history.slice(0, HISTORY_LIMIT).map((item) => {
      const result = compactHistoryResult(item.result);
      return result === item.result ? item : { ...item, result };
    });
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(compact));
  } catch {
    // storage quota or disabled
  }
}

function groupWorkflowsByName(workflows: WorkbenchWorkflow[]) {
  const map = new Map<string, WorkbenchWorkflow[]>();
  workflows.forEach((wf) => {
    if (!wf.name) return;
    if (!map.has(wf.name)) map.set(wf.name, []);
    map.get(wf.name)!.push(wf);
  });
  map.forEach((list) => list.sort((a, b) => Number(b.version) - Number(a.version)));
  return map;
}

export default function WorkbenchPage() {
  const [searchParams] = useSearchParams();
  const initialWorkflow = searchParams.get("workflow") || "";
  const initialVersion = searchParams.get("version") || "";

  const workflowsQuery = useWorkbenchWorkflows();
  const workflows = workflowsQuery.data ?? EMPTY_WORKFLOWS;
  const loadingWorkflows = workflowsQuery.isPending;
  const loadError = workflowsQuery.error
    ? (workflowsQuery.error as any)?.message || "Failed to load workflows."
    : "";

  const [workflowName, setWorkflowName] = useState(initialWorkflow);
  const [workflowVersion, setWorkflowVersion] = useState(initialVersion);
  const [correlationId, setCorrelationId] = useState("");
  const [inputJsonText, setInputJsonText] = useState("{}");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runResult, setRunResult] = useState<any>(null);
  const [runDuration, setRunDuration] = useState<number | null>(null);

  const [leftTab, setLeftTab] = useState<"payload" | "snippets" | "schema">("payload");
  const [rightTab, setRightTab] = useState<"response" | "history" | "meta">("response");
  const [snippetLang, setSnippetLang] = useState<"curl" | "javascript" | "python" | "java">("curl");

  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedRequestId, setCopiedRequestId] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>(loadExecutionHistory);

  // Save execution history (skip the initial mount: nothing has changed yet)
  const historyHydratedRef = useRef(false);
  useEffect(() => {
    if (!historyHydratedRef.current) {
      historyHydratedRef.current = true;
      return;
    }
    saveExecutionHistory(executionHistory);
  }, [executionHistory]);

  // Group workflows by name and sort versions descending
  const workflowsByName = useMemo(() => groupWorkflowsByName(workflows), [workflows]);

  const workflowNames = useMemo(() => [...workflowsByName.keys()].sort(), [workflowsByName]);

  const versions = useMemo(() => {
    if (!workflowName) return EMPTY_WORKFLOWS;
    return workflowsByName.get(workflowName) || EMPTY_WORKFLOWS;
  }, [workflowName, workflowsByName]);

  const selectedWorkflow = useMemo(() => {
    if (!workflowName) return null;
    const list = workflowsByName.get(workflowName) || [];
    return list.find((v) => String(v.version) === String(workflowVersion)) || list[0] || null;
  }, [workflowName, workflowVersion, workflowsByName]);

  // Default version for a workflow: the URL-requested version if it exists, else the latest.
  const getDefaultVersion = useCallback(
    (name: string) => {
      const selectedName = String(name || "").trim();
      if (!selectedName) return "";
      const currentVersions = workflowsByName.get(selectedName) || [];
      if (currentVersions.length === 0) return "";
      if (initialVersion && currentVersions.some((v) => String(v.version) === initialVersion)) {
        return initialVersion;
      }
      return String(currentVersions[0].version);
    },
    [workflowsByName, initialVersion]
  );

  // Default input template for a workflow/version
  const getTemplateText = useCallback(
    (name: string, version: string) => {
      const selectedName = String(name || "").trim();
      if (!selectedName) return "{}";
      const currentVersions = workflowsByName.get(selectedName) || [];
      const selected = currentVersions.find((v) => String(v.version) === String(version)) || currentVersions[0];
      return JSON.stringify(selected?.input ?? {}, null, 2);
    },
    [workflowsByName]
  );

  // Once the workflow list first settles, apply the default version/template for the URL-selected workflow.
  const [initialSelectionApplied, setInitialSelectionApplied] = useState(false);
  if (!initialSelectionApplied && !workflowsQuery.isPending) {
    setInitialSelectionApplied(true);
    const nextVersion = getDefaultVersion(workflowName);
    setWorkflowVersion(nextVersion);
    setInputJsonText(getTemplateText(workflowName, nextVersion));
  }

  const handleWorkflowNameChange = useCallback(
    (value: unknown) => {
      const nextName = String(value || "");
      if (nextName === workflowName) return;
      const nextVersion = getDefaultVersion(nextName);
      setWorkflowName(nextName);
      setWorkflowVersion(nextVersion);
      setInputJsonText(getTemplateText(nextName, nextVersion));
    },
    [workflowName, getDefaultVersion, getTemplateText]
  );

  const handleWorkflowVersionChange = useCallback(
    (value: unknown) => {
      const nextVersion = String(value || "");
      if (nextVersion === workflowVersion) return;
      setWorkflowVersion(nextVersion);
      setInputJsonText(getTemplateText(workflowName, nextVersion));
    },
    [workflowName, workflowVersion, getTemplateText]
  );

  // Reset payload to schema template
  const handleResetToTemplate = useCallback(() => {
    if (selectedWorkflow?.input) {
      setInputJsonText(JSON.stringify(selectedWorkflow.input, null, 2));
    } else {
      setInputJsonText("{}");
    }
  }, [selectedWorkflow]);

  // Prettify / Format JSON
  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(inputJsonText);
      setInputJsonText(JSON.stringify(parsed, null, 2));
      setRunError("");
    } catch (err: any) {
      setRunError(`Invalid JSON syntax: ${err.message}`);
    }
  }, [inputJsonText]);

  // Execute workflow
  const handleRun = useCallback(async () => {
    const name = String(workflowName || "").trim();
    if (!name) {
      setRunError("Please select a workflow to execute.");
      return;
    }

    const payloadInput = parseJsonSafe(inputJsonText, null);
    if (payloadInput == null || Array.isArray(payloadInput) || typeof payloadInput !== "object") {
      setRunError("Input payload must be a valid JSON object.");
      return;
    }

    setRunning(true);
    setRunError("");
    const startTime = performance.now();

    try {
      const result = await executeWorkflow(name, payloadInput, {
        version: workflowVersion || 1,
        correlationId: correlationId.trim() || undefined,
        requestId: correlationId.trim() || undefined,
        waitForSeconds: 60,
      });

      const duration = Math.round(performance.now() - startTime);
      setRunResult(result);
      setRunDuration(duration);
      setRightTab("response");

      const rawStatus = String(result?.targetWorkflowStatus || result?.status || "").toUpperCase();
      const isFailed =
        result?.success === false ||
        rawStatus === "FAILED" ||
        rawStatus === "TERMINATED" ||
        rawStatus === "TIMED_OUT";

      // Add to session history
      const historyEntry: ExecutionHistoryItem = {
        id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workflowName: name,
        version: String(workflowVersion || "1"),
        correlationId: correlationId.trim() || undefined,
        status: isFailed ? "FAILED" : "SUCCESS",
        duration,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        payload: inputJsonText,
        result,
      };
      setExecutionHistory((prev) => [historyEntry, ...prev.slice(0, 19)]);
    } catch (error: any) {
      const duration = Math.round(performance.now() - startTime);
      const errMsg = error?.message || "Execution failed.";
      setRunError(errMsg);
      setRunDuration(duration);
      setRunResult({ error: errMsg, success: false });
      setRightTab("response");

      const historyEntry: ExecutionHistoryItem = {
        id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workflowName: name,
        version: String(workflowVersion || "1"),
        correlationId: correlationId.trim() || undefined,
        status: "FAILED",
        duration,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        payload: inputJsonText,
        result: { error: errMsg, success: false },
      };
      setExecutionHistory((prev) => [historyEntry, ...prev.slice(0, 19)]);
    } finally {
      setRunning(false);
    }
  }, [workflowName, inputJsonText, workflowVersion, correlationId]);

  // Global Ctrl+Enter / Cmd+Enter shortcut (listener bound once; reads latest state via ref)
  const shortcutHandlerRef = useRef<(e: KeyboardEvent) => void>(noop);
  useEffect(() => {
    shortcutHandlerRef.current = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!running) {
          e.preventDefault();
          handleRun();
        }
      }
    };
  }, [handleRun, running]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => shortcutHandlerRef.current(e);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Generate Request Snippets
  const requestUrlWithParams = useMemo(() => {
    const name = String(workflowName || "").trim() || "workflow_name";
    const baseUrl = config.apiBaseUrl || "http://localhost:8080";
    return buildExecuteUrl(
      name,
      {
        version: workflowVersion || 1,
        correlationId: correlationId.trim() || undefined,
        requestId: correlationId.trim() || undefined,
        waitForSeconds: 60,
        consistency: "DURABLE",
        returnStrategy: "TARGET_WORKFLOW",
      },
      baseUrl
    );
  }, [workflowName, workflowVersion, correlationId]);

  // Snippets are derived from a deferred copy of the payload so typing stays responsive.
  const deferredInputJsonText = useDeferredValue(inputJsonText);
  const requestPayloadObj = useMemo(() => {
    const inputPayload = parseJsonSafe(deferredInputJsonText, {});
    return wrapWorkflowExecutePayload(inputPayload);
  }, [deferredInputJsonText]);

  const curlRequest = useMemo(() => {
    const payloadText = JSON.stringify(requestPayloadObj, null, 2);
    return `curl -X 'POST' \\\n  '${requestUrlWithParams}' \\\n  -H 'accept: application/json' \\\n  -H 'Content-Type: application/json' \\\n  -d '${payloadText}'`;
  }, [requestUrlWithParams, requestPayloadObj]);

  const requestSnippets = useMemo(() => {
    const endpoint = requestUrlWithParams;
    const payloadText = JSON.stringify(requestPayloadObj, null, 2);

    return {
      curl: {
        language: "bash" as const,
        label: "cURL",
        code: curlRequest,
      },
      javascript: {
        language: "javascript" as const,
        label: "JavaScript (Fetch)",
        code: `const response = await fetch("${endpoint}", {\n  method: "POST",\n  headers: {\n    "accept": "application/json",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${payloadText})\n});\n\nconst data = await response.json();\nconsole.log(data);`,
      },
      python: {
        language: "python" as const,
        label: "Python (Requests)",
        code: `import requests\n\nurl = "${endpoint}"\npayload = ${payloadText}\nheaders = {\n    "accept": "application/json",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.post(url, json=payload, headers=headers, timeout=60)\nprint(response.status_code)\nprint(response.json())`,
      },
      java: {
        language: "java" as const,
        label: "Java (HttpClient)",
        code: `import java.net.URI;\nimport java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\n\npublic class ExecuteWorkflow {\n  public static void main(String[] args) throws Exception {\n    String json = """\n${payloadText}\n""";\n\n    HttpRequest request = HttpRequest.newBuilder()\n      .uri(URI.create("${endpoint}"))\n      .header("accept", "application/json")\n      .header("Content-Type", "application/json")\n      .POST(HttpRequest.BodyPublishers.ofString(json))\n      .build();\n\n    HttpClient client = HttpClient.newHttpClient();\n    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n\n    System.out.println(response.statusCode());\n    System.out.println(response.body());\n  }\n}`,
      },
    };
  }, [curlRequest, requestPayloadObj, requestUrlWithParams]);

  const activeSnippet = requestSnippets[snippetLang] || requestSnippets.curl;

  const formattedRunResult = useMemo(() => (runResult !== null ? formatJson(runResult) : ""), [runResult]);

  const workflowOptions = useMemo(
    () => [
      { label: "Select workflow...", value: "" },
      ...workflowNames.map((name) => ({ label: name, value: name })),
    ],
    [workflowNames]
  );

  const versionOptions = useMemo(
    () => [
      ...(versions.length === 0 ? [{ label: "No versions", value: "" }] : []),
      ...versions.map((wf) => ({
        label: `v${wf.version}`,
        value: String(wf.version),
      })),
    ],
    [versions]
  );

  const handlePayloadChange = useCallback((v: string) => setInputJsonText(v ?? "{}"), []);

  // Restore payload from history
  const handleRestoreFromHistory = (item: ExecutionHistoryItem) => {
    setWorkflowName(item.workflowName);
    if (item.version) setWorkflowVersion(item.version);
    if (item.correlationId) setCorrelationId(item.correlationId);
    setInputJsonText(typeof item.payload === "string" ? item.payload : "{}");
    setLeftTab("payload");
  };

  // Status computation
  const isTerminalRun = runResult !== null;
  const rawStatus = String(runResult?.targetWorkflowStatus || runResult?.status || "").toUpperCase();
  const isSuccess =
    isTerminalRun &&
    runResult?.success !== false &&
    rawStatus !== "FAILED" &&
    rawStatus !== "TERMINATED" &&
    rawStatus !== "TIMED_OUT" &&
    !runResult?.error;
  const requestId =
    runResult?.requestId ||
    runResult?.targetWorkflowId ||
    runResult?.workflowId ||
    (isTerminalRun ? "N/A" : null);

  return (
    <div className={styles.container}>
      {/* Top Action Bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarControls}>
          <div className={styles.workflowSelectWrap}>
            <WeaverSelectField
              label="Target Workflow"
              value={workflowName}
              onChange={handleWorkflowNameChange}
              placeholder="Select workflow..."
              options={workflowOptions}
              disabled={loadingWorkflows || running}
            />
          </div>

          <div className={styles.versionSelectWrap}>
            <WeaverSelectField
              label="Version"
              value={workflowVersion}
              onChange={handleWorkflowVersionChange}
              disabled={!workflowName || versions.length === 0 || running}
              options={versionOptions}
            />
          </div>

          <div className={styles.correlationInputWrap}>
            <WeaverTextField
              label="Correlation ID"
              placeholder="Optional trace ID"
              value={correlationId}
              onChange={(value) => setCorrelationId(value)}
              disabled={running}
              clearable
            />
          </div>
        </div>

        <div className={styles.topBarActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleFormatJson}
            title="Format input JSON"
            disabled={running}
          >
            <FiCode size={14} />
            <span>Format</span>
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleResetToTemplate}
            title="Reset to workflow schema template"
            disabled={!workflowName || running}
          >
            <FiRotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            className={styles.btnExecute}
            onClick={handleRun}
            disabled={running || loadingWorkflows || !workflowName}
          >
            {running ? (
              <CircularProgress size={14} color="inherit" thickness={5} />
            ) : (
              <FiPlay size={14} />
            )}
            <span>{running ? "Executing..." : "Execute"}</span>
            <span className={styles.shortcutBadge}>Ctrl ↵</span>
          </button>
        </div>
      </div>

      {/* Inline Feedback Alerts */}
      {loadError ? (
        <div className={`${styles.inlineAlert} ${styles.warning}`}>
          <FiAlertCircle size={16} />
          <span>{loadError}</span>
        </div>
      ) : null}

      {runError ? (
        <div className={`${styles.inlineAlert} ${styles.error}`}>
          <FiAlertCircle size={16} />
          <span>{runError}</span>
        </div>
      ) : null}

      {/* Main Dual-Pane Workspace */}
      <div className={styles.mainGrid}>
        {/* Left Pane: Request Studio */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTabs}>
              <button
                type="button"
                className={`${styles.tabButton} ${leftTab === "payload" ? styles.active : ""}`}
                onClick={() => setLeftTab("payload")}
              >
                <FiCode size={14} />
                <span>Input Payload (JSON)</span>
              </button>

              <button
                type="button"
                className={`${styles.tabButton} ${leftTab === "snippets" ? styles.active : ""}`}
                onClick={() => setLeftTab("snippets")}
              >
                <FiTerminal size={14} />
                <span>Code Snippets</span>
              </button>

              <button
                type="button"
                className={`${styles.tabButton} ${leftTab === "schema" ? styles.active : ""}`}
                onClick={() => setLeftTab("schema")}
              >
                <FiFileText size={14} />
                <span>Schema Guide</span>
              </button>
            </div>

            <div className={styles.panelActions}>
              {leftTab === "payload" ? (
                <button
                  type="button"
                  className={styles.actionIconBtn}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inputJsonText);
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 1200);
                    } catch {}
                  }}
                  title="Copy payload"
                >
                  {copiedPayload ? <FiCheck size={13} color="var(--color-status-success)" /> : <FiCopy size={13} />}
                  <span>{copiedPayload ? "Copied" : "Copy"}</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.panelBody}>
            {leftTab === "payload" ? (
              <div className={styles.editorContainer}>
                <WeaverCodeEditor
                  language="json"
                  value={inputJsonText}
                  onChange={handlePayloadChange}
                  height="100%"
                  options={PAYLOAD_EDITOR_OPTIONS}
                />
              </div>
            ) : null}

            {leftTab === "snippets" ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div className={styles.subTabBar}>
                  {(["curl", "javascript", "python", "java"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`${styles.subTabBtn} ${snippetLang === lang ? styles.active : ""}`}
                      onClick={() => setSnippetLang(lang)}
                    >
                      {lang === "curl" && <FiTerminal size={13} />}
                      {lang === "javascript" && <FiCode size={13} />}
                      {lang === "python" && <FiCode size={13} />}
                      {lang === "java" && <FiLayers size={13} />}
                      <span>{requestSnippets[lang].label}</span>
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    className={styles.actionIconBtn}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(activeSnippet.code);
                        setCopiedSnippet(true);
                        setTimeout(() => setCopiedSnippet(false), 1200);
                      } catch {}
                    }}
                  >
                    {copiedSnippet ? <FiCheck size={13} color="var(--color-status-success)" /> : <FiCopy size={13} />}
                    <span>{copiedSnippet ? "Copied" : "Copy Snippet"}</span>
                  </button>
                </div>
                <div className={styles.editorContainer}>
                  <WeaverCodeEditor
                    language={activeSnippet.language}
                    value={activeSnippet.code}
                    onChange={noop}
                    height="100%"
                    options={READONLY_EDITOR_OPTIONS}
                  />
                </div>
              </div>
            ) : null}

            {leftTab === "schema" ? (
              <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
                {selectedWorkflow ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-fg-default)" }}>
                        {selectedWorkflow.name} (v{selectedWorkflow.version})
                      </div>
                      {selectedWorkflow.description ? (
                        <div style={{ fontSize: 13, color: "var(--color-fg-muted)", marginTop: 4 }}>
                          {selectedWorkflow.description}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-fg-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Expected Input Parameters
                    </div>

                    {selectedWorkflow.input && Object.keys(selectedWorkflow.input).length > 0 ? (
                      <table className={styles.schemaTable}>
                        <thead>
                          <tr>
                            <th>Parameter Key</th>
                            <th>Default / Sample Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedWorkflow.input).map(([key, val]) => (
                            <tr key={key}>
                              <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{key}</td>
                              <td style={{ fontFamily: "monospace", color: "var(--color-fg-muted)" }}>
                                {typeof val === "object" ? JSON.stringify(val) : String(val ?? "null")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--color-fg-muted)", fontStyle: "italic" }}>
                        No predefined input parameters recorded in workflow metadata.
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <FiInfo className={styles.emptyIcon} />
                    <div className={styles.emptyTitle}>Select a Workflow</div>
                    <div className={styles.emptySubtitle}>
                      Choose a workflow from the top bar to inspect its input schema and documentation.
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Pane: Response & Diagnostics */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTabs}>
              <button
                type="button"
                className={`${styles.tabButton} ${rightTab === "response" ? styles.active : ""}`}
                onClick={() => setRightTab("response")}
              >
                <FiTerminal size={14} />
                <span>Response</span>
              </button>

              <button
                type="button"
                className={`${styles.tabButton} ${rightTab === "history" ? styles.active : ""}`}
                onClick={() => setRightTab("history")}
              >
                <FiClock size={14} />
                <span>Recent Runs</span>
                {executionHistory.length > 0 ? (
                  <span className={styles.tabBadge}>{executionHistory.length}</span>
                ) : null}
              </button>

              <button
                type="button"
                className={`${styles.tabButton} ${rightTab === "meta" ? styles.active : ""}`}
                onClick={() => setRightTab("meta")}
              >
                <FiInfo size={14} />
                <span>Diagnostics</span>
              </button>
            </div>

            <div className={styles.panelActions}>
              {rightTab === "response" && runResult ? (
                <button
                  type="button"
                  className={styles.actionIconBtn}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(formattedRunResult);
                      setCopiedResponse(true);
                      setTimeout(() => setCopiedResponse(false), 1200);
                    } catch {}
                  }}
                  title="Copy formatted JSON response"
                >
                  {copiedResponse ? <FiCheck size={13} color="var(--color-status-success)" /> : <FiCopy size={13} />}
                  <span>{copiedResponse ? "Copied" : "Copy JSON"}</span>
                </button>
              ) : null}

              {rightTab === "history" && executionHistory.length > 0 ? (
                <button
                  type="button"
                  className={styles.actionIconBtn}
                  onClick={() => setExecutionHistory([])}
                  title="Clear history"
                >
                  <FiTrash2 size={13} />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Status Diagnostic Strip */}
          <div className={styles.statusBanner}>
            <div className={styles.metaGroup}>
              {running ? (
                <span className={`${styles.statusPill} ${styles.running}`}>
                  <CircularProgress size={10} color="inherit" thickness={5} />
                  Running
                </span>
              ) : !isTerminalRun ? (
                <span className={`${styles.statusPill} ${styles.idle}`}>
                  Idle
                </span>
              ) : isSuccess ? (
                <span className={`${styles.statusPill} ${styles.success}`}>
                  <FiCheckCircle size={12} />
                  Success
                </span>
              ) : (
                <span className={`${styles.statusPill} ${styles.failed}`}>
                  <FiAlertCircle size={12} />
                  Failed
                </span>
              )}

              {runDuration !== null ? (
                <div className={styles.metaItem}>
                  <FiClock size={12} />
                  <span>Duration:</span>
                  <span className={styles.metaValue}>{runDuration}ms</span>
                </div>
              ) : null}
            </div>

            {requestId && requestId !== "N/A" ? (
              <div className={styles.metaGroup}>
                <span style={{ fontSize: 12, color: "var(--color-fg-muted)" }}>Request ID:</span>
                <span
                  className={styles.copyChip}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(requestId);
                      setCopiedRequestId(true);
                      setTimeout(() => setCopiedRequestId(false), 1200);
                    } catch {}
                  }}
                  title="Click to copy Request ID"
                >
                  {copiedRequestId ? <FiCheck size={11} color="var(--color-status-success)" /> : <FiCopy size={11} />}
                  <span style={{ fontFamily: "monospace" }}>{requestId}</span>
                </span>
              </div>
            ) : null}
          </div>

          <div className={styles.panelBody}>
            {rightTab === "response" ? (
              runResult !== null ? (
                <div className={styles.editorContainer}>
                  <WeaverCodeEditor
                    language="json"
                    value={formattedRunResult}
                    onChange={noop}
                    height="100%"
                    options={READONLY_EDITOR_OPTIONS}
                  />
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <FiPlay className={styles.emptyIcon} />
                  <div className={styles.emptyTitle}>Ready for Execution</div>
                  <div className={styles.emptySubtitle}>
                    Select a workflow, adjust the input JSON parameters, and click <strong>Execute</strong> or press{" "}
                    <strong>Ctrl+Enter</strong> to run.
                  </div>
                </div>
              )
            ) : null}

            {rightTab === "history" ? (
              executionHistory.length > 0 ? (
                <div className={styles.historyList}>
                  {executionHistory.map((item) => (
                    <div key={item.id} className={styles.historyItem}>
                      <div className={styles.historyDetails}>
                        <div className={styles.historyTitleRow}>
                          <span
                            className={`${styles.statusPill} ${
                              item.status === "SUCCESS" ? styles.success : styles.failed
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className={styles.historyWorkflowName}>
                            {item.workflowName} (v{item.version})
                          </span>
                        </div>
                        <div className={styles.historyMetaRow}>
                          <span>{item.timestamp}</span>
                          <span>•</span>
                          <span>{item.duration}ms</span>
                          {item.correlationId ? (
                            <>
                              <span>•</span>
                              <span style={{ fontFamily: "monospace" }}>{item.correlationId}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.historyActions}>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          onClick={() => handleRestoreFromHistory(item)}
                          title="Restore this payload to the Request Studio"
                        >
                          <FiRotateCcw size={12} />
                          <span>Load Payload</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <FiClock className={styles.emptyIcon} />
                  <div className={styles.emptyTitle}>No Execution History</div>
                  <div className={styles.emptySubtitle}>
                    Runs executed during this session will be logged here with their duration, status, and payload.
                  </div>
                </div>
              )
            ) : null}

            {rightTab === "meta" ? (
              <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-fg-default)", marginBottom: 12 }}>
                  Execution Context & Metadata
                </div>
                <table className={styles.schemaTable}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, width: 140 }}>Target Workflow</td>
                      <td>{workflowName || "None selected"}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Version</td>
                      <td>{workflowVersion ? `v${workflowVersion}` : "N/A"}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Correlation ID</td>
                      <td style={{ fontFamily: "monospace" }}>{correlationId || "None"}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>API Endpoint</td>
                      <td style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{requestUrlWithParams}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Last Status</td>
                      <td>
                        {runResult ? (
                          <span
                            className={`${styles.statusPill} ${
                              isSuccess ? styles.success : styles.failed
                            }`}
                          >
                            {isSuccess ? "SUCCESS" : "FAILED"}
                          </span>
                        ) : (
                          "Idle"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Last Latency</td>
                      <td>{runDuration !== null ? `${runDuration} ms` : "N/A"}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Request ID</td>
                      <td style={{ fontFamily: "monospace" }}>{requestId || "N/A"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
