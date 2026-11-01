import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

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
import {
  filterWorkflows,
  getLatestWorkflows,
  normalizeWorkflows,
} from "@/features/workflows/services/workflowsService";

const BACKEND_DOWN_MESSAGE = "Unable to reach backend service. Please ensure backend is running.";

const shortenText = (value: any, maxLength = 48) => {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 75, 100];
const DEFAULT_VISIBLE_FIELDS = ["name", "version", "description", "createdAt"];

export interface WorkflowsPageContentProps {
  onNotify?: ((payload: { severity?: string; message?: string } | null) => void) | null;
  search?: string;
}

export default function WorkflowsTab({ onNotify = null, search = "" }: WorkflowsPageContentProps) {
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
  const { workflows, deleteWorkflow } = useConductorMetadataService();
  const { refetch: refetchWorkflows } = workflows;

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
        key: "id",
        label: "ID",
        getValue: (r) => r.id,
        visibleByDefault: false,
        hideable: true,
        width: 220,
      },
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
          return <Tag text={`v${val}`} borderColor="var(--color-support-fg, #2C8C84)" />;
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
        getValue: (r) => r.createdBy || "-",
        visibleByDefault: false,
        width: 160,
      },
      {
        key: "updatedAt",
        label: "Last Updated",
        getValue: (r) => r.updatedAt,
        sortable: true,
        width: 200,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
      {
        key: "updatedBy",
        label: "Updated By",
        getValue: (r) => r.updatedBy || "-",
        visibleByDefault: false,
        width: 160,
      },
    ],
    [handleOpenInDesigner]
  );

  // Toolbar Actions
  const toolbarActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "new_workflow",
        label: "New Workflow",
        primary: true,
        icon: <AddIcon fontSize="small" />,
        onClick: handleCreateNewWorkflow,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: <RefreshIcon fontSize="small" />,
        onClick: () => {
          refetchWorkflows();
        },
      },
    ],
    [handleCreateNewWorkflow, refetchWorkflows]
  );

  // Row Actions (View/Edit Details removed; only Open in Designer and Delete)
  const rowActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "open",
        label: "Open in Designer",
        icon: <OpenInNewIcon fontSize="small" />,
        onClick: ({ record }) => {
          handleOpenInDesigner(record);
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
    [confirmDeleteWorkflow, handleOpenInDesigner]
  );

  const canvas = useMemo<WeaverCanvasConfig<any>>(
    () => ({
    renderIcon: () => (
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          backgroundColor: "#2C8C84",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          boxShadow: (theme) =>
            `0 4px 14px ${alpha("#2C8C84", theme.palette.mode === "dark" ? 0.45 : 0.3)}`,
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "scale(1.06)",
          },
        }}
      >
        <AccountTreeIcon sx={{ fontSize: 26, color: "#ffffff" }} />
      </Box>
    ),
    renderStatus: (wf) => (
      <Tag
        text={`v${wf.version ?? 1}`}
        borderColor="var(--color-support-fg, #2C8C84)"
      />
    ),
    getTitle: (wf) => wf.name || wf.workflowName || "Untitled Workflow",
    renderContent: (wf, context) => {
      const isVisible = (fieldKey: string) => {
        if (!context?.visibleFields) return true;
        return context.visibleFields.includes(fieldKey);
      };

      return (
        <Stack spacing={0.75} sx={{ width: "100%", fontSize: "0.82rem" }}>
          {isVisible("description") && wf.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.4,
                minHeight: "2.8em",
              }}
            >
              {wf.description}
            </Typography>
          )}
          {isVisible("createdAt") && wf.createdAt && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                color: "var(--color-fg-muted)",
                fontSize: "0.78rem",
              }}
            >
              <span>Created</span>
              <span>{toTimezoneDateTime(wf.createdAt, "Africa/Cairo") || "-"}</span>
            </Box>
          )}
          {isVisible("updatedAt") && wf.updatedAt && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                color: "var(--color-fg-muted)",
                fontSize: "0.78rem",
              }}
            >
              <span>Updated</span>
              <span>{toTimezoneDateTime(wf.updatedAt, "Africa/Cairo") || "-"}</span>
            </Box>
          )}
        </Stack>
      );
    },
    quickActions: [
      {
        id: "open",
        label: "Open in Designer",
        icon: <OpenInNewIcon fontSize="small" />,
        onClick: ({ record }) => handleOpenInDesigner(record),
      },
    ],
  }),
    [handleOpenInDesigner]
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
        height="calc(100vh - 220px)"
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
