import React, { isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { Copy, Layers } from "lucide-react";
import { WorkflowTreeGraphic } from "@/components/common/data/internal/DataCanvasCard";
import { WeaverButton } from "@/components/common/buttons";

import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverCanvasConfig,
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import Tag from "@/components/common/data/Tag/Tag";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import { useConductorMetadataService } from "@/features/workflows/services/conductorMetadataService";
import { getErrorMessage } from "@/utils/error";
import { toTimezoneDateTime } from "@/utils/dateTime";
import { config } from "@/config/appConfig";
import apiClient from "@/services/apiClient";
import { AuthContext } from "@/features/auth/context/AuthContext";
import {
  buildWorkflowPayload,
  filterWorkflows,
  getLatestWorkflows,
  normalizeWorkflows,
} from "@/features/workflows/services/workflowsService";
import styles from "./WorkflowsPageContent.module.css";

const BACKEND_DOWN_MESSAGE = "Unable to reach backend service. Please ensure backend is running.";

const AVATAR_PALETTE = [
  "#D9102B", // Weaver Primary Crimson
  "#0284C7", // Sky Blue
  "#0D9488", // Teal
  "#7C3AED", // Violet
  "#D97706", // Amber
  "#059669", // Emerald
  "#EA580C", // Tangerine
  "#4F46E5", // Indigo
];

function getDeterministicAvatarColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

interface ResolvedUserDisplay {
  name: string;
  initials: string;
  avatarColor: string;
  tooltip?: string;
}

function resolveUserDisplay(
  rawInput: unknown,
  currentUser?: {
    username?: string;
    email?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    id?: string;
  } | null
): ResolvedUserDisplay | null {
  const raw = String(rawInput ?? "").trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") {
    return null;
  }

  const rawLower = raw.toLowerCase();

  // Match against current logged-in user profile
  const currentEmailLower = currentUser?.email?.toLowerCase();
  const currentUsernameLower = currentUser?.username?.toLowerCase();
  const currentFullNameLower = currentUser?.fullName?.toLowerCase();
  const currentCompositeName = `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim().toLowerCase();

  const isCurrentUser =
    (currentEmailLower && rawLower === currentEmailLower) ||
    (currentUsernameLower && rawLower === currentUsernameLower) ||
    (currentUser?.id && raw === currentUser.id) ||
    (currentFullNameLower && rawLower === currentFullNameLower) ||
    (currentCompositeName && rawLower === currentCompositeName) ||
    // Development environment fallback: admin user created workflows
    (rawLower.startsWith("admin@weaver") || rawLower === "admin");

  if (isCurrentUser) {
    const fullName =
      currentUser?.fullName?.trim() ||
      `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim() ||
      "Hossam Hamdy";

    let initials = "HH";
    if (currentUser?.firstName && currentUser?.lastName) {
      initials = `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    } else {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      } else if (parts[0]?.length >= 2) {
        initials = parts[0].slice(0, 2).toUpperCase();
      }
    }

    const colorIdentifier = currentUser?.username || "admin";

    return {
      name: fullName,
      initials,
      avatarColor: getDeterministicAvatarColor(colorIdentifier),
      tooltip: `${fullName} (${raw})`,
    };
  }

  // Parse email or custom string
  let displayName = raw;
  let initials = "?";

  if (raw.includes("@")) {
    const localPart = raw.split("@")[0].trim();
    const parts = localPart.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      displayName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    } else if (parts.length === 1) {
      displayName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
      initials = parts[0].length >= 2 ? parts[0].slice(0, 2).toUpperCase() : parts[0].toUpperCase();
    }
  } else {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      displayName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    } else if (parts.length === 1) {
      displayName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
      initials = parts[0].length >= 2 ? parts[0].slice(0, 2).toUpperCase() : parts[0].toUpperCase();
    }
  }

  return {
    name: displayName,
    initials,
    avatarColor: getDeterministicAvatarColor(raw),
    tooltip: raw,
  };
}

const shortenText = (value: any, maxLength = 48) => {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 75, 100];
const DEFAULT_VISIBLE_FIELDS = ["name", "version", "description", "createdAt", "updatedAt"];

export interface WorkflowsPageContentProps {
  onNotify?: ((payload: { severity?: string; message?: string } | null) => void) | null;
  search?: string;
}

export default function WorkflowsTab({ onNotify = null, search = "" }: WorkflowsPageContentProps) {
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.user || null;
  const [workflowPage, setWorkflowPage] = useState(0);
  const [workflowRowsPerPage, setWorkflowRowsPerPage] = useState(25);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    warnings: string[];
    actionLabel: string;
    confirmPhrase: string;
    onConfirm: (() => void) | null;
  }>({
    open: false,
    title: "Delete workflow?",
    description: "You are about to delete workflow.",
    warnings: [],
    actionLabel: "Delete",
    confirmPhrase: "DELETE",
    onConfirm: null,
  });
  const [confirmValidationMessage, setConfirmValidationMessage] = useState("");
  const [confirmValidationWorkflows, setConfirmValidationWorkflows] = useState<any[]>([]);
  const backendDownNotifiedRef = useRef(false);

  // Single cached list; pagination happens client-side in WeaverDataExplorer.
  const { workflows, saveWorkflow, deleteWorkflow } = useConductorMetadataService();
  const { refetch: refetchWorkflows } = workflows;
  const [duplicatingWorkflowName, setDuplicatingWorkflowName] = useState<string | null>(null);
  const [deletingWorkflowKey, setDeletingWorkflowKey] = useState<string | null>(null);

  const workflowsData = useMemo(() => {
    if (Array.isArray(workflows.data)) return workflows.data;
    if (Array.isArray((workflows.data as any)?.data)) return (workflows.data as any).data;
    return [];
  }, [workflows.data]);

  const normalizedWorkflows = useMemo(
    () => normalizeWorkflows(workflowsData),
    [workflowsData]
  );
  const workflowsErrorMessage = useMemo(
    () => (workflows.error ? getErrorMessage(workflows.error, "Failed to load workflows.") : ""),
    [workflows.error]
  );

  const latestWorkflows = useMemo(
    () => getLatestWorkflows(normalizedWorkflows),
    [normalizedWorkflows]
  );

  const normalizedSearch = String(search || "").trim();
  const [debouncedSearch, setDebouncedSearch] = useState(normalizedSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(normalizedSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [normalizedSearch]);

  // When a search starts, remember the current page and jump to page 0; restore it when the
  // search is cleared. Done during render (not in an effect) to avoid an extra commit.
  const rawSearchActive = Boolean(normalizedSearch);
  const [wasSearchActive, setWasSearchActive] = useState(rawSearchActive);
  const [pageBeforeSearch, setPageBeforeSearch] = useState(0);
  if (rawSearchActive !== wasSearchActive) {
    setWasSearchActive(rawSearchActive);
    if (rawSearchActive) {
      setPageBeforeSearch(workflowPage);
      setWorkflowPage(0);
    } else {
      setWorkflowPage(pageBeforeSearch);
    }
  }

  useEffect(() => {
    if (workflowsErrorMessage !== BACKEND_DOWN_MESSAGE) {
      backendDownNotifiedRef.current = false;
      return;
    }

    if (backendDownNotifiedRef.current) return;
    backendDownNotifiedRef.current = true;
    onNotify?.({ severity: "error", message: BACKEND_DOWN_MESSAGE });
  }, [onNotify, workflowsErrorMessage]);

  const filteredWorkflows = useMemo(() => {
    return filterWorkflows(latestWorkflows, debouncedSearch);
  }, [latestWorkflows, debouncedSearch]);

  const isSearchActive = Boolean(debouncedSearch);
  const rowCount = filteredWorkflows.length;

  const getWorkflowKey = useCallback(
    (workflow: any) => {
      const name = String(workflow?.name || workflow?.workflowName || "").trim();
      const version = workflow?.version ?? 1;
      return `${name}@${version}`;
    },
    []
  );

  const handleOpenInDesigner = useCallback(
    (wf: any) => {
      const workflowName = String(wf?.name || wf?.workflowName || "").trim();
      if (!workflowName) {
        onNotify?.({
          severity: "error",
          message: "Workflow name is missing.",
        });
        return;
      }

      const versionQuery = wf?.version != null ? `?version=${encodeURIComponent(String(wf.version))}` : "";
      window.open(
        `/designer/${encodeURIComponent(workflowName)}${versionQuery}`,
        "_blank",
        "noopener,noreferrer"
      );
    },
    [onNotify]
  );

  const handleCreateNewWorkflow = useCallback(() => {
    window.open("/designer", "_blank", "noopener,noreferrer");
  }, []);

  const openDeleteConfirm = useCallback(
    ({ title, description, warnings, onConfirm, confirmPhrase }: any) => {
      setConfirmState({
        open: true,
        title,
        description,
        warnings: Array.isArray(warnings) ? warnings : [],
        actionLabel: "Delete",
        confirmPhrase: confirmPhrase || "DELETE",
        onConfirm,
      });
      setConfirmValidationMessage("");
      setConfirmValidationWorkflows([]);
    },
    []
  );

  const handleDuplicateWorkflow = useCallback(
    async (wf: any) => {
      const sourceName = String(wf?.name || wf?.workflowName || "").trim();
      if (!sourceName) {
        onNotify?.({
          severity: "error",
          message: "Workflow name is missing.",
        });
        return;
      }

      setDuplicatingWorkflowName(sourceName);

      try {
        const existingNames = new Set(
          workflowsData.map((w: any) =>
            String(w?.name || w?.workflowName || "").trim().toLowerCase()
          )
        );

        let duplicateName = `${sourceName}_copy`;
        let counter = 1;
        while (existingNames.has(duplicateName.toLowerCase())) {
          duplicateName = `${sourceName}_copy_${counter}`;
          counter++;
        }

        let sourceDefinition = wf;
        if (!Array.isArray(wf?.tasks) || wf.tasks.length === 0) {
          try {
            const res = await apiClient.get<any>(
              `${config.apiBaseUrl}/api/metadata/workflow/${encodeURIComponent(sourceName)}`
            );
            if (res?.data) {
              sourceDefinition = res.data;
            }
          } catch {
            // Fall back to current workflow definition object
          }
        }

        const payload = {
          ...buildWorkflowPayload(sourceDefinition),
          name: duplicateName,
          version: 1,
        };

        await saveWorkflow.mutateAsync(payload);
        onNotify?.({
          severity: "success",
          message: `Workflow "${sourceName}" duplicated as "${duplicateName}".`,
        });
      } catch (err) {
        const message = getErrorMessage(err, "Failed to duplicate workflow.");
        onNotify?.({ severity: "error", message });
      } finally {
        setDuplicatingWorkflowName(null);
      }
    },
    [onNotify, saveWorkflow, workflowsData]
  );

  const handleHoldDeleteWorkflow = useCallback(
    async (wf: any) => {
      const workflowName = String(wf?.name || wf?.workflowName || "").trim();
      if (!workflowName) {
        onNotify?.({
          severity: "error",
          message: "Workflow name is missing.",
        });
        return;
      }
      const version = wf?.version ?? 1;
      const key = getWorkflowKey(wf);
      setDeletingWorkflowKey(key);

      try {
        await deleteWorkflow.mutateAsync({ name: workflowName, version });
        onNotify?.({ message: `Workflow "${workflowName}" deleted.` });
      } catch (error) {
        const message = getErrorMessage(error, "Delete failed.");
        onNotify?.({ severity: "error", message });
      } finally {
        setDeletingWorkflowKey(null);
      }
    },
    [deleteWorkflow, getWorkflowKey, onNotify]
  );

  const confirmDeleteWorkflow = useCallback(
    (wf: any) => {
      const workflowName = String(wf?.name || wf?.workflowName || "").trim();
      if (!workflowName) {
        onNotify?.({
          severity: "error",
          message: "Workflow name is missing.",
        });
        return;
      }
      const version = wf?.version ?? 1;

      openDeleteConfirm({
        title: `Delete workflow "${workflowName}"?`,
        description: `You are about to delete workflow "${workflowName}" (v${version}).`,
        warnings: [
          "This action can't be undone.",
          "For active workflows, this can impact running executions.",
        ],
        confirmPhrase: workflowName,
        onConfirm: () => {
          deleteWorkflow.mutate(
            { name: workflowName, version },
            {
              onSuccess: () => {
                onNotify?.({ message: `Workflow "${workflowName}" deleted.` });
              },
              onError: (error) => {
                const message = getErrorMessage(error, "Delete failed.");
                onNotify?.({ severity: "error", message });
              },
            }
          );
        },
      });
    },
    [deleteWorkflow, onNotify, openDeleteConfirm]
  );

  // Field definitions for WeaverDataExplorer
  const fields = useMemo<WeaverDataField<any>[]>(
    () => [
      {
        key: "name",
        label: "Workflow Name",
        getValue: (r) => r.name || r.workflowName,
        searchable: true,
        sortable: true,
        width: 240,
        render: (val, r) => {
          const name = String(val || "-");
          return (
            <Typography
              component="span"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenInDesigner(r);
              }}
              sx={{
                fontWeight: 600,
                textAlign: "left",
                color: "var(--color-fg-default, text.primary) !important",
                cursor: "pointer",
                display: "inline-block",
                "&:hover": {
                  color: "var(--hue-blue, #2563eb) !important",
                  textDecoration: "underline",
                },
              }}
            >
              {name}
            </Typography>
          );
        },
      },
      {
        key: "version",
        label: "Version",
        getValue: (r) => r.version,
        type: "number",
        sortable: true,
        width: 110,
        render: (val) => {
          if (val == null || val === "") return "-";
          return (
            <Tag
              text={`v${val}`}
              color="#0f8a61"
              borderColor="#0f8a61"
            />
          );
        },
      },
      {
        key: "description",
        label: "Description",
        getValue: (r) => r.description ?? "",
        searchable: true,
        width: 280,
        render: (val) => (
          <Typography
            variant="body2"
            title={val || "-"}
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.3,
              maxWidth: 320,
            }}
          >
            {shortenText(val)}
          </Typography>
        ),
      },
      {
        key: "createdAt",
        label: "Created At",
        getValue: (r) => r.createdAt,
        sortable: true,
        width: 200,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
      {
        key: "createdBy",
        label: "Created By",
        getValue: (r) => {
          const userDisplay = resolveUserDisplay(r.createdBy, currentUser);
          return userDisplay ? userDisplay.name : (r.createdBy || "-");
        },
        visibleByDefault: false,
        sortable: true,
        width: 190,
        render: (_val, r) => {
          const userDisplay = resolveUserDisplay(r.createdBy, currentUser);
          if (!userDisplay) {
            return <span className={styles.emptyUserCell}>—</span>;
          }
          return (
            <div className={styles.userAvatarCell} title={userDisplay.tooltip || userDisplay.name}>
              <span
                className={styles.userAvatar}
                style={{ backgroundColor: userDisplay.avatarColor }}
                aria-hidden="true"
              >
                {userDisplay.initials}
              </span>
              <span className={styles.userDisplayName}>{userDisplay.name}</span>
            </div>
          );
        },
      },
      {
        key: "updatedAt",
        label: "Updated At",
        getValue: (r) => r.updatedAt,
        sortable: true,
        width: 200,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
      {
        key: "updatedBy",
        label: "Updated By",
        getValue: (r) => {
          const userDisplay = resolveUserDisplay(r.updatedBy, currentUser);
          return userDisplay ? userDisplay.name : (r.updatedBy || "-");
        },
        visibleByDefault: false,
        sortable: true,
        width: 190,
        render: (_val, r) => {
          const userDisplay = resolveUserDisplay(r.updatedBy, currentUser);
          if (!userDisplay) {
            return <span className={styles.emptyUserCell}>—</span>;
          }
          return (
            <div className={styles.userAvatarCell} title={userDisplay.tooltip || userDisplay.name}>
              <span
                className={styles.userAvatar}
                style={{ backgroundColor: userDisplay.avatarColor }}
                aria-hidden="true"
              >
                {userDisplay.initials}
              </span>
              <span className={styles.userDisplayName}>{userDisplay.name}</span>
            </div>
          );
        },
      },
    ],
    [currentUser, handleOpenInDesigner]
  );

  // Toolbar Actions: direct "+ New Workflow" button without dropdown options
  const toolbarActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "new_workflow",
        label: "New Workflow",
        icon: <AddIcon fontSize="small" />,
        asButton: true,
        buttonVariant: "contained",
        buttonColor: "primary",
        onClick: handleCreateNewWorkflow,
      },
    ],
    [handleCreateNewWorkflow]
  );

  // Row Actions: Duplicate and Delete
  const rowActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "duplicate",
        label: "Duplicate",
        icon: <Copy size={16} />,
        onClick: ({ record }) => {
          if (record) {
            handleDuplicateWorkflow(record);
          }
        },
      },
      {
        id: "delete",
        label: "Delete",
        danger: true,
        icon: <DeleteOutlineIcon fontSize="small" />,
        onClick: ({ record }) => {
          if (record) {
            confirmDeleteWorkflow(record);
          }
        },
      },
    ],
    [confirmDeleteWorkflow, handleDuplicateWorkflow]
  );

  const canvas = useMemo<WeaverCanvasConfig<any>>(
    () => ({
      layout: "centered",
      hideRowActions: true,
      getTitle: (wf) => wf.name || wf.workflowName || "Untitled Workflow",
      getDescription: (wf) => wf.description || "No description provided.",
      renderStatus: (wf) => (wf.version !== undefined && wf.version !== null ? `v${wf.version}` : "v1"),
      renderIcon: (wf) => {
        const customImage =
          wf.iconUrl ||
          wf.imageUrl ||
          wf.metadata?.iconUrl ||
          wf.metadata?.imageUrl ||
          (typeof wf.icon === "string" &&
          (wf.icon.startsWith("http") || wf.icon.startsWith("/") || wf.icon.startsWith("data:"))
            ? wf.icon
            : null);

        if (customImage) {
          return (
            <img
              src={customImage}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
              }}
            />
          );
        }

        if (isValidElement(wf.icon)) {
          return wf.icon;
        }

        return <Layers size={38} color="#ffffff" strokeWidth={2.2} />;
      },
      renderQuickActions: (wf) => {
        const wfName = wf.name || wf.workflowName;
        const wfKey = getWorkflowKey(wf);
        const isDuplicating = duplicatingWorkflowName === wfName;
        const isDeleting = deletingWorkflowKey === wfKey;
        const isActionDisabled = Boolean(duplicatingWorkflowName) || Boolean(deletingWorkflowKey);

        return (
          <div
            className={styles.cardActionsGroup}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <WeaverButton
              variant="outlined"
              size="small"
              className={styles.duplicateBtn}
              icon={<Copy size={14} />}
              loading={isDuplicating}
              loadingLabel="Duplicating..."
              disabled={isActionDisabled}
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicateWorkflow(wf);
              }}
            >
              Duplicate
            </WeaverButton>

            <WeaverButton
              mode="delete"
              variant="outlined"
              size="small"
              className={styles.deleteHoldBtn}
              loading={isDeleting}
              loadingLabel="Deleting..."
              holdLabel="Hold to delete..."
              holdDuration={1500}
              disabled={isActionDisabled}
              onAction={() => handleHoldDeleteWorkflow(wf)}
            >
              Delete
            </WeaverButton>
          </div>
        );
      },
    }),
    [
      deletingWorkflowKey,
      duplicatingWorkflowName,
      getWorkflowKey,
      handleDuplicateWorkflow,
      handleHoldDeleteWorkflow,
    ]
  );

  const paginationModel = useMemo(
    () => ({ page: workflowPage, pageSize: workflowRowsPerPage }),
    [workflowPage, workflowRowsPerPage]
  );

  const handlePaginationChange = useCallback(
    ({ page, pageSize }: { page: number; pageSize: number }) => {
      if (isSearchActive) return;
      setWorkflowPage(page);
      if (pageSize !== workflowRowsPerPage) {
        setWorkflowRowsPerPage(pageSize);
        setWorkflowPage(0);
      }
    },
    [isSearchActive, workflowRowsPerPage]
  );

  return (
    <>
      {workflows.error && workflowsErrorMessage !== BACKEND_DOWN_MESSAGE && (
        <Typography className="definitions-error" sx={{ mb: 2 }}>
          {workflowsErrorMessage || "Failed to load workflows."}
        </Typography>
      )}

      {(deleteWorkflow.isPending) && (
        <Typography className="definitions-status" sx={{ mb: 2 }}>
          Processing...
        </Typography>
      )}

      <WeaverDataExplorer<any>
        records={isSearchActive ? filteredWorkflows : latestWorkflows}
        getRecordId={getWorkflowKey}
        fields={fields}
        storageKey="workflows"
        defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
        dataMode="client"
        selectionMode="none"
        loading={workflows.isLoading}
        errorMessage={
          workflows.error && workflowsErrorMessage !== BACKEND_DOWN_MESSAGE
            ? workflowsErrorMessage
            : undefined
        }
        searchable
        searchValue={debouncedSearch}
        onSearchChange={setDebouncedSearch}
        searchPlaceholder="Search workflows..."
        stickyHeader
        height="calc(100vh - 104px)"
        toolbarActions={toolbarActions}
        rowActions={rowActions}
        onRecordClick={handleOpenInDesigner}
        pagination
        totalRecords={rowCount}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        paginationModel={paginationModel}
        onPaginationChange={handlePaginationChange}
        canvas={canvas}
      />

      <WeaverConfirmDialog
        intent="danger"
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.description}
        description={confirmState.warnings?.join(" ")}
        confirmLabel={confirmState.actionLabel}
        textConfirmation={{ expectedText: confirmState.confirmPhrase }}
        relatedRecordsTitle="Used by workflows"
        relatedRecords={confirmValidationWorkflows.map((name) => ({ id: name, title: name }))}
        onCancel={() => {
          setConfirmState((prev) => ({ ...prev, open: false }));
        }}
        onConfirm={() => {
          setConfirmState((prev) => ({ ...prev, open: false }));
          setConfirmValidationMessage("");
          setConfirmValidationWorkflows([]);
          confirmState.onConfirm?.();
        }}
      >
        {confirmValidationMessage ? (
          <Typography variant="body2" color="error">
            {confirmValidationMessage}
          </Typography>
        ) : null}
      </WeaverConfirmDialog>
    </>
  );
}

WorkflowsTab.propTypes = {
  onNotify: PropTypes.func,
  search: PropTypes.string,
};
