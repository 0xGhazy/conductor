import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CircularProgress } from "@mui/material";
import {
  FiDatabase,
  FiActivity,
  FiCopy,
  FiPlus,
} from "react-icons/fi";
import { SiPostgresql, SiMysql } from "react-icons/si";

import type { AppLayoutContext } from "@/app/layout/AppLayout";
import { useWeaverNotification } from "@/components/common/notifications";
import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import { getErrorMessage } from "@/utils/error";
import {
  formatRelativeTime,
  formatExactDateTime,
  formatTooltipDateTime,
} from "@/utils/dateTime";
import { PAGE_SIZE_OPTIONS } from "@/utils/data";
import useDebounce from "@/hooks/useDebounce";
import { getUserName } from "@/utils/user";
import type { Datasource } from "@/features/databases";
import {
  createDatasource,
  datasourceKeys,
  pingDatasource,
  toStatusDetails,
  buildDatasourcePayload,
  useDatasourcesList,
} from "@/features/databases";

import styles from "./DatabasesPage.module.css";
import "@/styles/definitionPages.css";

// Detail/editor page is only needed for the "New Database" branch -> load on demand.
const DatabaseViewPage = lazy(() => import("./DatabaseViewPage"));

const EMPTY_DATASOURCES: Datasource[] = [];
const DEFAULT_VISIBLE_FIELDS = ["name", "type", "status", "createdAt", "actions"];
const getDatasourceId = (r: Datasource) => r.id;
const renderDatabaseCanvasIcon = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 8, background: "var(--color-surface-soft)", border: "1px solid var(--color-border-default)", color: "var(--color-accent-fg)" }}>
    <FiDatabase size={20} />
  </div>
);
const getDatabaseCanvasTitle = (db: Datasource) => db.name || "Untitled Database";

export default function DatabasesPage() {
  const navigate = useNavigate();
  const notify = useWeaverNotification();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };
  const [isCreating, setIsCreating] = useState(false);

  const queryClient = useQueryClient();

  // Pagination state
  const [pageSize, setPageSize] = useState(20);

  // Operational state
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<
    Record<string, { latencyMs: number; status: "ACTIVE" | "ERROR"; message?: string }>
  >({});

  // Search state
  const [searchQuery, setSearchQuery] = useState(search || "");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // The page index is tied to the search it was chosen for; when the debounced search
  // changes the effective page is derived as 0 (no reset effect -> no double fetch).
  const [pageState, setPageState] = useState({ page: 0, search: debouncedSearch });
  const page = pageState.search === debouncedSearch ? pageState.page : 0;

  useEffect(() => {
    if (!isCreating) {
      document.title = "Weaver - Databases";
    }
  }, [isCreating]);

  // Sync external search prop from AppLayout
  useEffect(() => {
    if (search !== undefined) {
      setSearchQuery(search);
    }
  }, [search]);

  // Fetch datasources from backend API (cached per page/size/search)
  const datasourcesQuery = useDatasourcesList({ page, size: pageSize, search: debouncedSearch });
  const baseItems = datasourcesQuery.data?.items ?? EMPTY_DATASOURCES;
  const rowCount = datasourcesQuery.data?.total ?? 0;
  // Skeleton only when there's nothing (or only another page's placeholder) to show.
  const loading =
    datasourcesQuery.isPending || (datasourcesQuery.isFetching && datasourcesQuery.isPlaceholderData);
  const errorMessage = datasourcesQuery.error
    ? getErrorMessage(datasourcesQuery.error, "Failed to fetch databases.")
    : "";

  // Overlay live ping outcomes onto the fetched records.
  const items = useMemo<Datasource[]>(
    () =>
      baseItems.map((item) => {
        const ping = pingResults[item.id];
        return ping ? { ...item, status: ping.status } : item;
      }),
    [baseItems, pingResults]
  );

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const handlePaginationChange = useCallback(
    ({ page: nextPage, pageSize: nextPageSize }: { page: number; pageSize: number }) => {
      if (nextPageSize !== pageSize) {
        setPageSize(nextPageSize);
        setPageState({ page: 0, search: debouncedSearch });
      } else {
        setPageState({ page: nextPage, search: debouncedSearch });
      }
    },
    [debouncedSearch, pageSize]
  );

  const openDatabase = useCallback(
    (record: Datasource) => {
      if (record?.id) {
        navigate(`/databases/${encodeURIComponent(record.id)}`, {
          state: { name: record.name },
        });
      }
    },
    [navigate]
  );

  // Live Ping Handler with roundtrip latency tracking
  const handlePing = useCallback(
    async (id: string, name: string) => {
      if (!id) return;
      setPingingId(id);
      const startTime = performance.now();
      try {
        const response = await pingDatasource(id);
        const elapsed = Math.round(performance.now() - startTime);
        // `data` is the database; the ping outcome is its `status`.
        const pingStatus = toStatusDetails(response?.data?.status);
        const isOk = pingStatus?.status === "ACTIVE";

        if (isOk) {
          setPingResults((prev) => ({
            ...prev,
            [id]: { latencyMs: elapsed, status: "ACTIVE" },
          }));
          notify.success(`Database "${name}" is reachable (${elapsed} ms)!`);
        } else {
          const reason =
            pingStatus?.message ||
            pingStatus?.reason ||
            response?.message ||
            "Unable to connect to host.";
          setPingResults((prev) => ({
            ...prev,
            [id]: { latencyMs: elapsed, status: "ERROR", message: reason },
          }));
          notify.error(`Ping failed for "${name}": ${reason}`);
        }
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        const errorMsg = getErrorMessage(err, `Connection ping failed for "${name}".`);
        setPingResults((prev) => ({
          ...prev,
          [id]: { latencyMs: elapsed, status: "ERROR", message: errorMsg },
        }));
        notify.error(errorMsg);
      } finally {
        setPingingId(null);
      }
    },
    [notify]
  );

  // Duplicate Database Handler
  const handleDuplicate = useCallback(
    async (db: Datasource) => {
      if (!db) return;
      try {
        const copyName = `${db.name}_copy`;
        const payload = buildDatasourcePayload({
          ...db,
          name: copyName,
        });
        const response = await createDatasource(payload);
        const body = response?.data ?? response ?? {};
        const created = (body as any)?.data ?? body ?? {};
        const createdId = String(created?.id || "").trim();

        notify.success(`Duplicated database "${db.name}".`);
        // Lists + fleet stats are now stale (refetches active queries, marks the rest stale).
        const invalidation = queryClient.invalidateQueries({ queryKey: datasourceKeys.all });
        if (createdId) {
          navigate(`/databases/${encodeURIComponent(createdId)}`, {
            state: { name: copyName },
          });
        } else {
          await invalidation;
        }
      } catch (err) {
        notify.error(getErrorMessage(err, "Failed to duplicate database."));
      }
    },
    [navigate, notify, queryClient]
  );

  // Helper: Engine badge styling
  const renderEngineBadge = (typeVal: unknown) => {
    const rawType = String(typeVal || "").toUpperCase();
    if (rawType.includes("POSTGRES")) {
      return (
        <span className={`${styles.engineBadge} ${styles.enginePostgres}`}>
          <SiPostgresql size={12} />
          <span>Postgres</span>
        </span>
      );
    }
    if (rawType.includes("MYSQL")) {
      return (
        <span className={`${styles.engineBadge} ${styles.engineMysql}`}>
          <SiMysql size={14} />
          <span>MySQL</span>
        </span>
      );
    }
    if (rawType.includes("ORACLE")) {
      return (
        <span className={`${styles.engineBadge} ${styles.engineOracle}`}>
          <FiDatabase size={12} />
          <span>Oracle</span>
        </span>
      );
    }
    return (
      <span className={`${styles.engineBadge} ${styles.engineDefault}`}>
        <FiDatabase size={12} />
        <span>{rawType || "UNKNOWN"}</span>
      </span>
    );
  };

  // Field definitions for WeaverDataExplorer Table
  const fields = useMemo<WeaverDataField<Datasource>[]>(
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
        label: "Database",
        getValue: (r) => r.name,
        searchable: true,
        sortable: true,
        width: 250,
        render: (val, r) => {
          const id = String(r?.id || "").trim();
          const name = String(val || "Untitled Database");
          const subInfo = r?.category || r?.schema || "";

          return (
            <div className={styles.nameCell}>
              <div className={styles.nameInfo}>
                <button
                  type="button"
                  className={styles.nameLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (id) {
                      navigate(`/databases/${encodeURIComponent(id)}`, {
                        state: { name },
                      });
                    }
                  }}
                  title={name}
                >
                  {name}
                </button>
                {subInfo && <span className={styles.subMeta}>{subInfo}</span>}
              </div>
            </div>
          );
        },
      },
      {
        key: "type",
        label: "Engine",
        getValue: (r) => r.type,
        type: "enum",
        options: [
          { label: "Postgres", value: "POSTGRES" },
          { label: "MySQL", value: "MYSQL" },
          { label: "Oracle", value: "ORACLE" },
        ],
        sortable: true,
        width: 145,
        render: (val) => renderEngineBadge(val),
      },
      {
        key: "status",
        label: "Status & Latency",
        getValue: (r) => {
          const pingResult = pingResults[r.id];
          const raw = pingResult
            ? pingResult.status
            : typeof r.status === "object" && r.status
            ? (r.status as any).status
            : r.status;
          return String(raw || "UNKNOWN").toUpperCase();
        },
        type: "enum",
        options: [
          { label: "ACTIVE", value: "ACTIVE" },
          { label: "INACTIVE", value: "INACTIVE" },
          { label: "ERROR", value: "ERROR" },
        ],
        sortable: true,
        width: 175,
        render: (_val, r) => {
          const pingResult = pingResults[r.id];
          const rawStatus = pingResult
            ? pingResult.status
            : String(
                typeof r.status === "object" && r.status
                  ? (r.status as any).status
                  : r.status || "UNKNOWN"
              ).toUpperCase();

          const isActive = rawStatus === "ACTIVE";
          const isError = rawStatus === "ERROR" || rawStatus === "INACTIVE";

          const pillClass = isActive
            ? styles.statusPillActive
            : isError
              ? styles.statusPillError
              : styles.statusPillUnknown;

          const dotClass = isActive
            ? styles.dotActive
            : isError
              ? styles.dotError
              : styles.dotUnknown;

          return (
            <div className={styles.statusCell}>
              <div className={`${styles.statusPill} ${pillClass}`}>
                <span className={`${styles.statusDot} ${dotClass}`} />
                <span>{rawStatus}</span>
              </div>
              {pingResult?.latencyMs !== undefined && (
                <span
                  className={`${styles.latencyBadge} ${
                    pingResult.status === "ERROR" ? styles.latencyBadgeError : ""
                  }`}
                  title={`Roundtrip latency: ${pingResult.latencyMs}ms`}
                >
                  {pingResult.latencyMs} ms
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "createdAt",
        label: "Created",
        getValue: (r) => r.createdAt,
        type: "datetime",
        sortable: true,
        width: 155,
        render: (val) => {
          if (!val) return <span style={{ color: "var(--color-fg-muted)" }}>—</span>;
          const relative = formatRelativeTime(val);
          const exact = formatExactDateTime(val);
          const tooltip = formatTooltipDateTime(val);
          return (
            <span className={styles.timeCell} title={`${exact} (${tooltip})`}>
              {relative}
            </span>
          );
        },
      },
      {
        key: "updatedAt",
        label: "Updated",
        getValue: (r) => r.updatedAt,
        type: "datetime",
        sortable: true,
        visibleByDefault: false,
        width: 155,
        render: (val) => {
          if (!val) return <span style={{ color: "var(--color-fg-muted)" }}>—</span>;
          const relative = formatRelativeTime(val);
          const exact = formatExactDateTime(val);
          return (
            <span className={styles.timeCell} title={exact}>
              {relative}
            </span>
          );
        },
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
        key: "actions",
        label: "Actions",
        getValue: (r) => r.id,
        sortable: false,
        filterable: false,
        width: 195,
        render: (_val, r) => {
          const isPinging = pingingId === r.id;
          return (
            <div className={styles.rowActionsCell}>
              <button
                type="button"
                className={styles.inlinePingBtn}
                disabled={isPinging}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePing(r.id, r.name);
                }}
                title="Test live database connectivity"
              >
                <FiActivity
                  size={13}
                  className={isPinging ? styles.inlinePingSpinner : ""}
                />
                <span>{isPinging ? "Testing..." : "Ping"}</span>
              </button>
              <button
                type="button"
                className={styles.inlineDuplicateBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate(r);
                }}
                title="Duplicate database"
              >
                <FiCopy size={13} />
                <span>Duplicate</span>
              </button>
            </div>
          );
        },
      },
    ],
    [handleDuplicate, handlePing, navigate, pingResults, pingingId]
  );

  // The only toolbar action, shown as a button (so there is no table options menu).
  const toolbarActions = useMemo<WeaverDataAction<Datasource>[]>(
    () => [
      {
        id: "new",
        label: "New Database",
        icon: <FiPlus size={14} />,
        asButton: true,
        onClick: () => {
          setIsCreating(true);
        },
      },
    ],
    []
  );

  const canvas = useMemo(
    () => ({
      renderIcon: renderDatabaseCanvasIcon,
      renderStatus: (db: Datasource) => {
        const pingResult = pingResults[db.id];
        const rawStatus = pingResult
          ? pingResult.status
          : String(
              typeof db?.status === "object" && db?.status
                ? (db.status as any).status
                : db?.status || "UNKNOWN"
            ).toUpperCase();

        const isActive = rawStatus === "ACTIVE";
        const isError = rawStatus === "ERROR" || rawStatus === "INACTIVE";

        const pillClass = isActive
          ? styles.statusPillActive
          : isError
            ? styles.statusPillError
            : styles.statusPillUnknown;

        const dotClass = isActive
          ? styles.dotActive
          : isError
            ? styles.dotError
            : styles.dotUnknown;

        return (
          <div className={`${styles.statusPill} ${pillClass}`}>
            <span className={`${styles.statusDot} ${dotClass}`} />
            <span>{rawStatus}</span>
          </div>
        );
      },
      getTitle: getDatabaseCanvasTitle,
      renderQuickActions: (record: Datasource) => {
        const isPinging = pingingId === record?.id;
        return (
          <div style={{ display: "flex", gap: "8px", width: "100%", justifyContent: "space-between" }}>
            <button
              type="button"
              className={styles.inlinePingBtn}
              disabled={isPinging || !record?.id}
              onClick={async (e) => {
                e.stopPropagation();
                if (record?.id) await handlePing(record.id, record.name);
              }}
            >
              <FiActivity size={12} className={isPinging ? styles.inlinePingSpinner : ""} />
              <span>{isPinging ? "Testing..." : "Ping"}</span>
            </button>
            <button
              type="button"
              className={styles.inlineDuplicateBtn}
              onClick={(e) => {
                e.stopPropagation();
                if (record) handleDuplicate(record);
              }}
            >
              <FiCopy size={12} />
              <span>Duplicate</span>
            </button>
          </div>
        );
      },
    }),
    [handleDuplicate, handlePing, pingResults, pingingId]
  );

  const handleCloseCreate = useCallback(() => setIsCreating(false), []);

  if (isCreating) {
    return (
      <Suspense
        fallback={
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <CircularProgress size={28} style={{ color: "var(--color-accent-fg)" }} />
          </div>
        }
      >
        <DatabaseViewPage isCreateMode={true} onBack={handleCloseCreate} />
      </Suspense>
    );
  }

  return (
    <div className={styles.pageRoot}>
      <div className="definitions-content">
        <WeaverDataExplorer<Datasource>
          records={items}
          getRecordId={getDatasourceId}
          fields={fields}
          storageKey="databases_v4"
          defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
          dataMode="server"
          selectionMode="none"
          loading={loading}
          errorMessage={errorMessage || undefined}
          searchable
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search databases by name or engine..."
          stickyHeader
          toolbarActions={toolbarActions}
          pagination
          totalRecords={rowCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          paginationModel={paginationModel}
          onPaginationChange={handlePaginationChange}
          canvas={canvas}
          onRecordClick={openDatabase}
          height="calc(100vh - 220px)"
        />
      </div>
    </div>
  );
}
