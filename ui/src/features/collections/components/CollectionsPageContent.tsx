import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import {
  UploadCloud,
  FileCode,
} from "lucide-react";
import { SiPostman, SiSwagger } from "react-icons/si";

import { WeaverDataExplorer, UserAvatarCell, resolveUserDisplay } from "@/components/common/data";
import { AuthContext } from "@/features/auth/context/AuthContext";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import Tag from "@/components/common/data/Tag/Tag";
import { getErrorMessage } from "@/utils/error";
import { toTimezoneDateTime } from "@/utils/dateTime";
import useDebounce from "@/hooks/useDebounce";
import { useQueryClient } from "@tanstack/react-query";
import { deleteCollection } from "@/features/collections/services/apiCollectionsApi";
import { normalizeCollection } from "@/features/collections/services/apiCollectionsService";
import { collectionKeys } from "@/features/collections/hooks/queryKeys";
import { useCollectionsList } from "@/features/collections/hooks/useCollections";
import type { ApiCollection } from "@/features/collections/types/apiCollectionTypes";

import { CollectionCard } from "./CollectionCard/CollectionCard";
import { CollectionImportModal } from "./CollectionImportModal/CollectionImportModal";
import styles from "./CollectionsPageContent.module.css";

type CollectionRow = ReturnType<typeof normalizeCollection>;

const EMPTY_ITEMS: CollectionRow[] = [];
const getCollectionRecordId = (r: CollectionRow) => r.id;

interface CollectionsPageContentProps {
  onNotify?: (payload: { severity?: "error" | "success"; message: string }) => void;
  search?: string;
}

export const CollectionsPageContent: React.FC<CollectionsPageContentProps> = ({
  onNotify,
  search = "",
}) => {
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.user || null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState(search || "");
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  // Import Modal & Drag-over state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Sync external header search
  useEffect(() => {
    if (search !== undefined) {
      setSearchQuery(search);
    }
  }, [search]);

  // Reset page when search query changes
  const [pageSearch, setPageSearch] = useState(debouncedSearch);
  if (pageSearch !== debouncedSearch) {
    setPageSearch(debouncedSearch);
    setPage(0);
  }

  // Delete confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    warnings: string[];
    confirmPhrase: string;
    onConfirm: (() => Promise<void>) | null;
  }>({
    open: false,
    title: "Delete collections?",
    description: "You are about to delete collections.",
    warnings: [],
    confirmPhrase: "DELETE",
    onConfirm: null,
  });

  const listParams = useMemo(() => {
    const params: any = { page, size: pageSize, sort: "createdAt,DESC" };
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    return params;
  }, [page, pageSize, debouncedSearch]);

  const {
    data: collectionsResponse,
    error: collectionsError,
    isFetching: loading,
    refetch: refetchCollections,
  } = useCollectionsList(listParams);

  const errorMessage = collectionsError
    ? getErrorMessage(collectionsError, "Failed to fetch API collections.")
    : "";

  const { items, rowCount } = useMemo(() => {
    if (!collectionsResponse) return { items: EMPTY_ITEMS, rowCount: 0 };
    const response = collectionsResponse as any;
    const body = response?.data ?? {};
    const data = body?.data?.items ?? body?.data ?? body?.items ?? body ?? [];
    const normalized = (Array.isArray(data) ? data : []).map(normalizeCollection);
    const total =
      response?.details?.totalElements ??
      response?.totalElements ??
      response?.data?.totalElements ??
      body?.details?.totalElements ??
      body?.data?.details?.totalElements ??
      body?.totalElements ??
      normalized.length;
    return { items: normalized, rowCount: Number(total) || 0 };
  }, [collectionsResponse]);

  // Drag and drop event handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setStagedFile(file);
      setImportModalOpen(true);
    }
  }, []);

  // Open delete dialog
  const openDeleteConfirm = useCallback(
    ({ selectedRows }: { selectedRows?: any[] }) => {
      const list = Array.isArray(selectedRows) ? selectedRows : [];
      if (!list.length) return;
      const count = list.length;
      const single = count === 1 ? list[0] : null;

      setConfirmState({
        open: true,
        title: single ? `Delete "${single.name}"?` : `Delete ${count} collections?`,
        description: single
          ? `You are about to permanently delete "${single.name}".`
          : `You are about to permanently delete ${count} collections.`,
        warnings: [
          "All registered endpoints associated with this collection will also be deleted.",
          "Any workflows referencing these endpoints will fail unless re-configured.",
        ],
        confirmPhrase: "DELETE",
        onConfirm: async () => {
          try {
            await Promise.all(
              list.map((c) => deleteCollection(String(c.id)))
            );
            onNotify?.({
              severity: "success",
              message: single
                ? `Collection "${single.name}" deleted successfully.`
                : `${count} collections deleted successfully.`,
            });
            setSelectedIds([]);
            void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
          } catch (error) {
            onNotify?.({
              severity: "error",
              message: getErrorMessage(error, "Failed to delete collection(s)."),
            });
          }
        },
      });
    },
    [onNotify, queryClient]
  );

  // Table & Filter Fields Definition
  const fields = useMemo<WeaverDataField<CollectionRow>[]>(
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
        label: "Collection Name",
        getValue: (r) => r.name,
        searchable: true,
        sortable: true,
        width: 240,
        render: (val, r) => {
          const name = String(val || "-");
          const collectionId = String(r?.id || "").trim();
          if (!collectionId) return name;
          return (
            <RouterLink
              to={`/collections/${encodeURIComponent(collectionId)}`}
              style={{
                fontWeight: 600,
                color: "var(--color-fg-default, #151b2b)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent-fg, #d9102b)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-fg-default, #151b2b)")}
            >
              {name}
            </RouterLink>
          );
        },
      },
      {
        key: "description",
        label: "Description",
        getValue: (r) => r.description || "-",
        searchable: true,
        width: 280,
        render: (val) => (
          <span style={{ color: "var(--color-fg-muted, #64748b)" }}>
            {String(val || "-")}
          </span>
        ),
      },
      {
        key: "type",
        label: "Format",
        getValue: (r) => String(r.type || "").toUpperCase(),
        type: "enum",
        sortable: true,
        width: 140,
        options: [
          { label: "POSTMAN", value: "POSTMAN" },
          { label: "SWAGGER", value: "SWAGGER" },
        ],
        render: (val) => {
          const value = String(val || "").toUpperCase();
          if (value === "POSTMAN") {
            return <Tag text="POSTMAN" color="#ea580c" borderColor="#ea580c" />;
          }
          if (value === "SWAGGER") {
            return <Tag text="SWAGGER" color="#16a34a" borderColor="#16a34a" />;
          }
          return <Tag text={value || "-"} randomColor />;
        },
      },
      {
        key: "createdAt",
        label: "Created At",
        getValue: (r) => r.createdAt,
        sortable: true,
        width: 190,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
      {
        key: "createdBy",
        label: "Created By",
        getValue: (r) => resolveUserDisplay(r.createdBy, currentUser)?.name || r.createdBy || "-",
        visibleByDefault: false,
        hideable: true,
        sortable: true,
        width: 190,
        render: (_val, r) => <UserAvatarCell value={r.createdBy} currentUser={currentUser} />,
      },
      {
        key: "updatedAt",
        label: "Updated At",
        getValue: (r) => r.updatedAt,
        visibleByDefault: false,
        hideable: true,
        sortable: true,
        width: 190,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
      {
        key: "updatedBy",
        label: "Updated By",
        getValue: (r) => resolveUserDisplay(r.updatedBy, currentUser)?.name || r.updatedBy || "-",
        visibleByDefault: false,
        hideable: true,
        sortable: true,
        width: 190,
        render: (_val, r) => <UserAvatarCell value={r.updatedBy} currentUser={currentUser} />,
      },
    ],
    [currentUser]
  );

  // Filter items locally if client search is active
  const filteredItems = useMemo(() => {
    if (!debouncedSearch?.trim()) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.type?.toLowerCase().includes(q)
    );
  }, [items, debouncedSearch]);

  // Toolbar Actions - Direct "Import Collection" button, removing refresh and new collection context menu
  const toolbarActions = useMemo<WeaverDataAction<CollectionRow>[]>(
    () => [
      {
        id: "import-collection",
        label: "Import Collection",
        icon: <UploadCloud size={16} />,
        asButton: true,
        buttonVariant: "contained",
        buttonColor: "primary",
        onClick: () => {
          setStagedFile(null);
          setImportModalOpen(true);
        },
      },
    ],
    []
  );


  return (
    <div
      ref={containerRef}
      className={styles.container}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragOverlayContent}>
            <div className={styles.dragOverlayIcon}>
              <UploadCloud size={32} />
            </div>
            <h3 className={styles.dragOverlayTitle}>
              Drop OpenAPI or Postman Spec Here
            </h3>
            <p className={styles.dragOverlaySubtitle}>
              Release file to automatically analyze and import endpoints into Weaver
            </p>
          </div>
        </div>
      )}

      {/* Explorer Component */}
      <WeaverDataExplorer<CollectionRow>
        storageKey="weaver_collections_explorer_v2"
        records={filteredItems}
        getRecordId={getCollectionRecordId}
        fields={fields}
        defaultView="canvas"
        searchable
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search collections by name, description, or format..."
        dataMode="server"
        totalRecords={rowCount}
        pagination
        paginationModel={{ page, pageSize }}
        pageSizeOptions={[12, 24, 48, 96]}
        onPaginationChange={(model) => {
          setPage(model.page);
          setPageSize(model.pageSize);
        }}
        selectionMode="none"
        toolbarActions={toolbarActions}
        height="calc(100vh - 104px)"
        loading={loading}
        errorMessage={errorMessage}
        onRecordClick={(record) => {
          if (record?.id) {
            navigate(`/collections/${encodeURIComponent(record.id)}`);
          }
        }}
        renderCanvasItem={(record, context) => (
          <CollectionCard
            collection={record as unknown as ApiCollection}
            isSelected={context.isSelected}
            onToggleSelect={context.onToggleSelect}
          />
        )}
        emptyState={
          <div className={styles.emptyStateWrapper}>
            <div className={styles.emptyIconBox}>
              <FileCode size={32} />
            </div>
            <h3 className={styles.emptyTitle}>No API Collections Registered</h3>
            <p className={styles.emptyDescription}>
              Ingest your OpenAPI v3, Swagger 2.0, or Postman v2.1 specifications to catalog verified
              endpoints ready for your workflow HTTP tasks.
            </p>
            <div className={styles.emptyActionGroup}>
              <button
                type="button"
                className={styles.primaryImportBtn}
                onClick={() => {
                  setStagedFile(null);
                  setImportModalOpen(true);
                }}
              >
                <UploadCloud size={16} />
                <span>Import Collection</span>
              </button>
            </div>
          </div>
        }
      />

      {/* Import Modal */}
      <CollectionImportModal
        open={importModalOpen}
        initialFile={stagedFile}
        onClose={() => {
          setImportModalOpen(false);
          setStagedFile(null);
        }}
        onSuccess={() => {
          void refetchCollections();
        }}
        onNotify={onNotify}
      />

      {/* Delete Confirmation Modal */}
      <WeaverConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        warnings={confirmState.warnings}
        confirmPhrase={confirmState.confirmPhrase}
        onConfirm={async () => {
          if (confirmState.onConfirm) {
            await confirmState.onConfirm();
          }
          setConfirmState((prev) => ({ ...prev, open: false }));
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default CollectionsPageContent;
