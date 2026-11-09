import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Backdrop from "@mui/material/Backdrop";
import {
  Languages,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  Globe,
} from "lucide-react";
import { modalStyle } from "@/utils/modalStyle";
import { WeaverDataExplorer } from "@/components/common/data";
import type { WeaverDataField, WeaverDataAction } from "@/components/common/data";
import { WeaverNameField, WeaverTextField } from "@/components/common/fields";
import type { NameValidationResult } from "@/components/common/fields";
import { WeaverConfirmDialog } from "@/components/common/dialogs";
import { WeaverButton } from "@/components/common/buttons";
import { useWeaverNotification } from "@/components/common/notifications";
import { SettingsPage, supportedLanguageKeys, supportedLanguagesApi, type SupportedLanguage } from "@/features/settings";
import styles from "./SupportedLanguagesPage.module.css";

const EMPTY_LANGUAGES: SupportedLanguage[] = [];
const DEFAULT_VISIBLE_FIELDS = ["code", "name"];
const getLanguageRecordId = (r: SupportedLanguage) => r.id;

interface LanguageFormData {
  code: string;
  name: string;
}

export default function SupportedLanguagesPage() {
  const { success: showSuccess, error: showError, warning: showWarning } = useWeaverNotification();
  const queryClient = useQueryClient();
  const languagesQuery = useQuery({
    queryKey: supportedLanguageKeys.list(),
    queryFn: () => supportedLanguagesApi.list(),
  });
  const languages = languagesQuery.data ?? EMPTY_LANGUAGES;
  // Block the table only when nothing is cached; background refetches just spin the refresh icon.
  const loading = languagesQuery.isPending;
  const fetching = languagesQuery.isFetching;
  const refetchLanguages = languagesQuery.refetch;
  const languagesError = languagesQuery.error;

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupportedLanguage | null>(null);
  const [formData, setFormData] = useState<LanguageFormData>({
    code: "",
    name: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation dialog state
  const [deletingItem, setDeletingItem] = useState<SupportedLanguage | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (languagesError) {
      showError("Failed to fetch application-wide supported languages.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languagesError]);

  const fetchLanguages = useCallback(
    () => queryClient.invalidateQueries({ queryKey: supportedLanguageKeys.all }),
    [queryClient]
  );

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      code: "",
      name: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: SupportedLanguage) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
    });
    setModalOpen(true);
  };

  // Debounced async code validation using WeaverNameField
  const validateCode = useCallback(
    async (codeToValidate: string): Promise<NameValidationResult> => {
      const trimmed = codeToValidate.trim().toLowerCase();
      if (!trimmed) {
        return { valid: false, message: "Language code is required." };
      }
      if (trimmed.length < 2 || trimmed.length > 15) {
        return {
          valid: false,
          message: "Code must be between 2 and 15 characters.",
        };
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return {
          valid: false,
          message: "Only alphanumeric characters, hyphens, and underscores are allowed.",
        };
      }

      // Check for duplicates against existing languages
      const exists = languages.some(
        (l) =>
          l.code.toLowerCase() === trimmed &&
          (!editingItem || l.id !== editingItem.id)
      );
      if (exists) {
        return {
          valid: false,
          message: `Language code "${trimmed}" already exists.`,
        };
      }
      return { valid: true };
    },
    [languages, editingItem]
  );

  const handleSave = async () => {
    const code = formData.code.trim().toLowerCase();
    const name = formData.name.trim();

    if (!code) {
      showWarning("Language code is required (e.g. 'en', 'ar')");
      return;
    }
    if (!name) {
      showWarning("Language name is required (e.g. 'English')");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await supportedLanguagesApi.update(editingItem.id, { name });
        showSuccess(`Language '${name}' updated successfully.`);
      } else {
        await supportedLanguagesApi.create({ code, name });
        showSuccess(`Language '${name}' (${code}) added successfully.`);
      }
      setModalOpen(false);
      fetchLanguages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save language";
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      await supportedLanguagesApi.delete(deletingItem.id);
      showSuccess(`Language '${deletingItem.name}' deleted.`);
      setDeletingItem(null);
      fetchLanguages();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Failed to delete language.";
      showError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Field definitions for WeaverDataExplorer
  const fields = useMemo<WeaverDataField<SupportedLanguage>[]>(
    () => [
      {
        key: "code",
        label: "Code",
        getValue: (r) => r.code,
        searchable: true,
        sortable: true,
        width: 130,
        render: (val) => (
          <span className={styles.codeBadge}>
            {String(val || "").toUpperCase()}
          </span>
        ),
      },
      {
        key: "name",
        label: "Language Name",
        getValue: (r) => r.name,
        searchable: true,
        sortable: true,
        width: 220,
        render: (val) => (
          <span style={{ fontWeight: 600 }}>{String(val || "-")}</span>
        ),
      },
      {
        key: "createdAt",
        label: "Created At",
        getValue: (r) => r.createdAt || "",
        sortable: true,
        visibleByDefault: false,
        hideable: true,
        width: 180,
      },
    ],
    []
  );

  // Toolbar Actions
  const toolbarActions = useMemo<WeaverDataAction<SupportedLanguage>[]>(
    () => [
      {
        id: "add-language",
        label: "Add Language",
        icon: <Plus size={16} />,
        onClick: () => handleOpenCreate(),
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: (
          <RefreshCw
            size={16}
            className={fetching ? "spin-animation" : ""}
          />
        ),
        onClick: () => void refetchLanguages(),
      },
    ],
    [fetching, refetchLanguages]
  );

  // Row Actions
  const rowActions = useMemo<WeaverDataAction<SupportedLanguage>[]>(
    () => [
      {
        id: "edit",
        label: "Edit",
        icon: <Edit3 size={15} />,
        onClick: ({ record }) => {
          if (record) handleOpenEdit(record);
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash2 size={15} />,
        danger: true,
        onClick: ({ record }) => {
          if (record) setDeletingItem(record);
        },
      },
    ],
    []
  );

  // Canvas card config for card view mode
  const canvasConfig = useMemo(
    () => ({
      renderIcon: () => (
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "var(--color-accent-soft, rgba(229, 72, 77, 0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-accent-fg)",
          }}
        >
          <Globe size={22} />
        </Box>
      ),
      getCanvasTitle: (r: SupportedLanguage) => r.name,
      renderCanvasStatus: (r: SupportedLanguage) => (
        <span className={styles.codeBadge}>{r.code.toUpperCase()}</span>
      ),
      renderCanvasContent: (r: SupportedLanguage) => (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: "0.85rem",
            color: "var(--color-fg-muted, #64748b)",
          }}
        >
          <div>Code: {r.code}</div>
        </div>
      ),
    }),
    []
  );

  return (
    <SettingsPage
      sectionId="languages"
      actions={
        <WeaverButton variant="contained" color="primary" onClick={handleOpenCreate}>
          <Plus size={16} style={{ marginRight: 6 }} />
          Add Language
        </WeaverButton>
      }
    >
      <WeaverDataExplorer<SupportedLanguage>
        records={languages}
        getRecordId={getLanguageRecordId}
        fields={fields}
        storageKey="settings-supported-languages"
        defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
        dataMode="client"
        selectionMode="none"
        loading={loading}
        searchable
        searchPlaceholder="Search languages by code or name..."
        stickyHeader
        height="calc(100vh - 220px)"
        toolbarActions={toolbarActions}
        rowActions={rowActions}
        canvas={canvasConfig}
        emptyTitle="No supported languages defined yet"
        emptyDescription="Add languages to configure application-wide supported languages."
      />

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{ backdrop: { timeout: 300 } }}
      >
        <Fade in={modalOpen}>
          <Box
            sx={{
              ...modalStyle,
              p: 0,
              overflow: "hidden",
            }}
            className={styles.modalBox}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Languages size={20} color="var(--color-accent-fg)" />
                <span style={{ fontWeight: 700, fontSize: "1.15rem" }}>
                  {editingItem
                    ? "Edit Supported Language"
                    : "Add Supported Language"}
                </span>
              </div>
              <button
                className={styles.actionBtn}
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <WeaverNameField
                  label="Code"
                  placeholder="e.g. en, ar, fr"
                  value={formData.code}
                  onChange={(val) =>
                    setFormData((prev) => ({ ...prev, code: val }))
                  }
                  namePattern={/^[a-zA-Z0-9_-]{2,15}$/}
                  invalidNameMessage="Language code must be 2-15 characters (letters, numbers, hyphens, underscores)"
                  validateName={validateCode}
                  debounceMs={300}
                  showValidationStatus
                  required
                  disabled={Boolean(editingItem)}
                  readOnly={Boolean(editingItem)}
                  helperText={
                    editingItem
                      ? "Language code cannot be changed once created"
                      : "Unique language code (e.g. 'en', 'ar')"
                  }
                />

                <WeaverTextField
                  label="Language Name"
                  placeholder="e.g. English, Arabic"
                  value={formData.name}
                  onChange={(val) =>
                    setFormData((prev) => ({ ...prev, name: val }))
                  }
                  required
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <WeaverButton
                variant="outlined"
                color="inherit"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </WeaverButton>
              <WeaverButton variant="contained" color="primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingItem
                    ? "Update Language"
                    : "Add Language"}
              </WeaverButton>
            </div>
          </Box>
        </Fade>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <WeaverConfirmDialog
        open={Boolean(deletingItem)}
        title="Delete Supported Language"
        message={`Are you sure you want to delete language '${deletingItem?.name}' (${deletingItem?.code})?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        intent="danger"
        loading={deleting}
        onCancel={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
      />
    </SettingsPage>
  );
}
