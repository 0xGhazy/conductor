import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  Link,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import StorageIcon from "@mui/icons-material/Storage";
import HubIcon from "@mui/icons-material/Hub";
import CodeIcon from "@mui/icons-material/Code";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";

import { WeaverRelatedTable, type WeaverRelatedTableColumn } from "@/components/common/data";
import ActivityTimeline, { type ActivityTimelineAction } from "@/components/common/data/ActivityTimeline";
import {
  WeaverTextField,
  WeaverNumberField,
  WeaverSelectField,
  type WeaverSelectOption,
} from "@/components/common/fields";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import Tag from "@/components/common/data/Tag/Tag";
import { useWeaverNotification } from "@/components/common/notifications";
import { getErrorMessage } from "@/utils/error";
import { parseDate, formatExactDateTime } from "@/utils/dateTime";
import { getUserName, getAvatarUrl } from "@/utils/user";
import { extractList } from "@/utils/data";
import {
  extractReferencedEntitiesFromTasks,
  fetchWorkflowDetail,
  updateWorkflowDetail,
} from "../services/workflowsService";
import { fetchQueries } from "@/features/queries";
import { fetchDatasources } from "@/features/databases";
import { fetchConnections } from "@/features/connections";
import { scriptsService } from "@/features/scripts";
import { supportedLanguagesApi } from "@/features/settings";
import type { SupportedLanguage } from "@/features/settings";
import type { WorkflowDetail, WorkflowFormState } from "../types/workflowTypes";
import styles from "./WorkflowViewContent.module.css";

const TIMEOUT_POLICY_OPTIONS: WeaverSelectOption<string>[] = [
  { label: "Timeout Workflow", value: "TIME_OUT_WF" },
  { label: "Alert Only", value: "ALERT_ONLY" },
];


// Monaco is only needed while editing; load it on demand.
const WeaverCodeEditor = lazy(() =>
  import("@/components/common/editors").then((m) => ({ default: m.WeaverCodeEditor }))
);

/** Reference lists change rarely; cache them across workflow views. */
const REFERENCE_LIST_STALE_MS = 5 * 60 * 1000;
const LANGUAGES_STALE_MS = 10 * 60 * 1000;
// Reference rows come from several untyped list endpoints and feed `any`-typed table columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RefEntity = any;
const EMPTY_LIST: RefEntity[] = [];
const EMPTY_LANGUAGES: SupportedLanguage[] = [];

const FALLBACK_LANGUAGES_FULL: SupportedLanguage[] = [
  { id: "1", code: "en", name: "English" },
  { id: "2", code: "ar", name: "Arabic" },
  { id: "3", code: "fr", name: "French" },
  { id: "4", code: "es", name: "Spanish" },
  { id: "5", code: "de", name: "German" },
];

const FALLBACK_LANGUAGES_SHORT: SupportedLanguage[] = [
  { id: "1", code: "en", name: "English" },
  { id: "2", code: "ar", name: "Arabic" },
];

type WorkflowFormSnapshot = Pick<
  WorkflowFormState,
  | "name"
  | "description"
  | "timeoutPolicy"
  | "timeoutSeconds"
  | "supportedLanguages"
  | "defaultLanguage"
  | "variablesText"
  | "inputsText"
>;

const buildFormStateFromWorkflow = (data: WorkflowDetail): WorkflowFormState => ({
  id: data.id,
  name: data.name || data.workflowName || "",
  description: data.description || "",
  version: data.version ?? 1,
  createdAt: data.createdAt,
  createdBy: data.createdBy,
  updatedAt: data.updatedAt,
  updatedBy: data.updatedBy,
  variablesText: JSON.stringify(data.variables || {}, null, 2),
  inputsText: JSON.stringify(data.inputParameters || data.inputs || {}, null, 2),
  timeoutPolicy: data.timeoutPolicy === "TIME_OUT_WF" ? "TIME_OUT_WF" : "ALERT_ONLY",
  timeoutSeconds: Number(data.timeoutSeconds ?? 0),
  supportedLanguages: Array.isArray(data.supportedLanguages) ? data.supportedLanguages : [],
  defaultLanguage: data.language || (data.supportedLanguages?.[0] ?? "en"),
});

const toFormSnapshot = (state: WorkflowFormState): WorkflowFormSnapshot => ({
  name: state.name,
  description: state.description,
  timeoutPolicy: state.timeoutPolicy,
  timeoutSeconds: state.timeoutSeconds,
  supportedLanguages: [...state.supportedLanguages],
  defaultLanguage: state.defaultLanguage,
  variablesText: state.variablesText,
  inputsText: state.inputsText,
});

const sameStringList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Unwraps a list response that may be the array itself or wrapped in `data`. */
const listFromResponse = (res: unknown): RefEntity[] =>
  extractList<RefEntity>((res as { data?: unknown } | null | undefined)?.data ?? res);

/** Keeps the entities of `list` referenced (by id or lower-cased name) in `refs`. */
const matchReferencedEntities = (list: RefEntity[], refs: Set<string>): RefEntity[] => {
  if (refs.size === 0) return EMPTY_LIST;
  return list.filter((item) => {
    const itemId = String(item?.id || "").trim();
    const itemName = String(item?.name || "").trim().toLowerCase();
    return refs.has(itemId) || refs.has(itemName);
  });
};

export interface WorkflowViewContentProps {
  onBack?: () => void;
}

export default function WorkflowViewContent({ onBack }: WorkflowViewContentProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notify = useWeaverNotification();

  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [unsavedLeaveDialogOpen, setUnsavedLeaveDialogOpen] = useState(false);

  // Workflow detail (cached per id)
  const detailQuery = useQuery({
    queryKey: ["workflowView", "detail", id],
    queryFn: () => fetchWorkflowDetail(id as string),
    enabled: Boolean(id),
    retry: false,
  });
  const { refetch: refetchDetail } = detailQuery;
  const workflow: WorkflowDetail | null = detailQuery.data ?? null;
  const loading = detailQuery.isPending;
  const pageError = detailQuery.isError
    ? getErrorMessage(detailQuery.error, "Failed to load workflow details.")
    : null;

  // Available system languages
  const languagesQuery = useQuery({
    queryKey: ["workflowView", "supportedLanguages"],
    queryFn: async () => {
      try {
        const langs = await supportedLanguagesApi.list();
        return Array.isArray(langs) && langs.length > 0 ? langs : FALLBACK_LANGUAGES_FULL;
      } catch {
        return FALLBACK_LANGUAGES_SHORT;
      }
    },
    staleTime: LANGUAGES_STALE_MS,
  });
  const availableLanguages: SupportedLanguage[] = languagesQuery.data ?? EMPTY_LANGUAGES;

  const [form, setForm] = useState<WorkflowFormState>({
    name: "",
    description: "",
    version: 1,
    variablesText: "{}",
    inputsText: "{}",
    timeoutPolicy: "ALERT_ONLY",
    timeoutSeconds: 0,
    supportedLanguages: [],
    defaultLanguage: "en",
  });
  const [initialSnapshot, setInitialSnapshot] = useState<WorkflowFormSnapshot | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = useState<{ variables?: string; inputs?: string }>({});

  // Related sections data & states
  useEffect(() => {
    const currentName = form.name || workflow?.name || id;
    if (currentName) {
      document.title = `Workflows - ${currentName}`;
    } else {
      document.title = "Workflows";
    }
  }, [form.name, workflow?.name, id]);

  const [queriesExpanded, setQueriesExpanded] = useState(true);
  const [databasesExpanded, setDatabasesExpanded] = useState(true);
  const [connectionsExpanded, setConnectionsExpanded] = useState(true);
  const [scriptsExpanded, setScriptsExpanded] = useState(true);

  const [activityExpanded, setActivityExpanded] = useState(true);

  // Sync the form from freshly loaded workflow data (during render, so there is no empty-form
  // flash). Never clobbers in-progress edits.
  const [syncedWorkflow, setSyncedWorkflow] = useState<WorkflowDetail | null>(null);
  const applyWorkflowToForm = useCallback((data: WorkflowDetail) => {
    const state = buildFormStateFromWorkflow(data);
    setSyncedWorkflow(data);
    setForm(state);
    setInitialSnapshot(toFormSnapshot(state));
    setFormErrors({});
    setJsonErrors({});
  }, []);
  if (workflow && workflow !== syncedWorkflow && !isEditing) {
    applyWorkflowToForm(workflow);
  }

  // Surface load failures once per error
  const lastNotifiedErrorAtRef = useRef(0);
  useEffect(() => {
    if (!pageError || detailQuery.errorUpdatedAt === lastNotifiedErrorAtRef.current) return;
    lastNotifiedErrorAtRef.current = detailQuery.errorUpdatedAt;
    notify.error(pageError);
  }, [pageError, detailQuery.errorUpdatedAt, notify]);

  // Reference lists, fetched in parallel with the detail and cached across views
  const queriesListQuery = useQuery({
    queryKey: ["workflowView", "refs", "queries"],
    queryFn: () => fetchQueries({ page: 0, size: 200 } as any),
    enabled: Boolean(id),
    staleTime: REFERENCE_LIST_STALE_MS,
    retry: false,
  });
  const datasourcesListQuery = useQuery({
    queryKey: ["workflowView", "refs", "datasources"],
    queryFn: () => fetchDatasources({ page: 0, size: 200 } as any),
    enabled: Boolean(id),
    staleTime: REFERENCE_LIST_STALE_MS,
    retry: false,
  });
  const connectionsListQuery = useQuery({
    queryKey: ["workflowView", "refs", "connections"],
    queryFn: () => fetchConnections({ page: 0, size: 200 } as any),
    enabled: Boolean(id),
    staleTime: REFERENCE_LIST_STALE_MS,
    retry: false,
  });
  const scriptsListQuery = useQuery({
    queryKey: ["workflowView", "refs", "scripts"],
    queryFn: () => scriptsService.list({ page: 0, size: 200 }),
    enabled: Boolean(id),
    staleTime: REFERENCE_LIST_STALE_MS,
    retry: false,
  });

  // Extract referenced task relationships
  const workflowTasks = workflow?.tasks;
  const refIds = useMemo(() => extractReferencedEntitiesFromTasks(workflowTasks || []), [workflowTasks]);

  const queriesListData: unknown = queriesListQuery.data;
  const queries = useMemo(
    () =>
      queriesListData
        ? matchReferencedEntities(listFromResponse(queriesListData), refIds.queryIds)
        : EMPTY_LIST,
    [queriesListData, refIds]
  );
  const queriesLoading = queriesListQuery.isLoading;
  const queriesError = queriesListQuery.isError
    ? getErrorMessage(queriesListQuery.error, "Failed to load queries.")
    : undefined;

  const datasourcesListData: unknown = datasourcesListQuery.data;
  const databases = useMemo(
    () =>
      datasourcesListData
        ? matchReferencedEntities(listFromResponse(datasourcesListData), refIds.datasourceIds)
        : EMPTY_LIST,
    [datasourcesListData, refIds]
  );
  const databasesLoading = datasourcesListQuery.isLoading;
  const databasesError = datasourcesListQuery.isError
    ? getErrorMessage(datasourcesListQuery.error, "Failed to load databases.")
    : undefined;

  const connectionsListData: unknown = connectionsListQuery.data;
  const connections = useMemo(
    () =>
      connectionsListData
        ? matchReferencedEntities(listFromResponse(connectionsListData), refIds.connectionNames)
        : EMPTY_LIST,
    [connectionsListData, refIds]
  );
  const connectionsLoading = connectionsListQuery.isLoading;
  const connectionsError = connectionsListQuery.isError
    ? getErrorMessage(connectionsListQuery.error, "Failed to load connections.")
    : undefined;

  const scriptsListData = scriptsListQuery.data as { content?: RefEntity[] } | undefined;
  const scripts = useMemo(
    () =>
      scriptsListData ? matchReferencedEntities(scriptsListData?.content || [], refIds.scriptNames) : EMPTY_LIST,
    [scriptsListData, refIds]
  );
  const scriptsLoading = scriptsListQuery.isLoading;
  const scriptsError = scriptsListQuery.isError
    ? getErrorMessage(scriptsListQuery.error, "Failed to load scripts.")
    : undefined;

  const allLanguageOptions = useMemo<WeaverSelectOption<string>[]>(() => {
    return availableLanguages.map((l) => ({
      label: `${l.name} (${l.code})`,
      value: l.code,
    }));
  }, [availableLanguages]);

  const defaultLanguageOptions = useMemo<WeaverSelectOption<string>[]>(() => {
    if (form.supportedLanguages.length === 0) {
      return allLanguageOptions;
    }
    const filtered = allLanguageOptions.filter((opt) => form.supportedLanguages.includes(opt.value));
    return filtered.length > 0 ? filtered : allLanguageOptions;
  }, [allLanguageOptions, form.supportedLanguages]);

  const isDirty = useMemo(() => {
    if (loading || !initialSnapshot) return false;
    return (
      form.name !== initialSnapshot.name ||
      form.description !== initialSnapshot.description ||
      form.timeoutPolicy !== initialSnapshot.timeoutPolicy ||
      !Object.is(form.timeoutSeconds, initialSnapshot.timeoutSeconds) ||
      form.defaultLanguage !== initialSnapshot.defaultLanguage ||
      form.variablesText !== initialSnapshot.variablesText ||
      form.inputsText !== initialSnapshot.inputsText ||
      !sameStringList(form.supportedLanguages, initialSnapshot.supportedLanguages)
    );
  }, [form, initialSnapshot, loading]);

  const auditFields = useMemo(
    () => ({
      createdAt: form.createdAt || workflow?.createdAt || "",
      createdBy: {
        name: getUserName(form.createdBy || workflow?.createdBy, "System"),
        avatarUrl: getAvatarUrl(form.createdBy || workflow?.createdBy),
      },
      updatedAt: form.updatedAt || workflow?.updatedAt || "",
      updatedBy: {
        name: getUserName(form.updatedBy || workflow?.updatedBy, "Not modified"),
        avatarUrl: getAvatarUrl(form.updatedBy || workflow?.updatedBy),
      },
    }),
    [form, workflow]
  );

  const timelineActions = useMemo<ActivityTimelineAction[]>(() => {
    // 1. If explicit activities or history provided on workflow object, map those
    const customActivities =
      (Array.isArray((workflow as any)?.activities) ? (workflow as any).activities : null) ||
      (Array.isArray((workflow as any)?.activity) ? (workflow as any).activity : null) ||
      (Array.isArray((workflow as any)?.history) ? (workflow as any).history : null) ||
      (Array.isArray((workflow as any)?.auditTrail) ? (workflow as any).auditTrail : null) ||
      (Array.isArray((workflow as any)?.metadata?.activities)
        ? (workflow as any).metadata.activities
        : null);

    if (customActivities && customActivities.length > 0) {
      return customActivities.map((act: any) => ({
        timestamp: act.timestamp || act.createdAt || act.time || "",
        actor: act.actor || act.user || act.createdBy || "System",
        avatar: act.avatar || act.photo || act.avatarUrl,
        description: act.description || act.message || act.action || "",
        details: Array.isArray(act.details)
          ? act.details
          : act.detail
            ? [String(act.detail)]
            : [],
      }));
    }

    // 2. Synthesize lifecycle activity from workflow audit and version data
    const list: ActivityTimelineAction[] = [];

    // Most recent event: Definition Update (if updatedAt is present and different from createdAt, or version > 1)
    const hasBeenUpdated =
      Boolean(auditFields.updatedAt) &&
      (auditFields.updatedAt !== auditFields.createdAt || (workflow?.version ?? 1) > 1);

    if (hasBeenUpdated) {
      const updateActor =
        auditFields.updatedBy?.name && auditFields.updatedBy.name !== "Not modified"
          ? auditFields.updatedBy.name
          : auditFields.createdBy?.name || "System";

      list.push({
        timestamp: formatExactDateTime(auditFields.updatedAt),
        actor: updateActor,
        avatar: auditFields.updatedBy?.avatarUrl || auditFields.createdBy?.avatarUrl,
        description: `Workflow definition updated to version ${form.version || workflow?.version || 1}.`,
        details: [
          `Version: v${form.version || workflow?.version || 1}`,
          `Timeout: ${form.timeoutSeconds}s (${form.timeoutPolicy === "TIME_OUT_WF" ? "Timeout Workflow" : "Alert Only"
          })`,
          `Tasks: ${workflow?.tasks?.length ?? 0} task definition(s)`,
          `Default Language: ${form.defaultLanguage || "en"}`,
        ],
      });
    }

    // Creation event
    if (auditFields.createdAt || workflow?.createdAt) {
      list.push({
        timestamp: formatExactDateTime(auditFields.createdAt || workflow?.createdAt),
        actor: auditFields.createdBy?.name || "System",
        avatar: auditFields.createdBy?.avatarUrl,
        description: "Initial workflow definition created.",
        details: [
          "Version: v1",
          `Tasks: ${workflow?.tasks?.length ?? 0} task definition(s)`,
          `Timeout Policy: ${form.timeoutPolicy === "TIME_OUT_WF" ? "Timeout Workflow" : "Alert Only"
          }`,
        ],
      });
    }

    // Fallback if neither createdAt nor updatedAt exists yet
    if (list.length === 0 && workflow) {
      list.push({
        timestamp: "Initial Record",
        actor: auditFields.createdBy?.name || "System",
        avatar: auditFields.createdBy?.avatarUrl,
        description: `Workflow "${workflow.name || "Workflow"}" registered.`,
        details: [`Version: v${workflow.version || 1}`],
      });
    }

    return list;
  }, [
    auditFields,
    form.defaultLanguage,
    form.timeoutPolicy,
    form.timeoutSeconds,
    form.version,
    workflow,
  ]);


  // Reload the workflow (and retry any failed reference list); re-syncs the form.
  const { refetch: refetchQueriesList } = queriesListQuery;
  const { refetch: refetchDatasourcesList } = datasourcesListQuery;
  const { refetch: refetchConnectionsList } = connectionsListQuery;
  const { refetch: refetchScriptsList } = scriptsListQuery;
  const anyReferenceListFailed = Boolean(queriesError || databasesError || connectionsError || scriptsError);
  const loadWorkflowData = useCallback(async () => {
    if (!id) return;
    if (anyReferenceListFailed) {
      void refetchQueriesList();
      void refetchDatasourcesList();
      void refetchConnectionsList();
      void refetchScriptsList();
    }
    const result = await refetchDetail();
    if (result.data) {
      applyWorkflowToForm(result.data);
    }
  }, [
    id,
    anyReferenceListFailed,
    refetchDetail,
    refetchQueriesList,
    refetchDatasourcesList,
    refetchConnectionsList,
    refetchScriptsList,
    applyWorkflowToForm,
  ]);

  // Back navigation handling
  const handleBack = useCallback(() => {
    if (isDirty) {
      setUnsavedLeaveDialogOpen(true);
      return;
    }
    if (onBack) {
      onBack();
    } else {
      navigate("/workflows");
    }
  }, [isDirty, navigate, onBack]);

  const handleCancelEdit = useCallback(() => {
    if (workflow) {
      setForm(buildFormStateFromWorkflow(workflow));
      setFormErrors({});
      setJsonErrors({});
    }
    setIsEditing(false);
  }, [workflow]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      setFormErrors({ name: "Workflow name is required." });
      return;
    }

    // Validate JSON fields
    let parsedVariables: Record<string, any> = {};
    if (form.variablesText.trim()) {
      try {
        parsedVariables = JSON.parse(form.variablesText);
        if (typeof parsedVariables !== "object" || parsedVariables === null || Array.isArray(parsedVariables)) {
          setJsonErrors((prev) => ({ ...prev, variables: "Variables must be a valid JSON object." }));
          notify.error("Variables must be a valid JSON object.");
          return;
        }
      } catch {
        setJsonErrors((prev) => ({ ...prev, variables: "Invalid JSON format in Variables." }));
        notify.error("Invalid JSON format in Variables.");
        return;
      }
    }

    let parsedInputs: Record<string, any> = {};
    if (form.inputsText.trim()) {
      try {
        parsedInputs = JSON.parse(form.inputsText);
        if (typeof parsedInputs !== "object" || parsedInputs === null || Array.isArray(parsedInputs)) {
          setJsonErrors((prev) => ({ ...prev, inputs: "Inputs must be a valid JSON object." }));
          notify.error("Inputs must be a valid JSON object.");
          return;
        }
      } catch {
        setJsonErrors((prev) => ({ ...prev, inputs: "Invalid JSON format in Inputs." }));
        notify.error("Invalid JSON format in Inputs.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await updateWorkflowDetail(
        workflow?.name || form.name,
        {
          name: form.name.trim(),
          description: form.description.trim(),
          version: form.version,
          variables: parsedVariables,
          inputParameters: parsedInputs,
          timeoutPolicy: form.timeoutPolicy,
          timeoutSeconds: form.timeoutSeconds,
          supportedLanguages: form.supportedLanguages,
          language: form.defaultLanguage,
        },
        workflow || undefined
      );
      notify.success("Workflow updated successfully.");
      setIsEditing(false);
      await loadWorkflowData();
    } catch (err: any) {
      notify.error(getErrorMessage(err, "Failed to save workflow changes."));
    } finally {
      setSubmitting(false);
    }
  }, [form, loadWorkflowData, notify, workflow]);

  const handleOpenInDesigner = useCallback(() => {
    const targetName = form.name || workflow?.name || "";
    if (targetName) {
      window.open(
        `/designer/${encodeURIComponent(targetName)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }, [form.name, workflow?.name]);

  // Related Table Column Definitions
  const queryColumns = useMemo<WeaverRelatedTableColumn<any>[]>(
    () => [
      {
        key: "name",
        label: "Query Name",
        getValue: (r) => r.name,
        sortable: true,
        render: (r) => (
          <span style={{ fontWeight: 600, color: "var(--color-fg-default)" }}>
            {r.name || "-"}
          </span>
        ),
      },
      {
        key: "sql",
        label: "SQL Statement",
        getValue: (r) => r.sql || r.sqlQuery || r.query,
        render: (r) => (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "0.78rem",
              color: "var(--color-fg-muted)",
            }}
          >
            {String(r.sql || r.sqlQuery || r.query || "-").substring(0, 65)}
          </span>
        ),
      },
      {
        key: "timeoutMs",
        label: "Timeout",
        getValue: (r) => r.timeoutMs ?? r.timeout ?? 3000,
        render: (r) => `${r.timeoutMs ?? r.timeout ?? 3000} ms`,
        sortable: true,
        width: 120,
      },
      {
        key: "updatedAt",
        label: "Last Updated",
        getValue: (r) => r.updatedAt,
        render: (r) => formatExactDateTime(r.updatedAt),
        sortable: true,
        width: 180,
      },
    ],
    []
  );

  const databaseColumns = useMemo<WeaverRelatedTableColumn<any>[]>(
    () => [
      {
        key: "name",
        label: "Database Name",
        getValue: (r) => r.name,
        sortable: true,
        render: (r) => (
          <span style={{ fontWeight: 600, color: "var(--color-fg-default)" }}>
            {r.name || "-"}
          </span>
        ),
      },
      {
        key: "type",
        label: "Engine",
        getValue: (r) => r.type,
        sortable: true,
        width: 130,
        render: (r) => (
          <Tag text={String(r.type || "POSTGRES").toUpperCase()} borderColor="#336791" />
        ),
      },
      {
        key: "status",
        label: "Status",
        getValue: (r) =>
          (typeof r.status === "object" && r.status ? r.status.status : r.status) || "UNKNOWN",
        width: 120,
        render: (r) => {
          const val = String(
            (typeof r.status === "object" && r.status ? r.status.status : r.status) || "UNKNOWN"
          ).toUpperCase();
          const color = val === "ACTIVE" ? "#22c55e" : val === "INACTIVE" ? "#ef4444" : "#94a3b8";
          return <Tag text={val} color={color} borderColor={color} />;
        },
      },
      {
        key: "url",
        label: "Host / URL",
        getValue: (r) => r.url || r.connection?.url || "-",
        render: (r) => (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "0.78rem",
              color: "var(--color-fg-muted)",
            }}
          >
            {String(r.url || r.connection?.url || "-").substring(0, 50)}
          </span>
        ),
      },
    ],
    []
  );

  const connectionColumns = useMemo<WeaverRelatedTableColumn<any>[]>(
    () => [
      {
        key: "name",
        label: "Connection Name",
        getValue: (r) => r.name,
        sortable: true,
        render: (r) => (
          <span style={{ fontWeight: 600, color: "var(--color-fg-default)" }}>
            {r.name || "-"}
          </span>
        ),
      },
      {
        key: "baseUrl",
        label: "Base URL",
        getValue: (r) => r.baseUrl || r.url || "-",
        render: (r) => (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "0.78rem",
              color: "var(--color-fg-muted)",
            }}
          >
            {r.baseUrl || r.url || "-"}
          </span>
        ),
      },
      {
        key: "authType",
        label: "Auth Type",
        getValue: (r) => r.authType || r.authenticationType || "NONE",
        width: 130,
        render: (r) => (
          <Tag
            text={String(r.authType || r.authenticationType || "NONE").toUpperCase()}
            borderColor="var(--color-border-default)"
          />
        ),
      },
      {
        key: "updatedAt",
        label: "Last Updated",
        getValue: (r) => r.updatedAt,
        render: (r) => formatExactDateTime(r.updatedAt),
        sortable: true,
        width: 180,
      },
    ],
    []
  );

  const scriptColumns = useMemo<WeaverRelatedTableColumn<any>[]>(
    () => [
      {
        key: "name",
        label: "Script Name",
        getValue: (r) => r.name,
        sortable: true,
        render: (r) => (
          <span style={{ fontWeight: 600, color: "var(--color-fg-default)" }}>
            {r.name || "-"}
          </span>
        ),
      },
      {
        key: "language",
        label: "Language",
        getValue: (r) => r.language,
        width: 130,
        render: (r) => (
          <Tag
            text={String(r.language || "JEXL").toUpperCase()}
            borderColor="var(--color-support-fg, #2C8C84)"
          />
        ),
      },
      {
        key: "description",
        label: "Description",
        getValue: (r) => r.description || "-",
        render: (r) => (
          <span style={{ fontSize: "0.82rem", color: "var(--color-fg-muted)" }}>
            {r.description || "-"}
          </span>
        ),
      },
      {
        key: "timeout",
        label: "Timeout",
        getValue: (r) => r.timeout || 3000,
        render: (r) => `${r.timeout || 3000} ms`,
        width: 120,
      },
    ],
    []
  );

  return (
    <div className={styles.container}>
      {/* Unsaved Changes Confirmation Dialog using WeaverConfirmDialog */}
      <WeaverConfirmDialog
        open={unsavedLeaveDialogOpen}
        title="Unsaved Changes"
        intent="warning"
        message="You have unsaved changes in your workflow definition."
        description="Leaving now will discard your unsaved modifications."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        onConfirm={() => {
          setUnsavedLeaveDialogOpen(false);
          if (onBack) onBack();
          else navigate("/workflows");
        }}
        onCancel={() => setUnsavedLeaveDialogOpen(false)}
      />

      {/* Header & Navigation */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2.5,
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: "var(--color-fg-muted)" }} />}
          className={styles.breadcrumbs}
        >
          <Link
            component={RouterLink}
            to="/workflows"
            className={styles.breadcrumbLink}
            onClick={(e) => {
              if (onBack) {
                e.preventDefault();
                handleBack();
              }
            }}
          >
            Workflows
          </Link>
          <Typography className={styles.breadcrumbCurrent}>
            {form.name || workflow?.name || "Workflow"}
          </Typography>
        </Breadcrumbs>

        <div className={styles.actionButtons}>
          {isDirty && (
            <span className={styles.dirtyBadge}>
              <WarningAmberIcon sx={{ fontSize: 14 }} />
              Unsaved changes
            </span>
          )}

          <Button
            variant="outlined"
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpenInDesigner}
            disabled={loading || submitting}
          >
            Open in Designer
          </Button>

          {!isEditing ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setIsEditing(true)}
              disabled={loading || submitting}
            >
              Edit Details
            </Button>
          ) : (
            <>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<CloseIcon />}
                onClick={handleCancelEdit}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={handleSave}
                disabled={submitting || loading}
              >
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress size={36} />
        </Box>
      ) : pageError && !workflow ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" color="error" sx={{ mb: 1 }}>
            Failed to Load Workflow
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {pageError}
          </Typography>
          <Button variant="outlined" onClick={loadWorkflowData}>
            Retry
          </Button>
        </Box>
      ) : (
        <div className={styles.pageBodyWithNav}>
          <div className={styles.mainColumn}>
            {/* Workflow Details */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>
                      <InfoOutlinedIcon fontSize="small" sx={{ color: "var(--color-accent-fg)" }} />
                      Workflow Details
                    </h2>
                    <p className={styles.cardSubtitle}>
                      Core workflow metadata, execution timeouts, language localization, and parameters
                    </p>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  {/* Name Field */}
                  <div className={styles.fullWidth}>
                    {isEditing ? (
                      <WeaverTextField
                        label="Name"
                        value={form.name}
                        onChange={(val) => {
                          const nextName = typeof val === "string" ? val : (val as any)?.target?.value ?? "";
                          setForm((prev) => ({ ...prev, name: nextName }));
                          if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: "" }));
                        }}
                        fullWidth
                        errorMessage={formErrors.name}
                        required
                        placeholder="e.g. customer_update_workflow"
                      />
                    ) : (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                          Name
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: "var(--color-fg-default)" }}>
                          {form.name || "-"}
                        </Typography>
                      </Box>
                    )}
                  </div>

                  {/* Description Field */}
                  <div className={styles.fullWidth}>
                    {isEditing ? (
                      <WeaverTextField
                        label="Description"
                        placeholder="Provide details about what this workflow coordinates..."
                        value={form.description}
                        onChange={(val) => {
                          const nextDesc = typeof val === "string" ? val : (val as any)?.target?.value ?? "";
                          setForm((prev) => ({ ...prev, description: nextDesc }));
                        }}
                        fullWidth
                        multiline
                        minRows={3}
                      />
                    ) : (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                          Description
                        </Typography>
                        <Typography variant="body2" sx={{ color: "var(--color-fg-muted)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                          {form.description || "No description provided."}
                        </Typography>
                      </Box>
                    )}
                  </div>

                  {/* Latest Version (Read-only) */}
                  <div className={styles.fullWidth}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Latest Version
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Tag
                          text={`v${form.version}`}
                          borderColor="var(--color-support-fg, #2C8C84)"
                        />
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                          (Server-managed)
                        </Typography>
                      </Box>
                    </Box>
                  </div>

                  {/* Timeout Policy Field (WeaverSelectField) */}
                  <div>
                    {isEditing ? (
                      <WeaverSelectField
                        label="Timeout Policy"
                        options={TIMEOUT_POLICY_OPTIONS}
                        value={form.timeoutPolicy}
                        onChange={(val) => setForm((prev) => ({ ...prev, timeoutPolicy: String(val) }))}
                        fullWidth
                      />
                    ) : (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                          Timeout Policy
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: "var(--color-fg-default)" }}>
                          {form.timeoutPolicy === "TIME_OUT_WF" ? "Timeout Workflow" : "Alert Only"}
                        </Typography>
                      </Box>
                    )}
                  </div>

                  {/* Timeout Field (WeaverNumberField) */}
                  <div>
                    {isEditing ? (
                      <WeaverNumberField
                        label="Timeout"
                        value={form.timeoutSeconds}
                        onChange={(val) => setForm((prev) => ({ ...prev, timeoutSeconds: val ?? 0 }))}
                        min={0}
                        suffix="s"
                        helperText="Duration in seconds before timeout triggers"
                        fullWidth
                      />
                    ) : (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                          Timeout
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: "var(--color-fg-default)" }}>
                          {form.timeoutSeconds > 0 ? `${form.timeoutSeconds} seconds` : "0 (No timeout)"}
                        </Typography>
                      </Box>
                    )}
                  </div>

                  {/* Supported Languages (WeaverSelectField multi select) */}
                  <div className={styles.fullWidth}>
                    {isEditing ? (
                      <WeaverSelectField
                        label="Supported Languages"
                        multiple
                        options={allLanguageOptions}
                        value={form.supportedLanguages}
                        onChange={(val) => {
                          const list = Array.isArray(val) ? val.map(String) : [];
                          setForm((prev) => {
                            let nextDefault = prev.defaultLanguage;
                            if (list.length > 0 && !list.includes(nextDefault)) {
                              nextDefault = list[0];
                            } else if (list.length === 0) {
                              nextDefault = "";
                            }
                            return {
                              ...prev,
                              supportedLanguages: list,
                              defaultLanguage: nextDefault,
                            };
                          });
                        }}
                        placeholder="Select supported languages..."
                        fullWidth
                      />
                    ) : (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                          Supported Languages
                        </Typography>
                        {form.supportedLanguages.length > 0 ? (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                            {form.supportedLanguages.map((code) => {
                              const langObj = availableLanguages.find((l) => l.code === code);
                              return (
                                <Tag
                                  key={code}
                                  text={langObj ? `${langObj.name} (${code})` : code.toUpperCase()}
                                  borderColor="var(--color-border-default)"
                                />
                              );
                            })}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            None configured
                          </Typography>
                        )}
                      </Box>
                    )}
                  </div>

                  {/* Default Language (WeaverSelectField one option) */}
                  <div className={styles.fullWidth}>
                    {isEditing ? (
                      <WeaverSelectField
                        label="Default Language"
                        options={defaultLanguageOptions}
                        value={form.defaultLanguage}
                        onChange={(val) => setForm((prev) => ({ ...prev, defaultLanguage: String(val) }))}
                        disabled={form.supportedLanguages.length === 0}
                        placeholder={
                          form.supportedLanguages.length === 0
                            ? "Select supported languages first"
                            : "Choose default language..."
                        }
                        fullWidth
                      />
                    ) : (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                          Default Language
                        </Typography>
                        {form.defaultLanguage ? (
                          <Tag
                            text={
                              availableLanguages.find((l) => l.code === form.defaultLanguage)?.name
                                ? `${availableLanguages.find((l) => l.code === form.defaultLanguage)?.name} (${form.defaultLanguage})`
                                : form.defaultLanguage.toUpperCase()
                            }
                            borderColor="var(--color-support-fg, #2C8C84)"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            None
                          </Typography>
                        )}
                      </Box>
                    )}
                  </div>

                  {/* Variables (WeaverCodeEditor JSON) */}
                  <div className={styles.fullWidth}>
                    <Box sx={{ mb: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Variables (JSON)
                      </Typography>
                      {jsonErrors.variables && (
                        <Typography variant="caption" color="error" sx={{ fontSize: 11, fontWeight: 600 }}>
                          {jsonErrors.variables}
                        </Typography>
                      )}
                    </Box>
                    <div
                      className={`${styles.editorContainer} ${jsonErrors.variables ? styles.editorContainerError : ""
                        }`}
                    >
                      {isEditing ? (
                        <Suspense fallback={<pre className={styles.readOnlyCode}>{form.variablesText}</pre>}>
                          <WeaverCodeEditor
                            language="json"
                            value={form.variablesText}
                            onChange={(val) => {
                              setForm((prev) => ({ ...prev, variablesText: val }));
                              if (jsonErrors.variables) {
                                setJsonErrors((prev) => ({ ...prev, variables: undefined }));
                              }
                            }}
                            readOnly={false}
                            height="100%"
                            allowFullscreen
                          />
                        </Suspense>
                      ) : (
                        <pre className={styles.readOnlyCode} aria-label="Variables (JSON)">{form.variablesText}</pre>
                      )}
                    </div>
                  </div>

                  {/* Inputs (WeaverCodeEditor JSON) */}
                  <div className={styles.fullWidth}>
                    <Box sx={{ mb: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Inputs (JSON)
                      </Typography>
                      {jsonErrors.inputs && (
                        <Typography variant="caption" color="error" sx={{ fontSize: 11, fontWeight: 600 }}>
                          {jsonErrors.inputs}
                        </Typography>
                      )}
                    </Box>
                    <div
                      className={`${styles.editorContainer} ${jsonErrors.inputs ? styles.editorContainerError : ""
                        }`}
                    >
                      {isEditing ? (
                        <Suspense fallback={<pre className={styles.readOnlyCode}>{form.inputsText}</pre>}>
                          <WeaverCodeEditor
                            language="json"
                            value={form.inputsText}
                            onChange={(val) => {
                              setForm((prev) => ({ ...prev, inputsText: val }));
                              if (jsonErrors.inputs) {
                                setJsonErrors((prev) => ({ ...prev, inputs: undefined }));
                              }
                            }}
                            readOnly={false}
                            height="100%"
                            allowFullscreen
                          />
                        </Suspense>
                      ) : (
                        <pre className={styles.readOnlyCode} aria-label="Inputs (JSON)">{form.inputsText}</pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            {/* 1. Related Queries Section */}
            <div id="workflow-queries-section" className={`${styles.sectionCard} ${styles.scrollSection}`}>
              <div
                className={styles.sectionHeader}
                style={{ marginBottom: queriesExpanded ? 16 : 0 }}
                onClick={() => setQueriesExpanded((prev) => !prev)}
                role="button"
                tabIndex={0}
                aria-expanded={queriesExpanded}
                aria-controls="workflow-queries-content"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setQueriesExpanded((prev) => !prev);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconButton
                    size="small"
                    tabIndex={-1}
                    sx={{
                      color: "var(--color-fg-muted)",
                      transform: queriesExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s ease",
                      p: 0.5,
                    }}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                  <h2 className={styles.cardTitle}>
                    <QueryStatsIcon fontSize="small" sx={{ color: "var(--color-accent-fg)" }} />
                    Queries
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "var(--color-canvas-subtle)",
                        border: "1px solid var(--color-border-default)",
                        color: "var(--color-fg-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {queries.length}
                    </span>
                  </h2>
                </div>
                <Typography variant="caption" color="text.secondary">
                  {queriesExpanded ? "Click to collapse" : "Click to expand"}
                </Typography>
              </div>

              <Collapse in={queriesExpanded} timeout="auto" unmountOnExit={false}>
                <div id="workflow-queries-content">
                  <WeaverRelatedTable
                    records={queries}
                    columns={queryColumns}
                    getRecordId={(r) => r.id || r.name}
                    searchable
                    searchPlaceholder="Search related queries..."
                    pagination
                    pageSizeOptions={[5, 10, 25]}
                    loading={queriesLoading}
                    errorMessage={queriesError}
                    onRowClick={(r) => {
                      const qId = r?.id || r?.queryId;
                      if (qId) navigate(`/queries/${encodeURIComponent(qId)}`);
                    }}
                    emptyState="No related queries found."
                    maxHeight={360}
                  />
                </div>
              </Collapse>
            </div>

            {/* 2. Related Databases Section */}
            <div id="workflow-databases-section" className={`${styles.sectionCard} ${styles.scrollSection}`}>
              <div
                className={styles.sectionHeader}
                style={{ marginBottom: databasesExpanded ? 16 : 0 }}
                onClick={() => setDatabasesExpanded((prev) => !prev)}
                role="button"
                tabIndex={0}
                aria-expanded={databasesExpanded}
                aria-controls="workflow-databases-content"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDatabasesExpanded((prev) => !prev);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconButton
                    size="small"
                    tabIndex={-1}
                    sx={{
                      color: "var(--color-fg-muted)",
                      transform: databasesExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s ease",
                      p: 0.5,
                    }}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                  <h2 className={styles.cardTitle}>
                    <StorageIcon fontSize="small" sx={{ color: "var(--color-accent-fg)" }} />
                    Databases
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "var(--color-canvas-subtle)",
                        border: "1px solid var(--color-border-default)",
                        color: "var(--color-fg-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {databases.length}
                    </span>
                  </h2>
                </div>
                <Typography variant="caption" color="text.secondary">
                  {databasesExpanded ? "Click to collapse" : "Click to expand"}
                </Typography>
              </div>

              <Collapse in={databasesExpanded} timeout="auto" unmountOnExit={false}>
                <div id="workflow-databases-content">
                  <WeaverRelatedTable
                    records={databases}
                    columns={databaseColumns}
                    getRecordId={(r) => r.id}
                    searchable
                    searchPlaceholder="Search related databases..."
                    pagination
                    pageSizeOptions={[5, 10, 25]}
                    loading={databasesLoading}
                    errorMessage={databasesError}
                    onRowClick={(r) => {
                      if (r?.id) navigate(`/databases/${encodeURIComponent(r.id)}`);
                    }}
                    emptyState="No related databases found."
                    maxHeight={360}
                  />
                </div>
              </Collapse>
            </div>

            {/* 3. Related Connections Section */}
            <div id="workflow-connections-section" className={`${styles.sectionCard} ${styles.scrollSection}`}>
              <div
                className={styles.sectionHeader}
                style={{ marginBottom: connectionsExpanded ? 16 : 0 }}
                onClick={() => setConnectionsExpanded((prev) => !prev)}
                role="button"
                tabIndex={0}
                aria-expanded={connectionsExpanded}
                aria-controls="workflow-connections-content"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setConnectionsExpanded((prev) => !prev);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconButton
                    size="small"
                    tabIndex={-1}
                    sx={{
                      color: "var(--color-fg-muted)",
                      transform: connectionsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s ease",
                      p: 0.5,
                    }}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                  <h2 className={styles.cardTitle}>
                    <HubIcon fontSize="small" sx={{ color: "var(--color-accent-fg)" }} />
                    Connections
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "var(--color-canvas-subtle)",
                        border: "1px solid var(--color-border-default)",
                        color: "var(--color-fg-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {connections.length}
                    </span>
                  </h2>
                </div>
                <Typography variant="caption" color="text.secondary">
                  {connectionsExpanded ? "Click to collapse" : "Click to expand"}
                </Typography>
              </div>

              <Collapse in={connectionsExpanded} timeout="auto" unmountOnExit={false}>
                <div id="workflow-connections-content">
                  <WeaverRelatedTable
                    records={connections}
                    columns={connectionColumns}
                    getRecordId={(r) => r.id}
                    searchable
                    searchPlaceholder="Search related connections..."
                    pagination
                    pageSizeOptions={[5, 10, 25]}
                    loading={connectionsLoading}
                    errorMessage={connectionsError}
                    onRowClick={(r) => {
                      if (r?.id) navigate(`/connections/${encodeURIComponent(r.id)}`);
                    }}
                    emptyState="No related connections found."
                    maxHeight={360}
                  />
                </div>
              </Collapse>
            </div>

            {/* 4. Related Scripts Section */}
            <div id="workflow-scripts-section" className={`${styles.sectionCard} ${styles.scrollSection}`}>
              <div
                className={styles.sectionHeader}
                style={{ marginBottom: scriptsExpanded ? 16 : 0 }}
                onClick={() => setScriptsExpanded((prev) => !prev)}
                role="button"
                tabIndex={0}
                aria-expanded={scriptsExpanded}
                aria-controls="workflow-scripts-content"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setScriptsExpanded((prev) => !prev);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconButton
                    size="small"
                    tabIndex={-1}
                    sx={{
                      color: "var(--color-fg-muted)",
                      transform: scriptsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s ease",
                      p: 0.5,
                    }}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                  <h2 className={styles.cardTitle}>
                    <CodeIcon fontSize="small" sx={{ color: "var(--color-accent-fg)" }} />
                    Scripts
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "var(--color-canvas-subtle)",
                        border: "1px solid var(--color-border-default)",
                        color: "var(--color-fg-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {scripts.length}
                    </span>
                  </h2>
                </div>
                <Typography variant="caption" color="text.secondary">
                  {scriptsExpanded ? "Click to collapse" : "Click to expand"}
                </Typography>
              </div>

              <Collapse in={scriptsExpanded} timeout="auto" unmountOnExit={false}>
                <div id="workflow-scripts-content">
                  <WeaverRelatedTable
                    records={scripts}
                    columns={scriptColumns}
                    getRecordId={(r) => r.id || r.name}
                    searchable
                    searchPlaceholder="Search related scripts..."
                    pagination
                    pageSizeOptions={[5, 10, 25]}
                    loading={scriptsLoading}
                    errorMessage={scriptsError}
                    onRowClick={(r) => {
                      const sId = r?.id || r?.name;
                      if (sId) navigate(`/scripts/${encodeURIComponent(sId)}`);
                    }}
                    emptyState="No related scripts found."
                    maxHeight={360}
                  />
                </div>
              </Collapse>
            </div>

            {/* 5. Activity Timeline Section */}
            <div id="workflow-activity-section" className={`${styles.sectionCard} ${styles.scrollSection}`}>
              <div
                className={styles.sectionHeader}
                style={{ marginBottom: activityExpanded ? 16 : 0 }}
                onClick={() => setActivityExpanded((prev) => !prev)}
                role="button"
                tabIndex={0}
                aria-expanded={activityExpanded}
                aria-controls="workflow-activity-content"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActivityExpanded((prev) => !prev);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconButton
                    size="small"
                    tabIndex={-1}
                    sx={{
                      color: "var(--color-fg-muted)",
                      transform: activityExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s ease",
                      p: 0.5,
                    }}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                  <h2 className={styles.cardTitle}>
                    <TimelineRoundedIcon fontSize="small" sx={{ color: "var(--color-accent-fg)" }} />
                    Activity Timeline
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "var(--color-canvas-subtle)",
                        border: "1px solid var(--color-border-default)",
                        color: "var(--color-fg-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {timelineActions.length}
                    </span>
                  </h2>
                </div>
                <Typography variant="caption" color="text.secondary">
                  {activityExpanded ? "Click to collapse" : "Click to expand"}
                </Typography>
              </div>

              <Collapse in={activityExpanded} timeout="auto" unmountOnExit={false}>
                <div id="workflow-activity-content" style={{ paddingTop: 8 }}>
                  <ActivityTimeline
                    actions={timelineActions}
                    position="alternate"
                    emptyText="No workflow activity recorded."
                  />
                </div>
              </Collapse>
            </div>
          </div>


        </div>
      )}
    </div>
  );
}
