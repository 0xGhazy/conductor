import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Backdrop from "@mui/material/Backdrop";
import {
  Languages,
  X,
  Layers,
  Globe,
} from "lucide-react";
import { modalStyle } from "@/utils/modalStyle";
import { WeaverTextField } from "@/components/common/fields";
import { WeaverButton } from "@/components/common/buttons";
import { useWeaverNotification } from "@/components/common/notifications";
import { translationApi } from "@/features/translations/services/translationApi";
import type {
  WorkflowTranslation,
  WorkflowTranslationPayload,
} from "@/features/translations/types/translationTypes";
import styles from "./TranslationFormModal.module.css";

export interface TranslationFormModalProps {
  open: boolean;
  onClose: () => void;
  workflowName?: string;
  workflowVersion?: number | string;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  initialData?: WorkflowTranslation | null;
  onSuccess?: () => void;
}

export function TranslationFormModal({
  open,
  onClose,
  workflowName = "",
  workflowVersion = 1,
  supportedLanguages,
  defaultLanguage,
  initialData,
  onSuccess,
}: TranslationFormModalProps) {
  const { success: showSuccess, error: showError } = useWeaverNotification();

  const [name, setName] = useState(workflowName);
  const [version, setVersion] = useState(Number(workflowVersion) || 1);
  const [messageCode, setMessageCode] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Determine active supported languages list
  const effectiveSupported = useMemo(() => {
    // Languages come from props only (no designer-store coupling, so this modal
    // doesn't pull the designer/xyflow bundle into the Translations page chunk).
    const list = supportedLanguages && supportedLanguages.length > 0 ? supportedLanguages : [];
    const set = new Set(list.map((l) => l.trim().toLowerCase()).filter(Boolean));

    // When editing, also retain any existing languages already saved
    if (initialData?.translations) {
      Object.keys(initialData.translations).forEach((k) => {
        if (k && k.toLowerCase() !== "default") {
          set.add(k.trim().toLowerCase());
        }
      });
    }

    if (set.size === 0) {
      set.add("en");
    }
    return Array.from(set);
  }, [supportedLanguages, initialData]);

  // Determine the effective default language
  const effectiveDefault = useMemo(() => {
    const def = (defaultLanguage || "").trim().toLowerCase();
    if (def && effectiveSupported.includes(def)) return def;
    return effectiveSupported[0] || "en";
  }, [defaultLanguage, effectiveSupported]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.workflowName);
      setVersion(initialData.workflowVersion);
      setMessageCode(initialData.messageCode);

      const raw = { ...(initialData.translations || {}) };
      // Migrate legacy "default" key to effective default if missing
      if (raw.default && !raw[effectiveDefault]) {
        raw[effectiveDefault] = raw.default;
      }
      delete raw.default;

      const nextTranslations: Record<string, string> = {};
      effectiveSupported.forEach((lang) => {
        nextTranslations[lang] = raw[lang] || "";
      });
      // Preserve any extra languages from existing data
      Object.keys(raw).forEach((k) => {
        if (k && k !== "default" && nextTranslations[k] === undefined) {
          nextTranslations[k] = raw[k] || "";
        }
      });
      setTranslations(nextTranslations);
    } else {
      setName(workflowName);
      setVersion(Number(workflowVersion) || 1);
      setMessageCode("");
      const nextTranslations: Record<string, string> = {};
      effectiveSupported.forEach((lang) => {
        nextTranslations[lang] = "";
      });
      setTranslations(nextTranslations);
    }
  }, [initialData, workflowName, workflowVersion, open, effectiveSupported, effectiveDefault]);

  const handleTranslationChange = (lang: string, value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [lang]: value,
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showError("Workflow name is required");
      return;
    }
    if (!messageCode.trim()) {
      showError("Message code is required");
      return;
    }
    const defaultVal = (translations[effectiveDefault] || "").trim();
    if (!defaultVal) {
      showError(
        `Default language (${effectiveDefault.toUpperCase()}) translation is required and cannot be empty`
      );
      return;
    }

    // Clean up translations: only non-empty strings and NEVER include "default"
    const cleanedTranslations: Record<string, string> = {};
    for (const [k, v] of Object.entries(translations)) {
      if (k !== "default" && v && v.trim()) {
        cleanedTranslations[k] = v.trim();
      }
    }

    const payload: WorkflowTranslationPayload = {
      workflowName: name.trim(),
      workflowVersion: version,
      messageCode: messageCode.trim(),
      translations: cleanedTranslations,
    };

    setSaving(true);
    try {
      if (initialData?.id) {
        await translationApi.update(initialData.id, payload);
        showSuccess("Translation updated successfully");
      } else {
        await translationApi.create(payload);
        showSuccess("Translation created successfully");
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save translation";
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 300 } }}
    >
      <Fade in={open}>
        <Box
          sx={{
            ...modalStyle,
            p: 0,
            overflow: "hidden",
          }}
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className={styles.modalHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Languages size={20} color="var(--color-accent-fg)" />
              <span className={styles.headerTitle}>
                {initialData ? "Edit Translation" : "Add Translation"}
              </span>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className={styles.modalBody}>
            {workflowName ? (
              <div className={styles.metaBanner}>
                <span className={styles.metaLabel}>Workflow Target:</span>
                <span className={styles.metaTag}>
                  <Layers size={13} />
                  {name || "Untitled"} · Version {version}
                </span>
              </div>
            ) : (
              <div className={styles.formGrid}>
                <WeaverTextField
                  label="Workflow Name *"
                  placeholder="e.g. sim_swap_flow"
                  value={name}
                  onChange={(value) => setName(value || "")}
                  disabled={Boolean(initialData)}
                />
                <WeaverTextField
                  label="Version *"
                  value={String(version)}
                  onChange={(value) => setVersion(Number(value) || 1)}
                  disabled={Boolean(initialData)}
                />
              </div>
            )}

            {/* Message Code Input */}
            <div>
              <WeaverTextField
                label="Message Code *"
                placeholder="e.g. transfer_success, insufficient_balance"
                value={messageCode}
                onChange={(value) => setMessageCode(value || "")}
                helperText="Unique identifier referenced by Respond nodes"
              />
            </div>

            {/* Translations Section */}
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Globe size={16} color="var(--color-accent-fg)" />
                Language Translations
              </span>
              <span className={styles.sectionHint}>
                Default: <strong>{effectiveDefault.toUpperCase()}</strong> (Required)
              </span>
            </div>

            <div className={styles.langInputsList}>
              {effectiveSupported.map((lang) => {
                const isDefault = lang === effectiveDefault;
                const isRtl = lang === "ar";

                return (
                  <div
                    key={lang}
                    className={`${styles.langCard} ${
                      isDefault ? styles.langCardDefault : ""
                    }`}
                  >
                    <div className={styles.langCardHeader}>
                      <div className={styles.langLabelGroup}>
                        <span
                          className={`${styles.langBadge} ${
                            isDefault ? styles.langBadgeDefault : ""
                          }`}
                        >
                          {lang.toUpperCase()}
                        </span>
                        {isDefault && (
                          <span className={styles.defaultPill}>Default Language *</span>
                        )}
                        {isRtl && <span className={styles.rtlPill}>RTL</span>}
                      </div>
                    </div>

                    <textarea
                      className={`${styles.textarea} ${isRtl ? styles.textareaRtl : ""}`}
                      rows={2}
                      placeholder={
                        isDefault
                          ? `Default message for '${lang.toUpperCase()}' (e.g. Your balance is \${workflow.input.amount}) *`
                          : `Translation for '${lang.toUpperCase()}'`
                      }
                      value={translations[lang] || ""}
                      onChange={(e) => handleTranslationChange(lang, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className={styles.modalFooter}>
            <WeaverButton variant="outlined" color="inherit" onClick={onClose} disabled={saving}>
              Cancel
            </WeaverButton>
            <WeaverButton variant="contained" color="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : initialData ? "Update Translation" : "Save Translation"}
            </WeaverButton>
          </div>
        </Box>
      </Fade>
    </Modal>
  );
}
