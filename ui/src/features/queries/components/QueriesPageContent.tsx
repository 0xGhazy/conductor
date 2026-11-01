import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { Box, Link } from "@mui/material";
import { alpha } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import StorageIcon from "@mui/icons-material/Storage";
import { useNavigate } from "react-router-dom";

import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import Tag from "@/components/common/data/Tag/Tag";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import { getErrorMessage } from "@/utils/error";
import { toTimezoneDateTime } from "@/utils/dateTime";
import { deleteQuery } from "@/features/queries/services/queriesApi";
import { normalizeQuery } from "@/features/queries/services/queriesService";
import { queryDefinitionKeys } from "@/features/queries/hooks/queryKeys";
import { useQueryDefinitionsList } from "@/features/queries/hooks/useQueryDefinitions";

type QueryRow = ReturnType<typeof normalizeQuery>;

const EMPTY_ITEMS: QueryRow[] = [];
const DEFAULT_VISIBLE_FIELDS = ["name", "description", "dataSourceName", "timeoutMs", "createdAt"];
const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 75, 100];
const getRecordId = (r: QueryRow) => r.id;

const CANVAS_CONFIG = {
  renderIcon: () => (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        backgroundColor: "#0891b2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        boxShadow: (theme) =>
          `0 4px 14px ${alpha("#0891b2", theme.palette.mode === "dark" ? 0.45 : 0.3)}`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "scale(1.06)",
        },
      }}
    >
      <StorageIcon sx={{ fontSize: 26, color: "#ffffff" }} />
    </Box>
  ),
  renderStatus: (r: { dataSourceName?: unknown }) => (
    <Tag text={String(r?.dataSourceName || "-")} color="#0891b2" borderColor="#0891b2" />
  ),
  primaryFieldKey: "name",
  secondaryFieldKey: "dataSourceName",
  descriptionFieldKey: "description",
};

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
    body?.details?.totalElements ??
    body?.data?.details?.totalElements ??
    body?.data?.totalItems ??
    body?.details?.totalItems ??
    fallback;
  return Number(total) || 0;
};

export default function QueriesPageContent({ onNotify = null, search = "", onCreateQuery = null }: any) {
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const [confirmState, setConfirmState] = useState<any>({
    open: false,
    title: "Delete queries?",
    description: "You are about to delete queries.",
    warnings: [],
    confirmPhrase: "DELETE",
    onConfirm: null,
  });

  const trimmedSearch = (search || "").trim();
  const listParams = useMemo(() => {
    const params: Record<string, unknown> = {
      includeQuery: false,
      page,
      size: pageSize,
      sort: "createdAt,DESC",
    };
    if (trimmedSearch) {
      params.search = trimmedSearch;
    }
    return params;
  }, [page, pageSize, trimmedSearch]);

  const queriesQuery = useQueryDefinitionsList(listParams);
  const { refetch: refetchQueries } = queriesQuery;

  const { items, rowCount } = useMemo(() => {
    const response = queriesQuery.data;
    if (!response) return { items: EMPTY_ITEMS, rowCount: 0 };
    const body = response?.data ?? {};
    const list = extractList(body);
    const normalized = list.map((item, index) => normalizeQuery(item, index));
    return {
      items: normalized,
      rowCount: extractTotal(response, extractTotal(body, normalized.length)),
    };
  }, [queriesQuery.data]);

  // Table keeps showing the previous page (keepPreviousData) while fetching.
  const loading = queriesQuery.isFetching;
  const errorMessage = queriesQuery.error
    ? getErrorMessage(queriesQuery.error, "Failed to fetch queries.")
    : "";

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
        label: "Name",
        getValue: (r) => r.name,
        searchable: true,
        sortable: true,
        width: 200,
        render: (val, r) => {
          const queryId = String(r?.id || "").trim();
          const name = String(val || "-");
          if (!queryId) return name;
          return (
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/queries/${encodeURIComponent(queryId)}`);
              }}
              sx={{ fontWeight: 600, textAlign: "left", color: "primary.main" }}
            >
              {name}
            </Link>
          );
        },
      },
      {
        key: "description",
        label: "Description",
        getValue: (r) => r.description || "-",
        searchable: true,
        width: 240,
        render: (val) => (
          <span style={{ color: "var(--color-fg-muted, #64748b)" }}>
            {String(val || "-")}
          </span>
        ),
      },
      {
        key: "dataSourceName",
        label: "Database",
        getValue: (r) => r.dataSourceName,
        searchable: true,
        sortable: true,
        width: 170,
        render: (val) => (
          <Tag text={String(val || "-")} color="#0891b2" borderColor="#0891b2" />
        ),
      },
      {
        key: "timeoutMs",
        label: "Timeout (ms)",
        getValue: (r) => r.timeoutMs,
        sortable: true,
        width: 130,
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

  const openCreateView = useCallback(() => {
    if (onCreateQuery) {
      onCreateQuery();
    } else {
      navigate("/queries");
    }
  }, [onCreateQuery, navigate]);

  const openDeleteConfirm = useCallback(
    ({ selectedRows }: { selectedRows?: any[] }) => {
      const list = Array.isArray(selectedRows) ? selectedRows : [];
      if (!list.length) return;
      const confirmPhrase = list.length === 1 ? String(list[0]?.name || "DELETE") : "DELETE";

      setConfirmState({
        open: true,
        title: `Delete ${list.length} quer${list.length > 1 ? "ies" : "y"}?`,
        description: `You're about to delete ${list.length} quer${list.length > 1 ? "ies" : "y"}.`,
        warnings: ["This action can't be undone."],
        confirmPhrase,
        onConfirm: async () => {
          await Promise.all(
            list.map((item) => item?.id).filter(Boolean).map((id: string) => deleteQuery(id))
          );
          setSelectedIds([]);
          onNotify?.({ message: "Query(s) deleted successfully." });
          void queryClient.invalidateQueries({ queryKey: queryDefinitionKeys.all });
        },
      });
    },
    [onNotify, queryClient]
  );

  const exportAsJson = useCallback((records: any[]) => {
    if (!records.length) return;
    const payload = JSON.stringify(records, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "queries.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  }, []);

  const toolbarActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "new",
        label: "New Query",
        icon: <AddIcon fontSize="small" />,
        onClick: openCreateView,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: <RefreshIcon fontSize="small" />,
        onClick: () => {
          refetchQueries();
        },
      },
    ],
    [openCreateView, refetchQueries]
  );

  const rowActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "open",
        label: "Open / Edit",
        icon: <VisibilityIcon fontSize="small" />,
        onClick: ({ record }) => {
          if (record?.id) {
            navigate(`/queries/${encodeURIComponent(record.id)}`);
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

  const bulkActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "export",
        label: "Export as JSON",
        icon: <FileDownloadOutlinedIcon fontSize="small" />,
        onClick: ({ selectedRecords }) => {
          if (selectedRecords && selectedRecords.length) {
            exportAsJson(selectedRecords);
          }
        },
      },
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
    [exportAsJson, openDeleteConfirm]
  );

  const handleRecordClick = useCallback(
    (r: { id?: string | number } | null | undefined) => {
      if (r?.id) navigate(`/queries/${encodeURIComponent(r.id)}`);
    },
    [navigate]
  );

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);

  const handlePaginationChange = useCallback(
    ({ page: nextPage, pageSize: nextPageSize }: { page: number; pageSize: number }) => {
      setPage(nextPage);
      if (nextPageSize !== pageSize) {
        setPageSize(nextPageSize);
        setPage(0);
      }
    },
    [pageSize]
  );

  return (
    <>
      <WeaverDataExplorer<any>
        records={items}
        getRecordId={getRecordId}
        fields={fields}
        storageKey="queries"
        defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
        dataMode="server"
        selectionMode="multiple"
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        loading={loading}
        errorMessage={errorMessage || undefined}
        searchable
        searchValue={search}
        searchPlaceholder="Search queries by name..."
        stickyHeader
        height="calc(100vh - 220px)"
        toolbarActions={toolbarActions}
        rowActions={rowActions}
        bulkActions={bulkActions}
        onRecordClick={handleRecordClick}
        pagination
        totalRecords={rowCount}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        paginationModel={paginationModel}
        onPaginationChange={handlePaginationChange}
        canvas={CANVAS_CONFIG}
        emptyTitle="No queries found"
        emptyDescription="Create your first SQL query definition to use in workflows."
      />

      <WeaverConfirmDialog
        intent="danger"
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.description}
        description={confirmState.warnings?.join(" ")}
        confirmLabel="Delete"
        textConfirmation={{ expectedText: confirmState.confirmPhrase }}
        onCancel={() => setConfirmState((prev: any) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          try {
            await confirmState.onConfirm?.();
            setConfirmState((prev: any) => ({ ...prev, open: false }));
          } catch (error) {
            onNotify?.({
              severity: "error",
              message: getErrorMessage(error, "Delete failed."),
            });
          }
        }}
      />
    </>
  );
}

QueriesPageContent.propTypes = {
  onNotify: PropTypes.func,
  search: PropTypes.string,
  onCreateQuery: PropTypes.func,
};
