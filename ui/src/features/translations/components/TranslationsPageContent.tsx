import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TranslateIcon from "@mui/icons-material/Translate";
import { useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import type { AppLayoutContext } from "@/app/layout/AppLayout";
import { useWeaverNotification } from "@/components/common/notifications";
import useDebounce from "@/hooks/useDebounce";
import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import Tag from "@/components/common/data/Tag/Tag";
import { getErrorMessage } from "@/utils/error";
import { translationApi } from "../services/translationApi";
import { translationKeys } from "../hooks/queryKeys";
import { useTranslationsList } from "../hooks/useTranslations";
import { TranslationFormModal } from "./TranslationFormModal";
import type { WorkflowTranslation } from "../types/translationTypes";

const EMPTY_TRANSLATIONS: WorkflowTranslation[] = [];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_VISIBLE_FIELDS = ["workflowName", "workflowVersion", "messageCode", "defaultMessage", "languages"];
const getTranslationId = (r: WorkflowTranslation) => r.id;

const TRANSLATIONS_CANVAS = {
  renderIcon: () => (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        backgroundColor: "#0f766e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        boxShadow: (theme) =>
          `0 4px 14px ${alpha("#0f766e", theme.palette.mode === "dark" ? 0.45 : 0.3)}`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "scale(1.06)",
        },
      }}
    >
      <TranslateIcon sx={{ fontSize: 26, color: "#ffffff" }} />
    </Box>
  ),
  renderStatus: (r: WorkflowTranslation) => (
    <Tag text={r.messageCode} color="#0f766e" borderColor="#0f766e" />
  ),
  primaryFieldKey: "workflowName",
  secondaryFieldKey: "messageCode",
  descriptionFieldKey: "defaultMessage",
};

export default function TranslationsPageContent() {
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const queryClient = useQueryClient();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };
  const [searchQuery, setSearchQuery] = useState(search || "");
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [pageSize, setPageSize] = useState(20);
  // The page index is tied to the search it was chosen for; when the debounced search
  // changes, the effective page is derived as 0 (no reset effect -> no double fetch).
  const [pageState, setPageState] = useState({ page: 0, search: debouncedSearch });
  const page = pageState.search === debouncedSearch ? pageState.page : 0;

  // Sync external header search
  useEffect(() => {
    if (search !== undefined) {
      setSearchQuery(search);
    }
  }, [search]);

  const translationsQuery = useTranslationsList({
    page,
    size: pageSize,
    search: debouncedSearch.trim() || undefined,
  });
  const translations = translationsQuery.data?.content ?? EMPTY_TRANSLATIONS;
  const totalElements = translationsQuery.data?.totalElements || 0;
  const loading = translationsQuery.isFetching;

  useEffect(() => {
    if (translationsQuery.error) {
      showError("Failed to fetch workflow translations.");
    }
  }, [translationsQuery.error, showError]);

  const { refetch } = translationsQuery;
  const refreshTranslations = useCallback(() => {
    void refetch();
  }, [refetch]);

  const invalidateTranslations = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: translationKeys.all });
  }, [queryClient]);

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkflowTranslation | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    warnings: string[];
    confirmPhrase: string;
    onConfirm: (() => Promise<void>) | null;
  }>({
    open: false,
    title: "Delete translation?",
    description: "You are about to delete this translation.",
    warnings: [],
    confirmPhrase: "DELETE",
    onConfirm: null,
  });

  const handleCreate = useCallback(() => {
    setEditingItem(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((item: WorkflowTranslation) => {
    setEditingItem(item);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => setModalOpen(false), []);

  const openDeleteConfirm = useCallback(
    (item: WorkflowTranslation) => {
      setConfirmState({
        open: true,
        title: `Delete translation '${item.messageCode}'?`,
        description: `Are you sure you want to delete the translation for message code '${item.messageCode}' in workflow '${item.workflowName}'?`,
        warnings: ["This action cannot be undone."],
        confirmPhrase: item.messageCode || "DELETE",
        onConfirm: async () => {
          await translationApi.delete(item.id);
          showSuccess(`Translation '${item.messageCode}' deleted successfully.`);
          invalidateTranslations();
        },
      });
    },
    [invalidateTranslations, showSuccess]
  );

  const fields = useMemo<WeaverDataField<WorkflowTranslation>[]>(
    () => [
      {
        key: "workflowName",
        label: "Workflow",
        getValue: (r) => r.workflowName,
        searchable: true,
        sortable: true,
        width: 220,
        render: (val) => <span style={{ fontWeight: 600 }}>{String(val || "-")}</span>,
      },
      {
        key: "workflowVersion",
        label: "Version",
        getValue: (r) => r.workflowVersion,
        sortable: true,
        width: 110,
        render: (val) => <Tag text={`v${val || 1}`} color="#64748b" borderColor="#94a3b8" />,
      },
      {
        key: "messageCode",
        label: "Message Code",
        getValue: (r) => r.messageCode,
        searchable: true,
        sortable: true,
        width: 180,
        render: (val) => (
          <span style={{ fontFamily: "monospace", color: "#0f766e", fontWeight: 600 }}>
            {String(val || "-")}
          </span>
        ),
      },
      {
        key: "defaultMessage",
        label: "Default Message",
        getValue: (r) => r.translations?.default || "-",
        searchable: true,
        width: 280,
        render: (val) => (
          <span
            style={{
              display: "block",
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--color-fg-muted, #475569)",
            }}
          >
            {String(val || "-")}
          </span>
        ),
      },
      {
        key: "languages",
        label: "Languages",
        getValue: (r) => Object.keys(r.translations || {}).join(", "),
        width: 220,
        render: (_, r) => {
          const languages = Object.keys(r.translations || {});
          return (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {languages.map((lang) => (
                <Chip
                  key={lang}
                  label={lang}
                  size="small"
                  variant={lang === "default" ? "filled" : "outlined"}
                  color={lang === "default" ? "primary" : "default"}
                  sx={{ height: 22, fontSize: "11px" }}
                />
              ))}
            </Box>
          );
        },
      },
    ],
    []
  );

  const toolbarActions = useMemo<WeaverDataAction<WorkflowTranslation>[]>(
    () => [
      {
        id: "new",
        label: "Add Translation",
        icon: <AddIcon fontSize="small" />,
        onClick: handleCreate,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: <RefreshIcon fontSize="small" />,
        onClick: refreshTranslations,
      },
    ],
    [refreshTranslations, handleCreate]
  );

  const rowActions = useMemo<WeaverDataAction<WorkflowTranslation>[]>(
    () => [
      {
        id: "edit",
        label: "Edit",
        icon: <EditOutlinedIcon fontSize="small" />,
        onClick: ({ record }) => {
          if (record) handleEdit(record);
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: ({ record }) => {
          if (record) openDeleteConfirm(record);
        },
      },
    ],
    [handleEdit, openDeleteConfirm]
  );

  return (
    <>

      <div className="definitions-content" style={{ padding: "20px 24px", flex: 1 }}>
        <WeaverDataExplorer<WorkflowTranslation>
          records={translations}
          getRecordId={getTranslationId}
          fields={fields}
          storageKey="workflow-translations"
          defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
          dataMode="server"
          selectionMode="none"
          loading={loading}
          searchable
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search translations by workflow or message code..."
          stickyHeader
          height="calc(100vh - 220px)"
          toolbarActions={toolbarActions}
          rowActions={rowActions}
          onRecordClick={handleEdit}
          pagination
          totalRecords={totalElements}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          paginationModel={paginationModel}
          onPaginationChange={handlePaginationChange}
          canvas={TRANSLATIONS_CANVAS}
          emptyTitle="No workflow translations found"
          emptyDescription="Add localized response message templates used by Respond nodes across workflows."
        />
      </div>

      <TranslationFormModal
        open={modalOpen}
        onClose={handleCloseModal}
        initialData={editingItem}
        onSuccess={invalidateTranslations}
      />

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
            showError(getErrorMessage(error, "Failed to delete translation."));
          }
        }}
      />
    </>
  );
}
