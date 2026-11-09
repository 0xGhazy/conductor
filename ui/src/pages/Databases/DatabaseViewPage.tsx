import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CircularProgress, Collapse } from "@mui/material";
import {
  FiDatabase,
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiChevronDown,
  FiSliders,
  FiRefreshCw,
  FiPlus,
  FiTerminal,
  FiCheck,
  FiCopy,
} from "react-icons/fi";
import { WeaverButton } from "@/components/common/buttons";
import {
  WeaverRelatedTable,
  type WeaverRelatedTableColumn,
} from "@/components/common/data";
import {
  WeaverNameField,
  WeaverNumberField,
  WeaverSelectField,
  WeaverTextField,
  type WeaverSelectOption,
  type NameValidationResult,
  type NameValidationStatus,
  type NameValidationState,
} from "@/components/common/fields";
import { useWeaverNotification } from "@/components/common/notifications";
import { getErrorMessage } from "@/utils/error";
import {
  formatExactDateTime,
  formatTooltipDateTime,
  formatRelativeTime,
} from "@/utils/dateTime";
import { getInitials } from "@/utils/user";
import { getAuditFields } from "@/utils/audit";
import {
  createDatasource,
  datasourceKeys,
  deleteDatasource,
  fetchDatasourceByName,
  updateDatasource,
  pingDatasource,
  testDatasourceConnection,
  toStatusDetails,
  useDatasource,
} from "@/features/databases";
import {
  buildEmptyDatasource,
  buildDatasourcePayload,
  getDatasourceTypes,
  normalizeDatasource,
  validateDatasource,
} from "@/features/databases";
import type { DatasourceStatusDetails } from "@/features/databases";
import type { QueryDefinition } from "@/features/queries";

import styles from "./DatabaseViewPage.module.css";
import "@/styles/definitionPages.css";

const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const CREATE_HYDRATION_KEY = "__create__";
const EMPTY_QUERIES: QueryDefinition[] = [];
const getQueryRowId = (r: { __rowId: string }) => r.__rowId;
const RELATED_QUERY_PAGE_SIZES = [5, 10, 25];

export interface DatabaseViewPageProps {
  isCreateMode?: boolean;
  onBack?: () => void;
}

export default function DatabaseViewPage({
  isCreateMode: propIsCreateMode,
  onBack,
}: DatabaseViewPageProps = {}) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isCreateMode = propIsCreateMode ?? !id;
  const notify = useWeaverNotification();

  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string | null>(null);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState(false);

  const [form, setForm] = useState<any>(buildEmptyDatasource());
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [statusDetails, setStatusDetails] = useState<DatasourceStatusDetails | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [queriesExpanded, setQueriesExpanded] = useState(true);
  const initialNameRef = useRef("");
  const [nameValidationStatus, setNameValidationStatus] = useState<NameValidationStatus>("idle");
  // Last loaded/saved name: drives document title + breadcrumb (not every keystroke).
  const [savedName, setSavedName] = useState("");

  // Cached server state
  // One request: the database and its newest 100 queries.
  const datasourceQuery = useDatasource(id, !isCreateMode, { withQueries: true });
  const queries = useMemo(() => {
    const embedded = (datasourceQuery.data as { queries?: unknown } | undefined)?.queries;
    return Array.isArray(embedded) ? (embedded as QueryDefinition[]) : EMPTY_QUERIES;
  }, [datasourceQuery.data]);
  const loading = !isCreateMode && !!id && datasourceQuery.isPending;
  const queriesLoading = loading;

  // Hydrate form state from server data once per record (or once for create mode),
  // synchronously during render so there's no empty-form flash. Background refetches
  // never clobber in-progress edits; after a save we reset `hydratedFor` to re-hydrate.
  const hydrationKey = isCreateMode ? CREATE_HYDRATION_KEY : id ?? null;
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (hydrationKey !== hydratedFor) {
    if (isCreateMode) {
      const empty = buildEmptyDatasource();
      setHydratedFor(hydrationKey);
      setForm(empty);
      setInitialSnapshot(JSON.stringify(buildDatasourcePayload(empty)));
      setStatusDetails(null);
      setFormErrors({});
      initialNameRef.current = "";
      setSavedName("");
      setNameValidationStatus("idle");
      setLatencyMs(null);
      setDiagnosticMessage(null);
    } else if (hydrationKey && datasourceQuery.data) {
      const data: any = datasourceQuery.data;
      const normalized = normalizeDatasource(data);
      normalized.password = "";
      setHydratedFor(hydrationKey);
      setForm(normalized);
      setInitialSnapshot(JSON.stringify(buildDatasourcePayload(normalized)));
      initialNameRef.current = normalized.name || "";
      setSavedName(String(normalized.name || "").trim());
      setNameValidationStatus(normalized.name ? "valid" : "idle");
      setStatusDetails(
        data?.status && typeof data.status === "object"
          ? (data.status as DatasourceStatusDetails)
          : null
      );
    }
  }

  // Error toast once per failed load
  useEffect(() => {
    if (datasourceQuery.error) {
      notify.error(getErrorMessage(datasourceQuery.error, "Failed to load database."));
    }
  }, [datasourceQuery.error, notify]);

  const engineOptions = useMemo<WeaverSelectOption<string>[]>(
    () =>
      getDatasourceTypes().map((type) => ({
        value: type,
        label: type,
      })),
    []
  );

  // Dirty check runs against a deferred copy of the form, so serializing the payload
  // happens at low priority instead of blocking every keystroke.
  const deferredForm = useDeferredValue(form);
  const isDirty = useMemo(() => {
    if (loading || !initialSnapshot) return false;
    return JSON.stringify(buildDatasourcePayload(deferredForm)) !== initialSnapshot;
  }, [deferredForm, initialSnapshot, loading]);

  const auditFields = useMemo(
    () => getAuditFields(form, "Unknown creator", "Not modified"),
    [form]
  );


  const handleValidationStateChange = useCallback(
    (state: NameValidationState) => {
      setNameValidationStatus((prev) => (prev !== state.status ? state.status : prev));
    },
    []
  );

  const handleValidateName = useCallback(
    async (value: string): Promise<NameValidationResult> => {
      const trimmed = value?.trim() || "";
      if (!trimmed) {
        return { valid: false, message: "Database name cannot be empty." };
      }

      // In edit mode, retaining the initial database name is always valid
      if (
        !isCreateMode &&
        initialNameRef.current &&
        trimmed.toLowerCase() === initialNameRef.current.toLowerCase()
      ) {
        return { valid: true };
      }

      try {
        const existing = await fetchDatasourceByName(trimmed);
        if (existing && (!id || String(existing.id) !== String(id))) {
          return {
            valid: false,
            message: `Database "${existing.name || trimmed}" already exists.`,
          };
        }
        return { valid: true };
      } catch {
        return {
          valid: false,
          message: "Failed to verify database name availability.",
        };
      }
    },
    [id, isCreateMode]
  );

  // Title + breadcrumb follow the loaded/saved name only (not every keystroke).
  useEffect(() => {
    const name = savedName;
    if (isCreateMode) {
      document.title = "Create Database";
    } else {
      document.title = name ? `Databases - ${name}` : "Databases";
      if (name) {
        window.dispatchEvent(
          new CustomEvent("weaver:breadcrumb-title", {
            detail: { title: name, pathname: window.location.pathname },
          })
        );
      }
    }
  }, [savedName, isCreateMode]);

  const handleChange = (field: string, value: unknown) => {
    setForm((prev: any) => ({ ...(prev || {}), [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Saved and unchanged: ping it (also refreshes its stored status). New or edited: test the
  // form values without saving; the id lets a blank password reuse the stored one.
  const handlePing = async () => {
    const testForm = isCreateMode || !id || isDirty;
    setPinging(true);
    const startPing = performance.now();
    try {
      const pingStatus = testForm
        ? (await testDatasourceConnection({
            ...buildDatasourcePayload(form),
            id: isCreateMode ? undefined : id,
          }))?.data
        : toStatusDetails((await pingDatasource(id as string))?.data?.status);
      const elapsed = Math.round(performance.now() - startPing);
      setLatencyMs(elapsed);
      const isOk = pingStatus?.status === "ACTIVE";

      const pingLastCheck = pingStatus?.lastCheck;
      const diagMsg =
        pingStatus?.message ||
        pingStatus?.reason ||
        (isOk
          ? "HikariCP pool connection validated successfully and responsive to queries."
          : "Unable to establish JDBC connection to host.");
      setDiagnosticMessage(diagMsg);

      if (isOk) {
        notify.success(`Database ping succeeded (${elapsed} ms). Connection is active.`);
      } else {
        notify.error(`Database ping failed (${elapsed} ms): ${diagMsg}`);
      }

      if (testForm) {
        // Nothing was saved, so there is no stored status to refresh.
        setStatusDetails({ ...(pingStatus || {}), lastCheck: pingLastCheck || new Date().toISOString() });
        return;
      }

      // Refresh datasource details (and stale list/fleet caches) to pick up the updated
      // status and real backend lastCheck. Form state is not re-hydrated by this refetch.
      await queryClient.invalidateQueries({ queryKey: datasourceKeys.all });
      const refData = (queryClient.getQueryData(datasourceKeys.detailWithQueries(id as string)) ?? {}) as {
        status?: DatasourceStatusDetails | string;
      };
      const refStatus = refData.status;
      if (refStatus && typeof refStatus === "object") {
        setStatusDetails({
          ...refStatus,
          lastCheck: refStatus.lastCheck || pingLastCheck || new Date().toISOString(),
        });
      } else if (pingLastCheck) {
        setStatusDetails((prev) => ({
          ...(prev || {}),
          status: isOk ? "ACTIVE" : "INACTIVE",
          lastCheck: pingLastCheck,
        }));
      }
    } catch (error: any) {
      const elapsed = Math.round(performance.now() - startPing);
      setLatencyMs(elapsed);
      const errMsg = getErrorMessage(error, "Connection ping failed. Check JDBC URL and credentials.");
      setDiagnosticMessage(errMsg);
      notify.error(errMsg);
    } finally {
      setPinging(false);
    }
  };

  const handleCopyDiagnostic = async () => {
    const msg = diagnosticMessage || statusDetails?.message || statusDetails?.reason || "";
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedDiagnostic(true);
      setTimeout(() => setCopiedDiagnostic(false), 1400);
    } catch {}
  };

  const handleUpdate = async () => {
    const nextErrors = validateDatasource(form || {}, isCreateMode);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (nameValidationStatus === "validating") {
      notify.warning("Please wait for database name validation to finish.");
      return;
    }

    if (nameValidationStatus === "invalid" || nameValidationStatus === "error") {
      notify.error("Please fix the database name before proceeding.");
      return;
    }

    // Safety validation check before persisting
    const nameCheck = await handleValidateName(form?.name || "");
    if (!nameCheck.valid) {
      setFormErrors((prev) => ({
        ...prev,
        name: nameCheck.message || "Database name is not available.",
      }));
      setNameValidationStatus("invalid");
      return;
    }

    setSubmitting(true);
    try {
      if (isCreateMode) {
        const response = await createDatasource(buildDatasourcePayload(form));
        const body = response?.data ?? {};
        const created = (body as any)?.data ?? body ?? {};
        const createdId = String(created?.id || "").trim();

        notify.success("Database created successfully.");
        void queryClient.invalidateQueries({ queryKey: datasourceKeys.all });
        if (createdId) {
          navigate(`/databases/${encodeURIComponent(createdId)}`, {
            state: { name: form.name },
          });
        } else if (onBack) {
          onBack();
        } else {
          navigate("/databases");
        }
      } else {
        await updateDatasource(id!, buildDatasourcePayload(form));
        notify.success("Database updated successfully.");
        initialNameRef.current = form?.name || "";
        setNameValidationStatus("valid");
        setInitialSnapshot(JSON.stringify(buildDatasourcePayload(form)));
        setSavedName(String(form?.name || "").trim());
        // Refetch (detail, lists, fleet stats), then re-hydrate the form from fresh data.
        await queryClient.invalidateQueries({ queryKey: datasourceKeys.all });
        setHydratedFor(null);
      }
    } catch (error) {
      notify.error(
        getErrorMessage(
          error,
          isCreateMode ? "Failed to create database." : "Failed to update database."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await deleteDatasource(id);
      notify.success("Database deleted successfully.");
      // Drop the deleted record's cache (don't refetch it -> 404) and refresh lists/stats.
      queryClient.removeQueries({ queryKey: datasourceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: datasourceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: datasourceKeys.fleetStats() });
      if (onBack) {
        onBack();
      } else {
        navigate("/databases");
      }
    } catch (error) {
      notify.error(getErrorMessage(error, "Failed to delete database."));
    } finally {
      setSubmitting(false);
    }
  };

  const relatedQueryColumns = useMemo<WeaverRelatedTableColumn<any>[]>(
    () => [
      {
        key: "name",
        label: "Query Name",
        getValue: (r) => r.name,
        sortable: true,
        width: 300,
        render: (r) => (
          <button
            type="button"
            className={styles.queryNameLink}
            onClick={(e) => {
              e.stopPropagation();
              if (r.queryId) navigate(`/queries/${encodeURIComponent(r.queryId)}`);
            }}
            title={r.name}
          >
            <FiTerminal size={13} style={{ color: "var(--color-accent-fg)", flexShrink: 0 }} />
            <span>{r.name}</span>
          </button>
        ),
      },
      {
        key: "timeoutMs",
        label: "Timeout",
        getValue: (r) => r.timeoutMs,
        sortable: true,
        width: 140,
        render: (r) => (
          <div className={styles.timeoutCell}>
            <FiClock size={11} />
            <span>{Number(r.timeoutMs ?? 3000).toLocaleString()} ms</span>
          </div>
        ),
      },
      {
        key: "updatedAt",
        label: "Last Updated",
        getValue: (r) => r.updatedAt,
        sortable: true,
        width: 180,
        render: (r) => {
          if (!r.updatedAt) return <span style={{ color: "var(--color-fg-muted)" }}>—</span>;
          return (
            <span
              className={styles.auditTimestamp}
              title={formatTooltipDateTime(r.updatedAt)}
            >
              {formatRelativeTime(r.updatedAt)}
            </span>
          );
        },
      },
    ],
    [navigate]
  );

  const queryRows = useMemo(() => {
    return (queries || []).map((query: any, idx: number) => {
      return {
        __rowId: String(query?.id || `query-${idx}`),
        queryId: String(query?.id || "").trim(),
        id: query?.id || "-",
        name: query?.name || "-",
        timeoutMs: query?.timeout ?? query?.timeoutMs ?? 3000,
        updatedAt: query?.updatedAt || query?.createdAt || null,
      };
    });
  }, [queries]);

  const rawStatus = String(statusDetails?.status || form?.status || "").toUpperCase();
  const isActive = rawStatus === "ACTIVE";
  const isInactive = rawStatus === "INACTIVE" || rawStatus === "ERROR";
  const statusLabel = rawStatus || "UNKNOWN";

  return (
    <div className="definitions-page">
      <div className="definitions-content">
        <div className={styles.container}>
          {/* Header Actions */}
          <div className={styles.topHeader}>

            <div className={styles.headerActions}>
              {isDirty ? (
                <span className={styles.dirtyBadge}>
                  <FiAlertCircle size={13} />
                  <span>Unsaved changes</span>
                </span>
              ) : null}

              {!isCreateMode ? (
                <WeaverButton
                  mode="delete"
                  variant="outlined"
                  size="small"
                  onAction={handleDelete}
                  loading={submitting}
                  loadingLabel="Deleting..."
                  holdLabel="Hold to delete..."
                  disabled={submitting || loading || pinging}
                >
                  Delete
                </WeaverButton>
              ) : null}

              <WeaverButton
                mode={isCreateMode ? "save" : "update"}
                variant="contained"
                size="small"
                onAction={handleUpdate}
                disabled={submitting || loading || pinging || nameValidationStatus === "validating"}
                loading={submitting}
                loadingLabel={isCreateMode ? "Creating..." : "Saving..."}
              >
                {isCreateMode ? "Create Database" : "Save Changes"}
              </WeaverButton>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
              <CircularProgress size={36} style={{ color: "var(--color-accent-fg)" }} />
            </div>
          ) : (
            <div className={!isCreateMode ? styles.pageBodyWithNav : undefined}>
              <div className={!isCreateMode ? styles.mainColumn : undefined}>
                <div className={`${styles.contentGrid} ${!isCreateMode ? styles.contentGridEdit : ""}`}>
                  {/* Left Column: Connection Details & Pool Settings */}
                  <div
                    id={!isCreateMode ? "section-connection-details" : undefined}
                    className={`${styles.card} ${!isCreateMode ? styles.scrollSection : ""}`}
                  >
                    <div className={styles.cardHeader}>
                      <div>
                        <h2 className={styles.cardTitle}>
                          <FiDatabase size={15} color="var(--color-accent-fg)" />
                          <span>Connection Details</span>
                        </h2>
                        <p className={styles.cardSubtitle}>
                          Specify JDBC connection URL, credentials, and HikariCP connection pool settings
                        </p>
                      </div>
                    </div>

                    <div className={styles.formGrid}>
                      <WeaverNameField
                        label="Database Name"
                        placeholder="e.g. Loyalty-Prod"
                        value={form?.name || ""}
                        onChange={(val) => handleChange("name", val)}
                        namePattern={DATABASE_NAME_PATTERN}
                        invalidNameMessage="Datasource name can contain only letters, numbers, underscores, and hyphens."
                        errorMessage={formErrors.name}
                        validateName={handleValidateName}
                        showValidationStatus
                        debounceMs={400}
                        onValidationStateChange={handleValidationStateChange}
                        fullWidth
                        required
                      />

                      <WeaverSelectField
                        label="Database Engine"
                        value={form?.type || "POSTGRES"}
                        options={engineOptions}
                        onChange={(val) => handleChange("type", String(val))}
                        errorMessage={formErrors.type}
                        fullWidth
                        required
                      />

                      <div className={styles.fullWidth}>
                        <WeaverTextField
                          label="JDBC URL"
                          placeholder="jdbc:postgresql://localhost:5432/my_database"
                          value={form?.url || ""}
                          onChange={(val) => handleChange("url", val)}
                          errorMessage={formErrors.url}
                          fullWidth
                          required
                        />
                      </div>

                      <WeaverTextField
                        label="Username"
                        placeholder="db_user"
                        value={form?.username || ""}
                        onChange={(val) => handleChange("username", val)}
                        errorMessage={formErrors.username}
                        fullWidth
                        required
                      />

                      <WeaverTextField
                        label="Password"
                        type="password"
                        placeholder={isCreateMode ? "••••••••" : "Leave blank to keep existing password"}
                        value={form?.password || ""}
                        onChange={(val) => handleChange("password", val)}
                        errorMessage={formErrors.password}
                        fullWidth
                        required={isCreateMode}
                        helperText={!isCreateMode ? "Leave empty to keep existing database password" : undefined}
                      />
                    </div>

                    {/* Section 2: Connection Pool Settings */}
                    <div className={styles.sectionDivider}>
                      <div className={styles.sectionTitle}>
                        <FiSliders size={13} color="var(--color-accent-fg)" />
                        <span>HikariCP Connection Pool & Schema</span>
                      </div>
                    </div>

                    <div className={styles.formGrid}>
                      <WeaverNumberField
                        label="Maximum Pool Size"
                        value={form?.maximumPoolSize ?? 10}
                        onChange={(val) => handleChange("maximumPoolSize", val)}
                        min={1}
                        max={100}
                        step={1}
                        allowNegative={false}
                        allowDecimal={false}
                        errorMessage={formErrors.maximumPoolSize}
                        fullWidth
                      />

                      <WeaverNumberField
                        label="Connection Timeout (ms)"
                        value={form?.connectionTimeout ?? 30000}
                        onChange={(val) => handleChange("connectionTimeout", val)}
                        min={250}
                        step={1000}
                        allowNegative={false}
                        allowDecimal={false}
                        errorMessage={formErrors.connectionTimeout}
                        fullWidth
                      />

                      <WeaverNumberField
                        label="Idle Timeout (ms)"
                        value={form?.idleTimeout ?? 30000}
                        onChange={(val) => handleChange("idleTimeout", val)}
                        min={10000}
                        step={1000}
                        allowNegative={false}
                        allowDecimal={false}
                        errorMessage={formErrors.idleTimeout}
                        fullWidth
                      />

                      <WeaverTextField
                        label="Default Schema (optional)"
                        placeholder="public"
                        value={form?.schema || ""}
                        onChange={(val) => handleChange("schema", val)}
                        fullWidth
                      />
                    </div>
                  </div>

                  {/* Right Column (Edit Mode) */}
                  {!isCreateMode ? (
                    <div
                      id="section-connection-health"
                      className={`${styles.sideColumn} ${styles.scrollSection}`}
                    >
                      {/* Health & Diagnostic Studio Card */}
                      <div
                        className={`${styles.card} ${
                          isActive
                            ? styles.statusCardActive
                            : isInactive
                            ? styles.statusCardInactive
                            : ""
                        }`}
                      >
                        <div className={styles.cardHeader}>
                          <div>
                            <h2 className={styles.cardTitle}>
                              <FiActivity
                                size={15}
                                color={isActive ? "var(--color-status-success)" : "var(--color-accent-fg)"}
                              />
                              <span>Connection Health</span>
                            </h2>
                            <p className={styles.cardSubtitle}>
                              Live connectivity evaluation and HikariCP pool telemetry
                            </p>
                          </div>
                          <button
                            type="button"
                            className={styles.btnTestPing}
                            onClick={handlePing}
                            disabled={pinging || loading}
                            title="Execute live JDBC ping test"
                          >
                            {pinging ? (
                              <FiRefreshCw size={12} className={styles.spinning} />
                            ) : (
                              <FiActivity size={12} />
                            )}
                            <span>{pinging ? "Testing..." : "Test Connection"}</span>
                          </button>
                        </div>

                        <div className={styles.statusMetrics}>
                          {/* Pool Status Tile */}
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>Connection Pool</div>
                            <div className={styles.metricValue}>
                              <span
                                className={`${styles.statusDot} ${
                                  isActive
                                    ? styles.dotActive
                                    : isInactive
                                    ? styles.dotInactive
                                    : styles.dotUnknown
                                }`}
                              />
                              <span>{statusLabel}</span>
                            </div>
                          </div>

                          {/* Ping Latency Tile */}
                          <div className={styles.metricItem}>
                            <div className={styles.metricLabel}>Ping Latency</div>
                            <div className={styles.metricValue}>
                              {latencyMs !== null ? (
                                <span className={styles.latencyValue}>{latencyMs} ms</span>
                              ) : (
                                <span className={styles.metricMuted}>Not tested</span>
                              )}
                            </div>
                          </div>

                          {/* Last Checked Tile */}
                          <div className={`${styles.metricItem} ${styles.metricItemWide}`}>
                            <div className={styles.metricLabel}>Last Checked</div>
                            <div
                              className={styles.metricValue}
                              title={formatTooltipDateTime(statusDetails?.lastCheck || statusDetails?.lastChecked)}
                            >
                              <FiClock size={12} color="var(--color-fg-muted)" />
                              <span>{formatRelativeTime(statusDetails?.lastCheck || statusDetails?.lastChecked)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Diagnostic Evaluation Box */}
                        {diagnosticMessage || statusDetails?.message || statusDetails?.reason ? (
                          <div className={`${styles.diagnosticBox} ${isActive ? styles.diagSuccess : styles.diagError}`}>
                            <div className={styles.diagHeader}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {isActive ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
                                <span>{isActive ? "Connection Pool Operational" : "Diagnostic Alert"}</span>
                              </div>
                              <button
                                type="button"
                                className={styles.diagCopyBtn}
                                onClick={handleCopyDiagnostic}
                                title="Copy diagnostic message"
                              >
                                {copiedDiagnostic ? <FiCheck size={11} /> : <FiCopy size={11} />}
                                <span>{copiedDiagnostic ? "Copied" : "Copy"}</span>
                              </button>
                            </div>
                            <div className={styles.diagBody}>
                              {diagnosticMessage || statusDetails?.message || statusDetails?.reason}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Audit History Card */}
                      <div className={styles.auditCard}>
                        <div className={styles.auditHeader}>
                          <FiClock size={12} color="var(--color-fg-muted)" />
                          <span>Audit History</span>
                        </div>

                        <div className={styles.auditRows}>
                          <div className={styles.auditRow}>
                            <div className={styles.auditAvatar}>
                              {getInitials(auditFields.createdBy?.name || "U")}
                            </div>
                            <div className={styles.auditDetails}>
                              <div className={styles.auditText}>
                                Created by <strong>{auditFields.createdBy?.name || "Unknown"}</strong>
                              </div>
                              <div className={styles.auditTimestamp}>
                                {formatExactDateTime(auditFields.createdAt)}
                              </div>
                            </div>
                          </div>

                          <div className={styles.auditRow}>
                            <div className={`${styles.auditAvatar} ${styles.auditAvatarSecondary}`}>
                              {getInitials(auditFields.updatedBy?.name || "U")}
                            </div>
                            <div className={styles.auditDetails}>
                              <div className={styles.auditText}>
                                Modified by <strong>{auditFields.updatedBy?.name || "Not modified"}</strong>
                              </div>
                              <div
                                className={styles.auditTimestamp}
                                title={formatTooltipDateTime(auditFields.updatedAt)}
                              >
                                {formatRelativeTime(auditFields.updatedAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Related Queries Table (Edit Mode) */}
                {!isCreateMode ? (
                  <div
                    id="section-related-queries"
                    className={`${styles.queriesCard} ${styles.scrollSection}`}
                  >
                    <div
                      className={styles.queriesHeader}
                      onClick={() => setQueriesExpanded((prev) => !prev)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={queriesExpanded}
                      aria-controls="section-related-queries-content"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setQueriesExpanded((prev) => !prev);
                        }
                      }}
                    >
                      <div className={styles.queriesTitleGroup}>
                        <FiChevronDown
                          size={16}
                          className={`${styles.collapseChevron} ${!queriesExpanded ? styles.collapseChevronRotated : ""}`}
                        />
                        <h2 className={styles.cardTitle}>
                          <FiTerminal size={14} color="var(--color-accent-fg)" />
                          <span>Related Queries</span>
                        </h2>
                        <span className={styles.queriesCountBadge}>
                          {queryRows.length}
                        </span>
                      </div>
                    </div>

                    <Collapse in={queriesExpanded} timeout="auto" unmountOnExit={false}>
                      <div id="section-related-queries-content" style={{ marginTop: 16 }}>
                        <WeaverRelatedTable
                          records={queryRows}
                          columns={relatedQueryColumns}
                          getRecordId={getQueryRowId}
                          searchable
                          searchPlaceholder="Search queries..."
                          pagination
                          pageSizeOptions={RELATED_QUERY_PAGE_SIZES}
                          loading={queriesLoading}
                          primaryAction={{
                            id: "add-query",
                            label: "Create Query",
                            icon: <FiPlus size={13} />,
                            onClick: () => {
                              const dbId = id ? encodeURIComponent(id) : "";
                              const dbName = form?.name ? encodeURIComponent(form.name) : "";
                              navigate(`/queries/new?datasourceId=${dbId}&datasourceName=${dbName}`);
                            },
                          }}
                          onRowClick={(r) => {
                            const queryId = r?.queryId || r?.id;
                            if (queryId) navigate(`/queries/${encodeURIComponent(queryId)}`);
                          }}
                          emptyState={
                            <div className={styles.emptyQueries}>
                              <FiTerminal size={32} className={styles.emptyIcon} />
                              <div className={styles.emptyTitle}>No Queries Registered</div>
                              <div className={styles.emptyText}>
                                No SQL query definitions are currently linked to this database.
                              </div>
                              <button
                                type="button"
                                className={styles.btnAddQuery}
                                onClick={() => {
                                  const dbId = id ? encodeURIComponent(id) : "";
                                  const dbName = form?.name ? encodeURIComponent(form.name) : "";
                                  navigate(`/queries/new?datasourceId=${dbId}&datasourceName=${dbName}`);
                                }}
                              >
                                <FiPlus size={13} />
                                <span>Create Query for this Database</span>
                              </button>
                            </div>
                          }
                          maxHeight={420}
                        />
                      </div>
                    </Collapse>
                  </div>
                ) : null}
              </div>


            </div>
          )}
        </div>
      </div>
    </div>
  );
}
