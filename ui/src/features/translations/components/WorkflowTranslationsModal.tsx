import { useContext, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Backdrop from "@mui/material/Backdrop";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import MuiTextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import {
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Languages,
  X,
  Layers,
} from "lucide-react";
import { WeaverTextField } from "@/components/common/fields";
import { WeaverButton } from "@/components/common/buttons";
import { useWeaverNotification } from "@/components/common/notifications";
import { translationApi } from "@/features/translations/services/translationApi";
import type {
  WorkflowTranslation,
  WorkflowTranslationPayload,
} from "@/features/translations/types/translationTypes";
import { QueryClientContext } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { translationKeys } from "@/features/translations/hooks/queryKeys";
import { isStartNode, useDesignerStore } from "@/features/designer";
import { supportedLanguagesApi } from "@/features/settings";
import type { SupportedLanguage } from "@/features/settings";
import styles from "./WorkflowTranslationsModal.module.css";

export interface WorkflowTranslationsModalProps {
  open: boolean;
  onClose: () => void;
  workflowName: string;
  workflowVersion: number | string;
}

export function WorkflowTranslationsModal({
  open,
  onClose,
  workflowName,
  workflowVersion,
}: WorkflowTranslationsModalProps) {
  const { success: showSuccess, error: showError } = useWeaverNotification();
  // Read the client via context (not useQueryClient) so the modal still renders
  // without a QueryClientProvider (e.g. isolated designer tests).
  const queryClient = useContext(QueryClientContext);
  const invalidateTranslationLists = () => {
    void queryClient?.invalidateQueries({ queryKey: translationKeys.all });
  };
  const [translations, setTranslations] = useState<WorkflowTranslation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Selection & form state (null selectedId = Add New mode)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageCode, setMessageCode] = useState("");
  const [formTranslations, setFormTranslations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copiedExpression, setCopiedExpression] = useState(false);

  // Select only the slices this modal needs (not the whole store / nodes array),
  // so node drags and unrelated designer updates don't re-render the modal.
  const {
    workflowSupportedLanguages,
    setWorkflowSupportedLanguages,
    workflowLanguage,
    setWorkflowLanguage,
    setNodes,
  } = useDesignerStore(
    useShallow((state) => ({
      workflowSupportedLanguages: state.workflowSupportedLanguages,
      setWorkflowSupportedLanguages: state.setWorkflowSupportedLanguages,
      workflowLanguage: state.workflowLanguage,
      setWorkflowLanguage: state.setWorkflowLanguage,
      setNodes: state.setNodes,
    }))
  );

  const [availableLanguages, setAvailableLanguages] = useState<SupportedLanguage[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const fetchLangs = async () => {
      try {
        setLoadingLanguages(true);
        const data = await supportedLanguagesApi.list();
        if (active && Array.isArray(data) && data.length > 0) {
          setAvailableLanguages(data);
        }
      } catch (err) {
        console.warn("Could not load supported languages in WorkflowTranslationsModal:", err);
      } finally {
        if (active) setLoadingLanguages(false);
      }
    };
    fetchLangs();
    return () => {
      active = false;
    };
  }, [open]);

  const languageOptions = useMemo(() => {
    const list = new Set<string>();
    availableLanguages.forEach((l) => {
      if (l.code) list.add(l.code.toLowerCase());
    });
    (workflowSupportedLanguages || []).forEach((c) => {
      if (c) list.add(String(c).toLowerCase());
    });
    if (list.size === 0) {
      list.add("en");
      list.add("ar");
    }
    return Array.from(list);
  }, [availableLanguages, workflowSupportedLanguages]);

  const effectiveDefaultLanguage = useMemo(() => {
    const current = (workflowLanguage || "").trim().toLowerCase();
    const supported = (workflowSupportedLanguages || []).map((l) =>
      String(l).trim().toLowerCase()
    );
    if (supported.length > 0) {
      if (current && supported.includes(current)) {
        return current;
      }
      return supported[0];
    }
    return current || "";
  }, [workflowLanguage, workflowSupportedLanguages]);

  // Ensure default language is selected and filled when supported languages exist
  useEffect(() => {
    if (!open) return;
    const supported = (workflowSupportedLanguages || []).map((l) =>
      String(l).trim().toLowerCase()
    );
    if (supported.length > 0) {
      const current = (workflowLanguage || "").trim().toLowerCase();
      if (!current || !supported.includes(current)) {
        const autoDefault = supported[0];
        setWorkflowLanguage(autoDefault);
        setNodes((nds) =>
          nds.map((n) =>
            isStartNode(n)
              ? {
                  ...n,
                  data: {
                    ...(n.data || {}),
                    config: {
                      ...(n.data?.config || {}),
                      language: autoDefault,
                    },
                  },
                }
              : n
          )
        );
      }
    }
  }, [open, workflowSupportedLanguages, workflowLanguage, setWorkflowLanguage, setNodes]);

  const handleSupportedLanguagesChange = (newValues: string[]) => {
    const cleaned = (newValues || [])
      .map((l) => String(l).trim().toLowerCase())
      .filter(Boolean);
    setWorkflowSupportedLanguages(cleaned);

    let nextDefault = (workflowLanguage || "").trim().toLowerCase();
    if (cleaned.length > 0) {
      if (!nextDefault || !cleaned.includes(nextDefault)) {
        nextDefault = cleaned[0];
      }
    } else {
      nextDefault = "";
    }
    setWorkflowLanguage(nextDefault);

    setNodes((nds) =>
      nds.map((n) =>
        isStartNode(n)
          ? {
              ...n,
              data: {
                ...(n.data || {}),
                config: {
                  ...(n.data?.config || {}),
                  language: nextDefault,
                  supportedLanguages: cleaned,
                },
              },
            }
          : n
      )
    );
  };

  const handleDefaultLanguageChange = (newDefault: string) => {
    const cleaned = String(newDefault || "").trim().toLowerCase();
    if (!cleaned) return;
    setWorkflowLanguage(cleaned);
    setNodes((nds) =>
      nds.map((n) =>
        isStartNode(n)
          ? {
              ...n,
              data: {
                ...(n.data || {}),
                config: {
                  ...(n.data?.config || {}),
                  language: cleaned,
                },
              },
            }
          : n
      )
    );
  };

  // Currently selected translation item
  const selectedTranslation = useMemo(() => {
    if (!selectedId) return null;
    return translations.find((t) => t.id === selectedId) || null;
  }, [selectedId, translations]);

  // List of active languages for the form
  const effectiveSupported = useMemo(() => {
    const list =
      workflowSupportedLanguages && workflowSupportedLanguages.length > 0
        ? workflowSupportedLanguages
        : [];
    const set = new Set(list.map((l) => l.trim().toLowerCase()).filter(Boolean));
    if (selectedTranslation?.translations) {
      Object.keys(selectedTranslation.translations).forEach((k) => {
        if (k && k.toLowerCase() !== "default") {
          set.add(k.trim().toLowerCase());
        }
      });
    }
    if (set.size === 0) {
      set.add("en");
    }
    return Array.from(set);
  }, [workflowSupportedLanguages, selectedTranslation]);

  const loadTranslations = async (preferredSelectId?: string) => {
    if (!workflowName) return;
    setLoading(true);
    try {
      const page = await translationApi.list({
        page: 0,
        size: 100,
        workflowName,
        workflowVersion: Number(workflowVersion) || 1,
      });
      const items = page.content || [];
      setTranslations(items);

      if (items.length > 0) {
        let targetItem: WorkflowTranslation | undefined;
        if (preferredSelectId) {
          targetItem = items.find(
            (t) => t.id === preferredSelectId || t.messageCode === preferredSelectId
          );
        }
        if (!targetItem && selectedId) {
          targetItem = items.find((t) => t.id === selectedId);
        }
        if (!targetItem && selectedId === null && !preferredSelectId) {
          // Keep in add mode if user specifically initiated it
        } else if (targetItem) {
          handleSelectTranslation(targetItem);
        } else if (!selectedId && items.length > 0) {
          handleSelectTranslation(items[0]);
        }
      } else {
        handleStartCreate();
      }
    } catch {
      showError("Failed to load workflow translations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && workflowName) {
      loadTranslations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workflowName, workflowVersion]);

  const handleSelectTranslation = (item: WorkflowTranslation) => {
    setSelectedId(item.id);
    setMessageCode(item.messageCode);
    const raw = { ...(item.translations || {}) };
    if (raw.default && !raw[effectiveDefaultLanguage]) {
      raw[effectiveDefaultLanguage] = raw.default;
    }
    delete raw.default;

    const next: Record<string, string> = {};
    const supported =
      workflowSupportedLanguages && workflowSupportedLanguages.length > 0
        ? workflowSupportedLanguages
        : ["en"];
    supported.forEach((lang) => {
      next[lang] = raw[lang] || "";
    });
    Object.keys(raw).forEach((k) => {
      if (k && k !== "default" && next[k] === undefined) {
        next[k] = raw[k] || "";
      }
    });
    setFormTranslations(next);
  };

  const handleStartCreate = () => {
    setSelectedId(null);
    setMessageCode("");
    const next: Record<string, string> = {};
    const supported =
      workflowSupportedLanguages && workflowSupportedLanguages.length > 0
        ? workflowSupportedLanguages
        : ["en"];
    supported.forEach((lang) => {
      next[lang] = "";
    });
    setFormTranslations(next);
  };

  const handleTranslationTextChange = (lang: string, value: string) => {
    setFormTranslations((prev) => ({
      ...prev,
      [lang]: value,
    }));
  };

  const handleSaveTranslation = async () => {
    if (!workflowName.trim()) {
      showError("Workflow name is missing");
      return;
    }
    const trimmedCode = messageCode.trim();
    if (!trimmedCode) {
      showError("Message code is required");
      return;
    }
    const defaultText = (formTranslations[effectiveDefaultLanguage] || "").trim();
    if (!defaultText) {
      showError(
        `Default language (${effectiveDefaultLanguage.toUpperCase()}) translation is required and cannot be empty`
      );
      return;
    }

    // Clean up translations: only non-empty strings and NEVER include "default"
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(formTranslations)) {
      if (k !== "default" && v && v.trim()) {
        cleaned[k] = v.trim();
      }
    }

    const payload: WorkflowTranslationPayload = {
      workflowName: workflowName.trim(),
      workflowVersion: Number(workflowVersion) || 1,
      messageCode: trimmedCode,
      translations: cleaned,
    };

    setSaving(true);
    try {
      if (selectedId) {
        await translationApi.update(selectedId, payload);
        invalidateTranslationLists();
        showSuccess(`Translation '${trimmedCode}' updated successfully`);
        await loadTranslations(selectedId);
      } else {
        const created = await translationApi.create(payload);
        invalidateTranslationLists();
        showSuccess(`Translation '${trimmedCode}' created successfully`);
        if (created?.id) {
          await loadTranslations(created.id);
        } else {
          await loadTranslations(trimmedCode);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save translation";
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTranslation = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete translation code '${code}'?`)) {
      return;
    }
    try {
      await translationApi.delete(id);
      invalidateTranslationLists();
      showSuccess(`Deleted translation '${code}'`);
      if (selectedId === id) {
        handleStartCreate();
      }
      loadTranslations();
    } catch {
      showError("Failed to delete translation");
    }
  };

  const handleCopyExpression = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(`\${workflow.translations.${code}}`);
    setCopiedExpression(true);
    setTimeout(() => setCopiedExpression(false), 1800);
  };

  // Filtered translations for the left list
  const filteredTranslations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return translations.filter((t) => {
      if (!q) return true;
      if (t.messageCode.toLowerCase().includes(q)) return true;
      const msgs = Object.values(t.translations || {}).join(" ").toLowerCase();
      return msgs.includes(q);
    });
  }, [translations, searchQuery]);

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
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(1760px, 98vw)",
            maxWidth: "98vw",
            height: "88vh",
            maxHeight: "920px",
            bgcolor: "#161b22",
            borderRadius: "12px",
            boxShadow: "0 24px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px #30363d",
            p: 0,
            overflow: "hidden",
            outline: "none",
          }}
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className={styles.modalHeader}>
            <div className={styles.headerTitleGroup}>
              <div className={styles.titleRow}>
                <Languages size={22} color="var(--color-accent-fg)" />
                <span className={styles.titleText}>Workflow Translations</span>
                <span className={styles.workflowBadge}>
                  <Layers size={12} />
                  {workflowName} · v{workflowVersion}
                </span>
              </div>
              <span className={styles.headerSubtitle}>
                Manage multilingual responses & dynamic message templates for this workflow
              </span>
            </div>

            <div className={styles.headerActions}>
              <Tooltip title="Refresh translations">
                <button
                  className={styles.actionBtn}
                  onClick={() => loadTranslations()}
                  disabled={loading}
                  aria-label="Refresh translations"
                >
                  <RefreshCw size={16} className={loading ? "spin-animation" : ""} />
                </button>
              </Tooltip>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Languages Configuration (Supported Languages & Default Language) */}
          <div className={styles.configBar}>
            <div className={styles.configFieldSupported}>
              <Autocomplete
                multiple
                id="workflow-translations-supported-languages"
                options={languageOptions}
                getOptionLabel={(code) => {
                  const match = availableLanguages.find(
                    (l) => l.code.toLowerCase() === String(code).toLowerCase()
                  );
                  return match
                    ? `${match.name} (${match.code.toUpperCase()})`
                    : String(code).toUpperCase();
                }}
                value={workflowSupportedLanguages || []}
                onChange={(_, newValues) => handleSupportedLanguagesChange(newValues)}
                loading={loadingLanguages}
                disableCloseOnSelect
                renderOption={(props, option, { selected }) => {
                  const match = availableLanguages.find(
                    (l) => l.code.toLowerCase() === String(option).toLowerCase()
                  );
                  return (
                    <li {...props} key={option}>
                      <Checkbox size="small" style={{ marginRight: 8 }} checked={selected} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {match ? match.name : option} ({String(option).toUpperCase()})
                      </Typography>
                    </li>
                  );
                }}
                renderTags={(tagValue, getTagProps) =>
                  tagValue.map((code, index) => {
                    const match = availableLanguages.find(
                      (l) => l.code.toLowerCase() === String(code).toLowerCase()
                    );
                    return (
                      <Chip
                        label={
                          match
                            ? `${match.name} (${match.code.toUpperCase()})`
                            : String(code).toUpperCase()
                        }
                        size="small"
                        {...getTagProps({ index })}
                        key={code}
                        sx={{
                          fontWeight: 500,
                          fontSize: "0.76rem",
                          backgroundColor: "rgba(255, 255, 255, 0.08)",
                          color: "var(--color-fg-default, #f0f6fc)",
                          border: "1px solid var(--color-border-default, #30363d)",
                          "& .MuiChip-deleteIcon": {
                            color: "var(--color-fg-muted, #8b949e)",
                            "&:hover": {
                              color: "var(--color-fg-default, #f0f6fc)",
                            },
                          },
                        }}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <MuiTextField
                    {...params}
                    label="Supported Languages"
                    placeholder={
                      (workflowSupportedLanguages?.length || 0) === 0
                        ? "Select supported languages..."
                        : ""
                    }
                    size="small"
                    fullWidth
                  />
                )}
                size="small"
                sx={{ width: "100%" }}
              />
            </div>

            <div className={styles.configFieldDefault}>
              <MuiTextField
                select
                id="workflow-translations-default-language"
                label="Default Language *"
                size="small"
                value={effectiveDefaultLanguage}
                onChange={(e) => handleDefaultLanguageChange(e.target.value)}
                disabled={(workflowSupportedLanguages || []).length === 0}
                fullWidth
                error={(workflowSupportedLanguages || []).length > 0 && !effectiveDefaultLanguage}
                helperText={
                  (workflowSupportedLanguages || []).length === 0
                    ? "Select supported languages first"
                    : undefined
                }
              >
                {(workflowSupportedLanguages || []).map((code) => {
                  const match = availableLanguages.find(
                    (l) => l.code.toLowerCase() === String(code).toLowerCase()
                  );
                  return (
                    <MenuItem key={code} value={code.toLowerCase()}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {match ? match.name : code} ({code.toUpperCase()})
                      </Typography>
                    </MenuItem>
                  );
                })}
              </MuiTextField>
            </div>
          </div>

          {/* Unified Two-Column Main Layout */}
          <div className={styles.splitLayout}>
            {/* Left Pane: Message Codes List */}
            <div className={styles.listPane}>
              <div className={styles.listPaneHeader}>
                <div className={styles.listTitleGroup}>
                  <span className={styles.listTitle}>Message Codes</span>
                  <span className={styles.countBadge}>{translations.length}</span>
                </div>
                <WeaverButton variant="contained" color="primary" onClick={handleStartCreate} size="small">
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add Code
                </WeaverButton>
              </div>

              {/* Search */}
              <div className={styles.listSearchArea}>
                <div className={styles.searchWrapper}>
                  <Search size={14} className={styles.searchIcon} />
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search message codes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className={styles.clearSearchBtn}
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className={styles.itemsList}>
                {loading && translations.length === 0 ? (
                  <div className={styles.emptyState}>
                    <RefreshCw size={24} className="spin-animation" color="var(--color-accent-fg)" />
                    <span className={styles.emptyTitle}>Loading codes...</span>
                  </div>
                ) : filteredTranslations.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>
                      <Languages size={20} />
                    </div>
                    <span className={styles.emptyTitle}>
                      {searchQuery ? "No matching codes" : "No translations yet"}
                    </span>
                    <span className={styles.emptyDesc}>
                      {searchQuery
                        ? "Try adjusting your search query."
                        : "Click '+ Add Code' to define your first message code."}
                    </span>
                  </div>
                ) : (
                  filteredTranslations.map((item) => {
                    const isSelected = item.id === selectedId;
                    const languages = Object.keys(item.translations || {}).filter(
                      (k) => k && k.toLowerCase() !== "default"
                    );
                    const defaultMsg =
                      item.translations?.[effectiveDefaultLanguage] ||
                      item.translations?.default ||
                      (languages.length > 0 ? item.translations?.[languages[0]] : "") ||
                      "";

                    return (
                      <div
                        key={item.id}
                        className={`${styles.itemCard} ${isSelected ? styles.itemCardActive : ""}`}
                        onClick={() => handleSelectTranslation(item)}
                      >
                        <div className={styles.itemCardHeader}>
                          <span className={styles.codeTitle}>{item.messageCode}</span>
                          <Tooltip title="Delete translation">
                            <button
                              type="button"
                              className={styles.deleteItemBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTranslation(item.id, item.messageCode);
                              }}
                              aria-label={`Delete ${item.messageCode}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </Tooltip>
                        </div>

                        <div className={styles.itemPreview} title={defaultMsg}>
                          {defaultMsg || <em style={{ color: "var(--color-fg-muted)" }}>No default translation</em>}
                        </div>

                        <div className={styles.itemFooter}>
                          <div className={styles.itemLangPills}>
                            {languages.map((lang) => (
                              <span
                                key={lang}
                                className={styles.langPillSmall}
                              >
                                {lang.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Form to Add or Edit */}
            <div className={styles.formPane}>
              {/* Form Pane Header */}
              <div className={styles.formPaneHeader}>
                <div className={styles.formTitleGroup}>
                  <span className={styles.formTitle}>
                    {selectedId ? `Edit: ${selectedTranslation?.messageCode || messageCode}` : "Add Translation"}
                  </span>
                </div>

                <div className={styles.formHeaderActions}>
                  {selectedId && (
                    <>
                      <Tooltip
                        title={
                          copiedExpression
                            ? "Copied!"
                            : `Copy \${workflow.translations.${messageCode}}`
                        }
                      >
                        <button
                          type="button"
                          className={styles.copyExpressionBtn}
                          onClick={() => handleCopyExpression(messageCode)}
                        >
                          {copiedExpression ? (
                            <Check size={13} color="#10b981" />
                          ) : (
                            <Copy size={13} />
                          )}
                          <span>Copy Expression</span>
                        </button>
                      </Tooltip>

                      <WeaverButton variant="outlined" color="inherit" size="small" onClick={handleStartCreate}>
                        <Plus size={14} style={{ marginRight: 4 }} />
                        New Translation
                      </WeaverButton>
                    </>
                  )}
                </div>
              </div>

              {/* Form Pane Body */}
              <div className={styles.formPaneBody}>
                {/* Message Code Input */}
                <div>
                  <WeaverTextField
                    label="Message Code *"
                    placeholder="e.g. transfer_success, insufficient_balance"
                    value={messageCode}
                    onChange={(value) => setMessageCode(value || "")}
                  />
                </div>

                {/* Section Header */}
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Translations</span>
                </div>

                {/* Language Fields */}
                <div className={styles.langInputsList}>
                  {effectiveSupported.map((lang) => {
                    const isDefault =
                      lang.toLowerCase() === effectiveDefaultLanguage.toLowerCase();
                    const isRtl = lang.toLowerCase() === "ar";
                    const match = availableLanguages.find(
                      (l) => l.code.toLowerCase() === lang.toLowerCase()
                    );
                    const langLabel = match ? `${match.name} (${lang.toUpperCase()})` : lang.toUpperCase();

                    return (
                      <div key={lang} className={styles.langFieldGroup}>
                        <div className={styles.langFieldHeader}>
                          <label className={styles.langFieldLabel}>
                            <span>{langLabel}</span>
                            {isDefault && <span className={styles.defaultTag}>Default *</span>}
                          </label>
                        </div>

                        <textarea
                          className={`${styles.textarea} ${isRtl ? styles.textareaRtl : ""}`}
                          rows={3}
                          placeholder={`Enter ${match ? match.name : lang.toUpperCase()} translation...`}
                          value={formTranslations[lang] || ""}
                          onChange={(e) => handleTranslationTextChange(lang, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Pane Footer */}
              <div className={styles.formPaneFooter}>
                <div className={styles.footerLeft}>
                  {selectedId && (
                    <WeaverButton
                      variant="contained"
                      color="error"
                      size="small"
                      onClick={() =>
                        handleDeleteTranslation(selectedId, selectedTranslation?.messageCode || messageCode)
                      }
                      disabled={saving}
                    >
                      <Trash2 size={14} style={{ marginRight: 6 }} />
                      Delete
                    </WeaverButton>
                  )}
                </div>

                <div className={styles.footerRight}>
                  {selectedId ? (
                    <WeaverButton variant="outlined" color="inherit" onClick={handleStartCreate} disabled={saving}>
                      Switch to New
                    </WeaverButton>
                  ) : (
                    <WeaverButton
                      variant="outlined"
                      color="inherit"
                      onClick={() => {
                        setMessageCode("");
                        const resetMap: Record<string, string> = {};
                        effectiveSupported.forEach((l) => (resetMap[l] = ""));
                        setFormTranslations(resetMap);
                      }}
                      disabled={saving}
                    >
                      Clear
                    </WeaverButton>
                  )}

                  <WeaverButton variant="contained" color="primary" onClick={handleSaveTranslation} disabled={saving}>
                    {saving
                      ? "Saving..."
                      : selectedId
                      ? "Update Translation"
                      : "Save Translation"}
                  </WeaverButton>
                </div>
              </div>
            </div>
          </div>
        </Box>
      </Fade>
    </Modal>
  );
}
