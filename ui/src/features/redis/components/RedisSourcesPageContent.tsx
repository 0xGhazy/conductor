import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Box, Link } from "@mui/material";
import { alpha } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { SiRedis } from "react-icons/si";

import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import Tag from "@/components/common/data/Tag/Tag";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import { getErrorMessage } from "@/utils/error";
import { toTimezoneDateTime } from "@/utils/dateTime";
import { useQueryClient } from "@tanstack/react-query";
import { deleteRedisDatasource } from "@/features/redis/services/redisDatasourcesApi";
import { normalizeRedisDatasource } from "@/features/redis/services/redisDatasourcesService";
import { redisDatasourceKeys } from "@/features/redis/hooks/queryKeys";
import { useRedisDatasourcesList } from "@/features/redis/hooks/useRedisDatasources";

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

type RedisRow = ReturnType<typeof normalizeRedisDatasource>;

const EMPTY_ITEMS: RedisRow[] = [];
const getRedisRecordId = (r: RedisRow) => r.id;
const DEFAULT_VISIBLE_FIELDS = ["name", "host", "port", "databaseIndex", "ssl", "active", "createdAt"];

const REDIS_CANVAS = {
  renderIcon: () => (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        backgroundColor: "#ef4444",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        boxShadow: (theme) =>
          `0 4px 14px ${alpha("#ef4444", theme.palette.mode === "dark" ? 0.45 : 0.3)}`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "scale(1.06)",
        },
      }}
    >
      <SiRedis size={26} color="#ffffff" />
    </Box>
  ),
  renderStatus: (r: RedisRow) => {
    const isActive = Boolean(r?.active);
    const accent = isActive ? "#22c55e" : "#ef4444";
    return <Tag text={isActive ? "ACTIVE" : "INACTIVE"} color={accent} borderColor={accent} />;
  },
  primaryFieldKey: "name",
  secondaryFieldKey: "host",
  descriptionFieldKey: "host",
};

export default function RedisSourcesPageContent({ onNotify = null, search = "" }: any) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const [confirmState, setConfirmState] = useState<any>({
    open: false,
    title: "Delete Redis sources?",
    description: "You are about to delete Redis sources.",
    warnings: [],
    confirmPhrase: "DELETE",
    onConfirm: null,
  });

  const {
    data: redisSourcesResponse,
    error: redisSourcesError,
    isFetching: loading,
    refetch: refetchRedisSources,
  } = useRedisDatasourcesList();

  const errorMessage = redisSourcesError ? getErrorMessage(redisSourcesError, "Failed to fetch Redis sources.") : "";

  const items = useMemo(() => {
    if (!redisSourcesResponse) return EMPTY_ITEMS;
    const body = redisSourcesResponse?.data ?? {};
    const list = extractList(body);
    return list.map(normalizeRedisDatasource);
  }, [redisSourcesResponse]);

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
                navigate(`/redis/${encodeURIComponent(id)}`);
              }}
              sx={{ fontWeight: 600, textAlign: "left", color: "primary.main" }}
            >
              {name}
            </Link>
          );
        },
      },
      {
        key: "host",
        label: "Host",
        getValue: (r) => r.host,
        searchable: true,
        sortable: true,
        width: 170,
      },
      {
        key: "port",
        label: "Port",
        getValue: (r) => r.port,
        sortable: true,
        width: 100,
      },
      {
        key: "databaseIndex",
        label: "DB Index",
        getValue: (r) => r.databaseIndex,
        sortable: true,
        width: 110,
      },
      {
        key: "ssl",
        label: "SSL",
        getValue: (r) => (r.ssl ? "YES" : "NO"),
        type: "boolean",
        sortable: true,
        width: 90,
        render: (val) => {
          const isSsl = val === "YES";
          return (
            <Tag
              text={isSsl ? "YES" : "NO"}
              color={isSsl ? "#22c55e" : "#ef4444"}
              borderColor={isSsl ? "#22c55e" : "#ef4444"}
            />
          );
        },
      },
      {
        key: "active",
        label: "Status",
        getValue: (r) => (r.active ? "ACTIVE" : "INACTIVE"),
        type: "enum",
        sortable: true,
        width: 120,
        options: [
          { label: "ACTIVE", value: "ACTIVE" },
          { label: "INACTIVE", value: "INACTIVE" },
        ],
        render: (val) => {
          const isActive = val === "ACTIVE";
          const accent = isActive ? "#22c55e" : "#ef4444";
          return <Tag text={isActive ? "ACTIVE" : "INACTIVE"} color={accent} borderColor={accent} />;
        },
      },
      {
        key: "createdAt",
        label: "Created at",
        getValue: (r) => r.createdAt,
        sortable: true,
        width: 200,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
      {
        key: "updatedAt",
        label: "Updated at",
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

  const openDeleteConfirm = useCallback(
    ({ selectedRows }: { selectedRows?: any[] }) => {
      const list = Array.isArray(selectedRows) ? selectedRows : [];
      if (!list.length) return;
      const confirmPhrase = list.length === 1 ? String(list[0]?.name || "DELETE") : "DELETE";

      setConfirmState({
        open: true,
        title: `Delete ${list.length} Redis source${list.length > 1 ? "s" : ""}?`,
        description: `You're about to delete ${list.length} Redis source${list.length > 1 ? "s" : ""}.`,
        warnings: ["This action can't be undone and will close all connection pools."],
        confirmPhrase,
        onConfirm: async () => {
          await Promise.all(
            list
              .map((item) => item?.id)
              .filter(Boolean)
              .map((id) => deleteRedisDatasource(id))
          );
          setSelectedIds([]);
          onNotify?.({ message: "Redis source(s) deleted successfully." });
          await queryClient.invalidateQueries({ queryKey: redisDatasourceKeys.all });
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
    a.download = "redis-sources.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  }, []);

  const toolbarActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "new",
        label: "New Redis Source",
        icon: <AddIcon fontSize="small" />,
        onClick: () => navigate("/redis/new"),
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: <RefreshIcon fontSize="small" />,
        onClick: () => {
          void refetchRedisSources();
        },
      },
    ],
    [navigate, refetchRedisSources]
  );

  const rowActions = useMemo<WeaverDataAction<any>[]>(
    () => [
      {
        id: "open",
        label: "Open / Edit",
        icon: <VisibilityIcon fontSize="small" />,
        onClick: ({ record }) => {
          if (record?.id) {
            navigate(`/redis/${encodeURIComponent(record.id)}`);
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

  const handleSelectionChange = useCallback((ids: Array<string | number>) => setSelectedIds(ids), []);

  const handleRecordClick = useCallback(
    (r: RedisRow) => {
      if (r?.id) navigate(`/redis/${encodeURIComponent(r.id)}`);
    },
    [navigate]
  );

  return (
    <>
      <WeaverDataExplorer<any>
        records={items}
        getRecordId={getRedisRecordId}
        fields={fields}
        storageKey="redis-sources"
        defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
        dataMode="client"
        selectionMode="multiple"
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        loading={loading}
        errorMessage={errorMessage || undefined}
        searchable
        searchValue={search}
        searchPlaceholder="Search Redis sources by name, host..."
        stickyHeader
        height="calc(100vh - 220px)"
        toolbarActions={toolbarActions}
        rowActions={rowActions}
        bulkActions={bulkActions}
        onRecordClick={handleRecordClick}
        canvas={REDIS_CANVAS}
        emptyTitle="No Redis sources found"
        emptyDescription="Configure Redis sources to manage multi-tenant Redis cache configurations and pools."
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

RedisSourcesPageContent.propTypes = {
  onNotify: PropTypes.func,
  search: PropTypes.string,
};
