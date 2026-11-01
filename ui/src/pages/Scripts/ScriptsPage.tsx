import { useCallback, useEffect, useMemo, useState } from "react";
import { Typography } from "@mui/material";
import { useNavigate, useOutletContext } from "react-router-dom";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import type { AppLayoutContext } from "@/app/layout/AppLayout";
import { useWeaverNotification } from "@/components/common/notifications";
import { getErrorMessage } from "@/utils/error";
import { ScriptsTable } from "@/features/scripts";
import { useScripts } from "@/features/scripts";
import type { ScriptDefinition } from "@/features/scripts";
import "@/styles/definitionPages.css";

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  warnings: string[];
  confirmPhrase: string;
  onConfirm: (() => Promise<void>) | null;
}

export default function ScriptsPage() {
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const scriptListParams = useMemo(
    () => ({
      page: paginationModel.page,
      size: paginationModel.pageSize,
      search: debouncedSearch,
    }),
    [debouncedSearch, paginationModel.page, paginationModel.pageSize]
  );
  const { scripts, pageInfo, loading, errorMessage, refresh, deleteScripts } = useScripts(scriptListParams);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "Delete scripts?",
    description: "You are about to delete scripts.",
    warnings: [],
    confirmPhrase: "DELETE",
    onConfirm: null,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const openCreateModal = useCallback(() => {
    navigate("/scripts/new");
  }, [navigate]);

  const openViewPage = useCallback(
    (script: ScriptDefinition) => {
      navigate(`/scripts/${encodeURIComponent(script.id)}`);
    },
    [navigate]
  );

  const openDeleteConfirm = useCallback(
    ({ selectedRows, clearSelection }: { selectedRows?: ScriptDefinition[]; clearSelection?: () => void }) => {
      const rows = Array.isArray(selectedRows) ? selectedRows : [];
      if (!rows.length) return;

      setConfirmState({
        open: true,
        title: `Delete ${rows.length} script${rows.length > 1 ? "s" : ""}?`,
        description: `You're about to delete ${rows.length} script${rows.length > 1 ? "s" : ""}.`,
        warnings: ["This action can't be undone."],
        confirmPhrase: rows.length === 1 ? String(rows[0]?.name || "DELETE") : "DELETE",
        onConfirm: async () => {
          await deleteScripts(rows.map((row) => row.id).filter(Boolean));
          clearSelection?.();
          showSuccess("Script(s) deleted successfully.");
        },
      });
    },
    [deleteScripts, showSuccess]
  );

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, open: false }));
  }, []);

  const confirmAction = confirmState.onConfirm;
  const handleConfirm = useCallback(async () => {
    try {
      await confirmAction?.();
      setConfirmState((prev) => ({ ...prev, open: false }));
    } catch (error) {
      showError(getErrorMessage(error, "Delete failed."));
    }
  }, [confirmAction, showError]);

  return (
    <div className="definitions-page">

      <div className="definitions-content">
            {errorMessage ? <Typography className="definitions-error">{errorMessage}</Typography> : null}
            <ScriptsTable
              scripts={scripts}
              loading={loading}
              page={paginationModel.page}
              pageSize={paginationModel.pageSize}
              totalElements={pageInfo.totalElements}
              onRefresh={refresh}
              onNew={openCreateModal}
              onView={openViewPage}
              onDeleteSelected={openDeleteConfirm}
              onPaginationChange={setPaginationModel}
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
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
