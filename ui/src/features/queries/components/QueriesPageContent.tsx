import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box, Link } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import StorageIcon from "@mui/icons-material/Storage";
import { useNavigate } from "react-router-dom";

import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import Tag from "@/components/common/data/Tag/Tag";
import { getErrorMessage } from "@/utils/error";
import { toTimezoneDateTime } from "@/utils/dateTime";
import { getUserName } from "@/utils/user";
import { normalizeQuery } from "@/features/queries/services/queriesService";
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

interface QueriesPageContentProps {
  search?: string;
  onCreateQuery?: (() => void) | null;
}

export default function QueriesPageContent({ search = "", onCreateQuery = null }: QueriesPageContentProps) {
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const trimmedSearch = (search || "").trim();
  const listParams = useMemo(() => {
    const params: Record<string, unknown> = {
      includeSql: false,
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
                navigate(`/queries/${encodeURIComponent(queryId)}`, { state: { name } });
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
        render: (val, r) => {
          const databaseId = String(r?.dataSource || "").trim();
          const databaseName = String(val || "-");
          if (!databaseId) return databaseName;
          return (
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/databases/${encodeURIComponent(databaseId)}`, {
                  state: { name: databaseName },
                });
              }}
              sx={{ textAlign: "left", color: "primary.main" }}
            >
              {databaseName}
            </Link>
          );
        },
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
        key: "createdBy",
        label: "Created By",
        getValue: (r) => getUserName(r.createdBy, "-"),
        visibleByDefault: false,
        hideable: true,
        width: 150,
      },
      {
        key: "updatedBy",
        label: "Updated By",
        getValue: (r) => getUserName(r.updatedBy, "-"),
        visibleByDefault: false,
        hideable: true,
        width: 150,
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

  // The only toolbar action, shown as a button (so there is no actions menu).
  const toolbarActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "new",
        label: "New Query",
        icon: <AddIcon fontSize="small" />,
        asButton: true,
        onClick: openCreateView,
      },
    ],
    [openCreateView]
  );

  const handleRecordClick = useCallback(
    (r: { id?: string | number; name?: string } | null | undefined) => {
      if (r?.id) navigate(`/queries/${encodeURIComponent(r.id)}`, { state: { name: r.name } });
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
    <WeaverDataExplorer<any>
      records={items}
      getRecordId={getRecordId}
      fields={fields}
      storageKey="queries"
      defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
      dataMode="server"
      selectionMode="none"
      loading={loading}
      errorMessage={errorMessage || undefined}
      searchable
      searchValue={search}
      searchPlaceholder="Search queries by name..."
      stickyHeader
      height="calc(100vh - 220px)"
      toolbarActions={toolbarActions}
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
  );
}

QueriesPageContent.propTypes = {
  search: PropTypes.string,
  onCreateQuery: PropTypes.func,
};
