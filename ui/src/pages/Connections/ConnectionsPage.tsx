import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Link } from "@mui/material";
import { alpha } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import { useNavigate, useOutletContext } from "react-router-dom";

import type { AppLayoutContext } from "@/app/layout/AppLayout";
import { useWeaverNotification } from "@/components/common/notifications";
import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import Tag from "@/components/common/data/Tag/Tag";
import { toTimezoneDateTime } from "@/utils/dateTime";
import { getErrorMessage } from "@/utils/error";
import { useQueryClient } from "@tanstack/react-query";
import { connectionKeys, deleteConnection, useConnectionsList } from "@/features/connections";
import "@/styles/definitionPages.css";

const extractList = (body: any) => {
  const candidates = [
    body?.data?.items,
    body?.data?.content,
    body?.data?.records,
    body?.items,
    body?.content,
    body?.records,
    body?.data,
    body,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const extractTotal = (body: any, fallback: number) => {
  const total =
    body?.totalElements ??
    body?.totalItems ??
    body?.data?.totalElements ??
    body?.data?.totalItems ??
    body?.details?.totalElements ??
    body?.data?.details?.totalElements ??
    body?.details?.totalItems ??
    fallback;
  return Number(total) || 0;
};

interface ConnectionRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string | number | null;
  updatedAt: string | number | null;
}

const normalizeStatus = (value: any) => {
  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return "-";
  if (normalized === "TRUE") return "ACTIVE";
  if (normalized === "FALSE") return "INACTIVE";
  return normalized;
};

const normalizeType = (item: any) => {
  const value =
    item?.type ??
    item?.connectionType ??
    item?.strategy ??
    item?.authType ??
    item?.protocol ??
    item?.authConfig?.type ??
    item?.authConfig?.strategy;
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || "-";
};

const EMPTY_CONNECTIONS: ConnectionRecord[] = [];
const getConnectionRecordId = (r: ConnectionRecord) => r.id;
const DEFAULT_VISIBLE_FIELDS = ["name", "type", "status", "createdAt"];
const PAGE_SIZE_OPTIONS = [20, 25, 50, 75, 100];

const CONNECTIONS_CANVAS = {
  renderIcon: () => (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        backgroundColor: "#2563EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        boxShadow: (theme) =>
          `0 4px 14px ${alpha("#2563EB", theme.palette.mode === "dark" ? 0.45 : 0.3)}`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "scale(1.06)",
        },
      }}
    >
      <HubOutlinedIcon sx={{ fontSize: 26, color: "#ffffff" }} />
    </Box>
  ),
  renderStatus: (r: ConnectionRecord) => {
    const value = String(r?.status || "").toUpperCase();
    const color = value === "ACTIVE" ? "#22c55e" : value === "INACTIVE" ? "#ef4444" : "#94a3b8";
    return <Tag text={value || "-"} color={color} borderColor={color} />;
  },
  primaryFieldKey: "name",
  secondaryFieldKey: "type",
  descriptionFieldKey: "type",
};

export default function ConnectionsPage() {
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };

  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    warnings: string[];
    confirmPhrase: string;
    onConfirm: (() => Promise<void>) | null;
  }>({
    open: false,
    title: "Delete connections?",
    description: "You are about to delete connections.",
    warnings: [],
    confirmPhrase: "DELETE",
    onConfirm: null,
  });

  const {
    data: connectionsResponse,
    error: connectionsError,
    isFetching: loading,
    refetch: refetchConnections,
  } = useConnectionsList({
    page,
    size: pageSize,
    sort: "createdAt,DESC",
  });

  const { items, rowCount } = useMemo(() => {
    if (!connectionsResponse) return { items: EMPTY_CONNECTIONS, rowCount: 0 };
    const response = connectionsResponse;
    const body = response?.data ?? {};
    const data = extractList(body);
    const normalized: ConnectionRecord[] = data.map((item: any, index: number) => ({
      id: item?.id ?? item?.connectionId ?? item?.name ?? `connection-${index + 1}`,
      name: item?.name ?? item?.connectionName ?? "-",
      type: normalizeType(item),
      status: normalizeStatus(item?.status ?? item?.connectionStatus ?? "-"),
      createdAt: item?.createdAt ?? null,
      updatedAt: item?.updatedAt ?? null,
    }));
    return { items: normalized, rowCount: extractTotal(response, extractTotal(body, normalized.length)) };
  }, [connectionsResponse]);

  useEffect(() => {
    if (connectionsError) showError(getErrorMessage(connectionsError, "Failed to fetch connections."));
  }, [connectionsError, showError]);

  useEffect(() => {
    document.title = "HTTP Connections";
  }, []);

  const fields = useMemo<WeaverDataField<ConnectionRecord>[]>(
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
        label: "Name",
        getValue: (r) => r.name,
        searchable: true,
        sortable: true,
        width: 200,
        render: (val, r) => {
          const id = String(r?.id || "").trim();
          const name = String(val || "-");
          if (!id) return name;
          return (
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/connections/${encodeURIComponent(id)}`);
              }}
              sx={{ fontWeight: 600, textAlign: "left", color: "primary.main" }}
            >
              {name}
            </Link>
          );
        },
      },
      {
        key: "type",
        label: "Type",
        getValue: (r) => r.type,
        searchable: true,
        sortable: true,
        width: 150,
        render: (val) => {
          const value = String(val || "-").toUpperCase();
          return <Tag text={value} color="#60a5fa" borderColor="#60a5fa" />;
        },
      },
      {
        key: "status",
        label: "Status",
        getValue: (r) => r.status,
        type: "enum",
        sortable: true,
        width: 130,
        options: [
          { label: "ACTIVE", value: "ACTIVE" },
          { label: "INACTIVE", value: "INACTIVE" },
        ],
        render: (val) => {
          const value = String(val || "").toUpperCase();
          const color = value === "ACTIVE" ? "#22c55e" : value === "INACTIVE" ? "#ef4444" : "#94a3b8";
          return <Tag text={value || "-"} color={color} borderColor={color} />;
        },
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
        key: "updatedAt",
        label: "Updated At",
        getValue: (r) => r.updatedAt,
        visibleByDefault: false,
        hideable: true,
        sortable: true,
        width: 200,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
    ],
    [navigate]
  );

  const isSearchActive = Boolean(String(search || "").trim());

  const filteredItems = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        String(item?.name || "").toLowerCase().includes(q) ||
        String(item?.type || "").toLowerCase().includes(q) ||
        String(item?.status || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const openDeleteConfirm = useCallback(
    ({ selectedRows }: { selectedRows?: ConnectionRecord[] }) => {
      const list = Array.isArray(selectedRows) ? selectedRows : [];
      if (!list.length) return;
      const confirmPhrase = list.length === 1 ? String(list[0]?.name || "DELETE") : "DELETE";

      setConfirmState({
        open: true,
        title: `Delete ${list.length} connection${list.length > 1 ? "s" : ""}?`,
        description: `You're about to delete ${list.length} connection${list.length > 1 ? "s" : ""}.`,
        warnings: ["This action can't be undone."],
        confirmPhrase,
        onConfirm: async () => {
          await Promise.all(
            list
              .map((item) => item?.id)
              .filter(Boolean)
              .map((rowId) => deleteConnection(rowId))
          );
          setSelectedIds([]);
          showSuccess("Connection(s) deleted successfully.");
          await queryClient.invalidateQueries({ queryKey: connectionKeys.all });
        },
      });
    },
    [queryClient, showSuccess]
  );

  const toolbarActions = useMemo<WeaverDataAction<ConnectionRecord>[]>(
    () => [
      {
        id: "new",
        label: "New Connection",
        icon: <AddIcon fontSize="small" />,
        onClick: () => navigate("/connections/new"),
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: <RefreshIcon fontSize="small" />,
        onClick: () => {
          void refetchConnections();
        },
      },
    ],
    [navigate, refetchConnections]
  );

  const rowActions = useMemo<WeaverDataAction<ConnectionRecord>[]>(
    () => [
      {
        id: "open",
        label: "Open / Edit",
        icon: <VisibilityIcon fontSize="small" />,
        onClick: ({ record }) => {
          if (record?.id) {
            navigate(`/connections/${encodeURIComponent(record.id)}`);
          }
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: ({ record }) => {
          if (record) {
            openDeleteConfirm({ selectedRows: [record] });
          }
        },
      },
    ],
    [navigate, openDeleteConfirm]
  );

  const bulkActions = useMemo<WeaverDataAction<ConnectionRecord>[]>(
    () => [
      {
        id: "delete",
        label: "Delete Selected",
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: ({ selectedRecords }) => {
          if (selectedRecords && selectedRecords.length) {
            openDeleteConfirm({ selectedRows: selectedRecords });
          }
        },
      },
    ],
    [openDeleteConfirm]
  );

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);

  const handleSelectionChange = useCallback((ids: Array<string | number>) => setSelectedIds(ids), []);

  const handleRecordClick = useCallback(
    (r: ConnectionRecord) => {
      if (r?.id) navigate(`/connections/${encodeURIComponent(r.id)}`);
    },
    [navigate]
  );

  const handlePaginationChange = useCallback(
    ({ page: nextPage, pageSize: nextPageSize }: { page: number; pageSize: number }) => {
      if (isSearchActive) return;
      setPage(nextPage);
      if (nextPageSize !== pageSize) {
        setPageSize(nextPageSize);
        setPage(0);
      }
    },
    [isSearchActive, pageSize]
  );

  return (
    <div className="definitions-page">

      <div className="definitions-content">
        <WeaverDataExplorer<ConnectionRecord>
          records={isSearchActive ? filteredItems : items}
          getRecordId={getConnectionRecordId}
          fields={fields}
          storageKey="connections"
          defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
          dataMode={isSearchActive ? "client" : "server"}
          selectionMode="multiple"
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          loading={loading}
          searchable
          searchValue={search}
          searchPlaceholder="Search connections by name, type..."
          stickyHeader
          height="calc(100vh - 220px)"
          toolbarActions={toolbarActions}
          rowActions={rowActions}
          bulkActions={bulkActions}
          onRecordClick={handleRecordClick}
          pagination
          totalRecords={isSearchActive ? filteredItems.length : rowCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          paginationModel={paginationModel}
          onPaginationChange={handlePaginationChange}
          canvas={CONNECTIONS_CANVAS}
          emptyTitle="No connections found"
          emptyDescription="Configure HTTP connections to connect workflows with external systems."
        />
      </div>

      <WeaverConfirmDialog
        intent="danger"
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.description}
        description={confirmState.warnings?.join(" ")}
        confirmLabel="Delete"
        textConfirmation={{ expectedText: confirmState.confirmPhrase }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          try {
            await confirmState.onConfirm?.();
            setConfirmState((prev) => ({ ...prev, open: false }));
          } catch (error) {
            showError(getErrorMessage(error, "Delete failed."));
          }
        }}
      />
    </div>
  );
}
