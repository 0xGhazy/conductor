import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Backdrop from "@mui/material/Backdrop";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
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
import { supportedLanguageKeys, supportedLanguagesApi } from "@/features/settings";
import type { SupportedLanguage } from "@/features/settings";
import styles from "./SupportedLanguagesPage.module.css";

const EMPTY_LANGUAGES: SupportedLanguage[] = [];
const DEFAULT_VISIBLE_FIELDS = ["code", "name", "nativeName", "rtl", "isDefault"];
const getLanguageRecordId = (r: SupportedLanguage) => r.id;

interface LanguageFormData {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  isDefault: boolean;
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
    nativeName: "",
    rtl: false,
    isDefault: false,
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
      nativeName: "",
      rtl: false,
      isDefault: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: SupportedLanguage) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      nativeName: item.nativeName || "",
      rtl: Boolean(item.rtl),
      isDefault: Boolean(item.isDefault),
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
    const nativeName = formData.nativeName.trim();
    const rtl = Boolean(formData.rtl);
    const isDefault = Boolean(formData.isDefault);

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
        await supportedLanguagesApi.update(editingItem.id, {
          name,
          nativeName: nativeName || undefined,
          rtl,
          isDefault,
        });
        showSuccess(`Language '${name}' updated successfully.`);
      } else {
        await supportedLanguagesApi.create({
          code,
          name,
          nativeName: nativeName || undefined,
          rtl,
          isDefault,
        });
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
        key: "nativeName",
        label: "Native Name",
        getValue: (r) => r.nativeName || "-",
        searchable: true,
        sortable: true,
        width: 180,
        render: (val) => (
          <span style={{ color: "var(--color-fg-muted, #64748b)" }}>
            {String(val || "-")}
          </span>
        ),
      },
      {
        key: "rtl",
        label: "Direction",
        getValue: (r) => (r.rtl ? "RTL" : "LTR"),
        sortable: true,
        width: 120,
        render: (_, r) => (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: "0.78rem",
              fontWeight: 600,
              backgroundColor: r.rtl
                ? "rgba(229, 72, 77, 0.1)"
                : "rgba(44, 140, 132, 0.1)",
              color: r.rtl
                ? "var(--color-accent-fg)"
                : "var(--color-support-fg, #2C8C84)",
            }}
          >
            {r.rtl ? "RTL" : "LTR"}
          </span>
        ),
      },
      {
        key: "isDefault",
        label: "Default",
        getValue: (r) => (r.isDefault ? "Default" : "No"),
        sortable: true,
        width: 120,
        render: (_, r) =>
          r.isDefault ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: "0.78rem",
                fontWeight: 600,
                backgroundColor: "rgba(44, 140, 132, 0.15)",
                color: "var(--color-support-fg, #2C8C84)",
              }}
            >
              Default
            </span>
          ) : (
            <span style={{ color: "var(--color-fg-muted, #94a3b8)" }}>-</span>
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
          {r.nativeName && (
            <div>
              Native:{" "}
              <strong style={{ color: "var(--color-fg-default, #1f2328)" }}>
                {r.nativeName}
              </strong>
            </div>
          )}
          <div>
            Direction: {r.rtl ? "Right-to-Left (RTL)" : "Left-to-Right (LTR)"}
          </div>
          {r.isDefault && (
            <div
              style={{
                color: "var(--color-support-fg, #2C8C84)",
                fontWeight: 600,
              }}
            >
              Default System Language
            </div>
          )}
        </div>
      ),
    }),
    []
  );

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.titleRow}>
            <Globe size={28} color="var(--color-accent-fg)" />
            <h1 className={styles.pageTitle}>Supported Languages</h1>
          </div>
        </div>

        <div className={styles.headerActions}>
          <WeaverButton variant="contained" color="primary" onClick={handleOpenCreate}>
            <Plus size={16} style={{ marginRight: 6 }} />
            Add Language
          </WeaverButton>
        </div>
      </div>

      {/* WeaverDataExplorer Table View */}
      <div className={styles.explorerWrapper}>
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
          toolbarActions={toolbarActions}
          rowActions={rowActions}
          canvas={canvasConfig}
          emptyTitle="No supported languages defined yet"
          emptyDescription="Add languages to configure application-wide supported languages."
        />
      </div>

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

                <WeaverTextField
                  label="Native Name"
                  placeholder="e.g. English, العربية"
                  value={formData.nativeName}
                  onChange={(val) =>
                    setFormData((prev) => ({ ...prev, nativeName: val }))
                  }
                />

                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    paddingTop: 4,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.rtl}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            rtl: e.target.checked,
                          }))
                        }
                        size="small"
                        color="error"
                      />
                    }
                    label={
                      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                        Right-to-Left (RTL)
                      </span>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isDefault}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            isDefault: e.target.checked,
                          }))
                        }
                        size="small"
                        color="error"
                      />
                    }
                    label={
                      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                        Default Language
                      </span>
                    }
                  />
                </div>
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
    </div>
  );
}
