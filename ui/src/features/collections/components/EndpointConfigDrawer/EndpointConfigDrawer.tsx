import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  Code2,
  SlidersHorizontal,
  Braces,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  CircleDot,
} from "lucide-react";
import {
  createCollectionEndpoint,
  updateCollectionEndpoint,
  deleteCollectionEndpoint,
} from "@/features/collections/services/apiCollectionsApi";
import { useCollectionEndpoint } from "@/features/collections/hooks/useCollections";
import { WeaverSelectField } from "@/components/common/fields";
import { WeaverCodeEditor } from "@/components/common/editors";
import { WeaverButton } from "@/components/common/buttons";
import { getErrorMessage } from "@/utils/error";
import styles from "./EndpointConfigDrawer.module.css";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const BODY_CONTENT_TYPES = [
  "application/json",
  "application/xml",
  "text/plain",
  "multipart/form-data",
  "application/x-www-form-urlencoded",
];

const toPrettyJson = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "{}");
  }
};

const parseJsonOrFallback = (text: string, fallback: unknown): unknown => {
  const value = String(text ?? "").trim();
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const validateJsonText = (text: string): string => {
  const value = String(text ?? "").trim();
  if (!value) return "";
  try {
    JSON.parse(value);
    return "";
  } catch (err: any) {
    return err?.message ? `Invalid JSON: ${err.message}` : "Invalid JSON syntax.";
  }
};

const inferContentType = (headers: unknown): string => {
  if (!headers || typeof headers !== "object") return "application/json";
  const entries = Object.entries(headers as Record<string, unknown>);
  const pair = entries.find(([k]) => String(k || "").toLowerCase() === "content-type");
  return String(pair?.[1] || "application/json").trim();
};

export interface EndpointConfigDrawerProps {
  open: boolean;
  collectionId: string;
  endpoint: any | null;
  onClose: () => void;
  onSaved: (updatedEndpoint: any) => void;
  onDeleted?: () => void;
  onNotify?: (payload: { severity?: "error" | "success"; message: string }) => void;
}

type DrawerTab = "body" | "headers" | "query";

export const EndpointConfigDrawer: React.FC<EndpointConfigDrawerProps> = ({
  open,
  collectionId,
  endpoint,
  onClose,
  onSaved,
  onDeleted,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>("body");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // Form Draft
  const [name, setName] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [queryText, setQueryText] = useState("{}");
  const [headersText, setHeadersText] = useState("{}");
  const [bodyText, setBodyText] = useState("{}");
  const [bodyContentType, setBodyContentType] = useState("application/json");

  // Initial State Reference for Dirty Tracking
  const initialStateRef = useRef({
    name: "",
    method: "GET" as HttpMethod,
    url: "",
    queryText: "{}",
    headersText: "{}",
    bodyText: "{}",
    bodyContentType: "application/json",
  });

  const [jsonErrors, setJsonErrors] = useState({
    queryText: "",
    headersText: "",
    bodyText: "",
  });

  const endpointId = String(endpoint?.id || endpoint?.endpointId || "").trim();
  const isCreateMode = !endpointId;

  // Fetch full details if available to ensure complete headers/body
  const { data: endpointResponse, isPending: fetchingDetails } = useCollectionEndpoint(
    collectionId,
    endpointId,
    { enabled: Boolean(open && collectionId && endpointId) }
  );

  const applyEndpointState = useCallback((raw: any) => {
    if (!raw) return;
    const initialName = raw.name || raw.endpointName || "";
    const rawMethod = String(
      raw?.config?.method || raw?.method || raw?.request?.method || "GET"
    ).toUpperCase() as HttpMethod;
    const initialMethod = HTTP_METHODS.includes(rawMethod) ? rawMethod : "GET";
    const initialUrl = raw?.config?.url || raw?.url || raw?.request?.url || "";

    const headers = raw?.config?.headers || raw?.headers || raw?.request?.headers || {};
    const query = raw?.config?.query || raw?.query || raw?.request?.query || {};
    const body = raw?.config?.body || raw?.body || raw?.request?.body || {};

    const formattedHeaders = toPrettyJson(headers);
    const formattedQuery = toPrettyJson(query);
    const formattedBody = toPrettyJson(body);
    const contentType = inferContentType(headers);

    setName(initialName);
    setMethod(initialMethod);
    setUrl(initialUrl);
    setHeadersText(formattedHeaders);
    setQueryText(formattedQuery);
    setBodyText(formattedBody);
    setBodyContentType(contentType);
    setJsonErrors({ queryText: "", headersText: "", bodyText: "" });

    // Set initial tab based on method
    if (initialMethod === "GET" || initialMethod === "DELETE") {
      setActiveTab("headers");
    } else {
      setActiveTab("body");
    }

    initialStateRef.current = {
      name: initialName,
      method: initialMethod,
      url: initialUrl,
      headersText: formattedHeaders,
      queryText: formattedQuery,
      bodyText: formattedBody,
      bodyContentType: contentType,
    };
  }, []);

  // Initial populate from passed endpoint prop or reset for create
  useEffect(() => {
    if (endpoint) {
      applyEndpointState(endpoint);
    } else {
      setName("");
      setMethod("GET");
      setUrl("");
      setHeadersText("{}");
      setQueryText("{}");
      setBodyText("{}");
      setBodyContentType("application/json");
      setJsonErrors({ queryText: "", headersText: "", bodyText: "" });
      setActiveTab("headers");
      initialStateRef.current = {
        name: "",
        method: "GET",
        url: "",
        queryText: "{}",
        headersText: "{}",
        bodyText: "{}",
        bodyContentType: "application/json",
      };
    }
  }, [endpoint, applyEndpointState]);

  // Sync if fresh response arrives from server
  useEffect(() => {
    if (!endpointResponse) return;
    const body = (endpointResponse as any)?.data ?? {};
    const data = body?.data ?? body ?? null;
    if (data && typeof data === "object") {
      applyEndpointState(data);
    }
  }, [endpointResponse, applyEndpointState]);

  // Extract Tags
  const endpointTags = useMemo(() => {
    const raw = endpoint?.tags || endpoint?.config?.tags || [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }, [endpoint]);

  // Dirty State calculation
  const isDirty = useMemo(() => {
    return (
      name !== initialStateRef.current.name ||
      method !== initialStateRef.current.method ||
      url !== initialStateRef.current.url ||
      queryText !== initialStateRef.current.queryText ||
      headersText !== initialStateRef.current.headersText ||
      bodyText !== initialStateRef.current.bodyText ||
      bodyContentType !== initialStateRef.current.bodyContentType
    );
  }, [name, method, url, queryText, headersText, bodyText, bodyContentType]);

  // Real-time JSON validation
  const handleJsonChange = (
    field: "queryText" | "headersText" | "bodyText",
    value: string
  ) => {
    if (field === "queryText") setQueryText(value);
    if (field === "headersText") setHeadersText(value);
    if (field === "bodyText") setBodyText(value);

    setJsonErrors((prev) => ({
      ...prev,
      [field]: validateJsonText(value),
    }));
  };

  // JSON Pretty-Print action
  const handleFormatJson = (field: "queryText" | "headersText" | "bodyText") => {
    const current =
      field === "queryText"
        ? queryText
        : field === "headersText"
        ? headersText
        : bodyText;
    try {
      const parsed = JSON.parse(current);
      const pretty = JSON.stringify(parsed, null, 2);
      if (field === "queryText") setQueryText(pretty);
      if (field === "headersText") setHeadersText(pretty);
      if (field === "bodyText") setBodyText(pretty);
      setJsonErrors((prev) => ({ ...prev, [field]: "" }));
    } catch {
      setJsonErrors((prev) => ({
        ...prev,
        [field]: "Cannot format: JSON has syntax errors.",
      }));
    }
  };

  const handleCopyUrl = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 1800);
  };

  // Count badges
  const headerCount = useMemo(() => {
    try {
      const parsed = JSON.parse(headersText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.keys(parsed).length;
      }
    } catch {}
    return null;
  }, [headersText]);

  const queryCount = useMemo(() => {
    try {
      const parsed = JSON.parse(queryText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.keys(parsed).length;
      }
    } catch {}
    return null;
  }, [queryText]);

  const saveEndpoint = async () => {
    if (!name.trim()) {
      onNotify?.({ severity: "error", message: "Endpoint name is required." });
      return;
    }

    const errors = {
      queryText: validateJsonText(queryText),
      headersText: validateJsonText(headersText),
      bodyText: validateJsonText(bodyText),
    };
    setJsonErrors(errors);

    // Switch tab to first offending error if present
    if (errors.bodyText) setActiveTab("body");
    else if (errors.headersText) setActiveTab("headers");
    else if (errors.queryText) setActiveTab("query");

    if (errors.queryText || errors.headersText || errors.bodyText) {
      onNotify?.({
        severity: "error",
        message: "Please fix JSON syntax errors before saving.",
      });
      return;
    }

    if (!isCreateMode && !endpointId) {
      onNotify?.({ severity: "error", message: "Invalid endpoint ID." });
      return;
    }

    const parsedHeaders = parseJsonOrFallback(headersText, {});
    const contentType = String(bodyContentType || "").trim();
    const finalHeaders =
      contentType && typeof parsedHeaders === "object" && !Array.isArray(parsedHeaders)
        ? { ...(parsedHeaders as Record<string, unknown>), "Content-Type": contentType }
        : parsedHeaders;

    const existingTags = endpoint?.tags || endpoint?.config?.tags || [];
    const payload = {
      name: name.trim(),
      description: endpoint?.description || "",
      connection: endpoint?.connection || null,
      tags: existingTags,
      config: {
        ...(endpoint?.config || {}),
        tags: existingTags,
        method: method.toUpperCase(),
        url: url.trim(),
        query: parseJsonOrFallback(queryText, {}),
        headers: finalHeaders,
        body: parseJsonOrFallback(bodyText, {}),
      },
    };

    setSubmitting(true);
    try {
      let savedResult: any;
      if (isCreateMode) {
        const response = await createCollectionEndpoint(collectionId, payload as any);
        const resBody = (response as any)?.data ?? {};
        savedResult = resBody?.data ?? resBody ?? payload;
        onNotify?.({
          severity: "success",
          message: `Endpoint "${name.trim()}" created successfully.`,
        });
      } else {
        const response = await updateCollectionEndpoint(endpointId, payload as any);
        const resBody = (response as any)?.data ?? {};
        savedResult = resBody?.data ?? resBody ?? payload;
        onNotify?.({
          severity: "success",
          message: `Endpoint "${name.trim()}" updated successfully.`,
        });
      }

      initialStateRef.current = {
        name: payload.name,
        method: method,
        url: payload.config.url,
        headersText: toPrettyJson(finalHeaders),
        queryText: toPrettyJson(payload.config.query),
        bodyText: toPrettyJson(payload.config.body),
        bodyContentType: contentType,
      };

      onSaved({
        ...(endpoint || {}),
        ...savedResult,
        name: payload.name,
        description: payload.description,
        tags: existingTags,
        method: payload.config.method,
        url: payload.config.url,
        config: payload.config,
      });
      onClose();
    } catch (err) {
      onNotify?.({
        severity: "error",
        message: getErrorMessage(
          err,
          isCreateMode ? "Failed to create endpoint." : "Failed to update endpoint configuration."
        ),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEndpoint = async () => {
    if (!endpointId) return;
    setDeleting(true);
    try {
      await deleteCollectionEndpoint(endpointId);
      onNotify?.({
        severity: "success",
        message: `Endpoint "${name.trim() || "Endpoint"}" deleted successfully.`,
      });
      if (onDeleted) {
        onDeleted();
      } else {
        onSaved(null);
      }
      onClose();
    } catch (err) {
      onNotify?.({
        severity: "error",
        message: getErrorMessage(err, "Failed to delete endpoint."),
      });
    } finally {
      setDeleting(false);
    }
  };

  // Keyboard shortcuts (Escape to close, Ctrl+S / Cmd+S to save)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (!submitting && name.trim()) {
          void saveEndpoint();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    submitting,
    name,
    queryText,
    headersText,
    bodyText,
    bodyContentType,
    method,
    url,
    onClose,
  ]);

  // Lock background collections page scrolling while drawer is open
  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  if (!open) return null;

  const methodClass =
    method === "GET"
      ? styles.methodGet
      : method === "POST"
      ? styles.methodPost
      : method === "PUT"
      ? styles.methodPut
      : method === "PATCH"
      ? styles.methodPatch
      : styles.methodDelete;

  const contentTypeOptions = BODY_CONTENT_TYPES.map((ct) => ({
    label: ct,
    value: ct,
  }));

  const hasErrors = Boolean(
    jsonErrors.queryText || jsonErrors.headersText || jsonErrors.bodyText
  );

  const drawerContent = (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      onWheel={(e) => {
        // Prevent scroll wheel event leakage to underlying window
        e.stopPropagation();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isCreateMode ? "New Endpoint Configuration" : "Edit Endpoint Configuration"}
    >
      <div
        className={styles.drawer}
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Pinned Top: Header + Integrated Request Command Bar */}
        <div className={styles.pinnedTop}>
          {/* Header Row */}
          <div className={styles.headerTopRow}>
            <div className={styles.headerMeta}>
              <div className={styles.breadcrumbRow}>
                <span className={styles.breadcrumb}>
                  {isCreateMode ? "New Endpoint" : "Endpoint Configuration"}
                </span>
                {endpointTags.map((tag) => (
                  <span key={tag} className={styles.tagBadge}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className={styles.nameInputWrapper}>
                <input
                  type="text"
                  className={styles.nameInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isCreateMode ? "e.g. Get User Profile" : "Endpoint Name (required)"}
                  disabled={submitting}
                  aria-label="Endpoint Name"
                />
              </div>
            </div>

            <div className={styles.headerActions}>
              {isDirty && (
                <span className={styles.unsavedPill} title="You have unsaved changes">
                  <span className={styles.unsavedDot} />
                  Unsaved
                </span>
              )}
              {fetchingDetails && (
                <Loader2 size={15} className="spin" style={{ color: "var(--color-fg-muted)" }} />
              )}
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleCopyUrl}
                disabled={!url}
                title={urlCopied ? "URL Copied to clipboard!" : "Copy URL"}
                aria-label="Copy URL"
              >
                {urlCopied ? <Check size={16} style={{ color: "#4ade80" }} /> : <Copy size={16} />}
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onClose}
                disabled={submitting}
                aria-label="Close configuration drawer (Esc)"
                title="Close drawer (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Unified Request Bar (Method Selector + URL Input) */}
          <div className={styles.requestBarWrapper}>
            <div className={styles.requestBar}>
              <select
                className={`${styles.methodSelect} ${methodClass}`}
                value={method}
                onChange={(e) => {
                  const nextMethod = e.target.value as HttpMethod;
                  setMethod(nextMethod);
                  if (nextMethod === "POST" || nextMethod === "PUT" || nextMethod === "PATCH") {
                    setActiveTab("body");
                  }
                }}
                disabled={submitting}
                title="HTTP Method"
                aria-label="HTTP Method"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className={styles.urlInput}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.domain.com/v1/resource or /api/v1/{id}"
                disabled={submitting}
                aria-label="Request URL / Path"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Postman / Insomnia Style Horizontal Workbench Tabs */}
          <div className={styles.tabsBar} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "body"}
              className={`${styles.tabBtn} ${activeTab === "body" ? styles.activeTabBtn : ""}`}
              onClick={() => setActiveTab("body")}
            >
              <Braces size={14} />
              <span>Request Body</span>
              {jsonErrors.bodyText && (
                <span className={styles.tabErrorIndicator} title="Validation error in request body" />
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "headers"}
              className={`${styles.tabBtn} ${activeTab === "headers" ? styles.activeTabBtn : ""}`}
              onClick={() => setActiveTab("headers")}
            >
              <Code2 size={14} />
              <span>Headers</span>
              {headerCount !== null && (
                <span className={styles.tabCountBadge}>{headerCount}</span>
              )}
              {jsonErrors.headersText && (
                <span className={styles.tabErrorIndicator} title="Validation error in headers" />
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "query"}
              className={`${styles.tabBtn} ${activeTab === "query" ? styles.activeTabBtn : ""}`}
              onClick={() => setActiveTab("query")}
            >
              <SlidersHorizontal size={14} />
              <span>Query Parameters</span>
              {queryCount !== null && (
                <span className={styles.tabCountBadge}>{queryCount}</span>
              )}
              {jsonErrors.queryText && (
                <span className={styles.tabErrorIndicator} title="Validation error in query parameters" />
              )}
            </button>
          </div>
        </div>

        {/* Workbench Content Area */}
        <div className={styles.body}>
          {/* 1. Request Body Tab */}
          {activeTab === "body" && (
            <div className={styles.formGroup}>
              <div className={styles.toolbarRow}>
                <div className={styles.toolbarLeft}>
                  <WeaverSelectField
                    label="Content-Type"
                    value={bodyContentType}
                    options={contentTypeOptions}
                    onChange={(val) => setBodyContentType(String(val))}
                    disabled={submitting}
                    size="small"
                    sx={{ minWidth: 200 }}
                  />
                </div>
                <button
                  type="button"
                  className={styles.formatBtn}
                  onClick={() => handleFormatJson("bodyText")}
                  title="Prettify JSON body payload"
                >
                  <Sparkles size={12} />
                  <span>Format JSON</span>
                </button>
              </div>

              <div
                className={`${styles.codeEditorWrapper} ${
                  jsonErrors.bodyText ? styles.codeEditorWrapperError : ""
                }`}
              >
                <WeaverCodeEditor
                  language="json"
                  value={bodyText}
                  onChange={(val) => handleJsonChange("bodyText", val ?? "")}
                  height="360px"
                  options={{
                    minimap: { enabled: false },
                    wordWrap: "on",
                    lineNumbers: "on",
                  }}
                />
              </div>

              {jsonErrors.bodyText && (
                <div className={styles.errorBanner} role="alert">
                  <AlertCircle size={14} />
                  <span>{jsonErrors.bodyText}</span>
                </div>
              )}
            </div>
          )}

          {/* 2. HTTP Headers Tab */}
          {activeTab === "headers" && (
            <div className={styles.formGroup}>
              <div className={styles.toolbarRow}>
                <span className={styles.sectionSubtitle}>
                  Key-Value JSON object of request headers sent to the remote endpoint
                </span>
                <button
                  type="button"
                  className={styles.formatBtn}
                  onClick={() => handleFormatJson("headersText")}
                  title="Prettify JSON headers"
                >
                  <Sparkles size={12} />
                  <span>Format JSON</span>
                </button>
              </div>

              <div
                className={`${styles.codeEditorWrapper} ${
                  jsonErrors.headersText ? styles.codeEditorWrapperError : ""
                }`}
              >
                <WeaverCodeEditor
                  language="json"
                  value={headersText}
                  onChange={(val) => handleJsonChange("headersText", val ?? "")}
                  height="360px"
                  options={{
                    minimap: { enabled: false },
                    wordWrap: "on",
                    lineNumbers: "on",
                  }}
                />
              </div>

              {jsonErrors.headersText && (
                <div className={styles.errorBanner} role="alert">
                  <AlertCircle size={14} />
                  <span>{jsonErrors.headersText}</span>
                </div>
              )}
            </div>
          )}

          {/* 3. Query Parameters Tab */}
          {activeTab === "query" && (
            <div className={styles.formGroup}>
              <div className={styles.toolbarRow}>
                <span className={styles.sectionSubtitle}>
                  Key-Value JSON object appended to the URL query string
                </span>
                <button
                  type="button"
                  className={styles.formatBtn}
                  onClick={() => handleFormatJson("queryText")}
                  title="Prettify JSON query parameters"
                >
                  <Sparkles size={12} />
                  <span>Format JSON</span>
                </button>
              </div>

              <div
                className={`${styles.codeEditorWrapper} ${
                  jsonErrors.queryText ? styles.codeEditorWrapperError : ""
                }`}
              >
                <WeaverCodeEditor
                  language="json"
                  value={queryText}
                  onChange={(val) => handleJsonChange("queryText", val ?? "")}
                  height="360px"
                  options={{
                    minimap: { enabled: false },
                    wordWrap: "on",
                    lineNumbers: "on",
                  }}
                />
              </div>

              {jsonErrors.queryText && (
                <div className={styles.errorBanner} role="alert">
                  <AlertCircle size={14} />
                  <span>{jsonErrors.queryText}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className={styles.footer}>
          <div className={styles.footerStatus}>
            {!isCreateMode && (
              <WeaverButton
                mode="delete"
                variant="outlined"
                color="error"
                size="small"
                onAction={handleDeleteEndpoint}
                disabled={submitting || deleting}
                loading={deleting}
                loadingLabel="Deleting..."
                holdLabel="Hold to delete..."
              >
                Delete Endpoint
              </WeaverButton>
            )}

            <div className={styles.statusIndicator}>
              {isDirty ? (
                <>
                  <CircleDot size={13} style={{ color: "#fbbf24" }} />
                  <span>You have unsaved changes</span>
                </>
              ) : (
                <>
                  <Check size={14} className={styles.savedIcon} />
                  <span>{isCreateMode ? "Ready to create" : "All changes saved"}</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.footerButtons}>
            <WeaverButton
              variant="outlined"
              color="inherit"
              disabled={submitting || deleting}
              onClick={onClose}
            >
              Cancel
            </WeaverButton>

            <WeaverButton
              mode={isCreateMode ? "save" : "update"}
              color="primary"
              variant="contained"
              disabled={submitting || deleting || !name.trim() || hasErrors}
              loading={submitting}
              loadingLabel={isCreateMode ? "Creating..." : "Saving..."}
              onClick={() => {
                void saveEndpoint();
              }}
              title={
                hasErrors
                  ? "Please fix JSON syntax errors before saving"
                  : !name.trim()
                  ? "Endpoint name is required"
                  : isCreateMode
                  ? "Create endpoint"
                  : "Save endpoint configuration (Ctrl+S)"
              }
            >
              <span>{isCreateMode ? "Create Endpoint" : "Save Changes"}</span>
              {!isCreateMode && <span className={styles.shortcutHint}>Ctrl+S</span>}
            </WeaverButton>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(drawerContent, document.body);
  }

  return drawerContent;
};

export default EndpointConfigDrawer;
