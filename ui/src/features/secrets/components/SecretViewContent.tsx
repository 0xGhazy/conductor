import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip } from "@mui/material";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiClock,
  FiKey,
  FiLink,
  FiLock,
  FiRefreshCw,
} from "react-icons/fi";
import { WeaverButton } from "@/components/common/buttons";
import { WeaverTextField } from "@/components/common/fields";
import { useWeaverNotification } from "@/components/common/notifications";
import { getAuditFields } from "@/utils/audit";
import {
  formatExactDateTime,
  formatRelativeTime,
  formatTooltipDateTime,
} from "@/utils/dateTime";
import { getErrorMessage } from "@/utils/error";
import { getInitials } from "@/utils/user";
import {
  useCreateSecret,
  useDeleteSecret,
  useSecret,
  useSecretUsages,
  useUpdateSecret,
} from "../hooks/useSecrets";
import {
  SECRET_DESCRIPTION_MAX,
  SECRET_NAME_REGEX,
  buildCreatePayload,
  buildEmptySecretForm,
  buildSecretPlaceholder,
  buildUpdatePayload,
  toSecretApiError,
  validateSecretForm,
} from "../services/secretsService";
import type { SecretFormState, SecretUsage } from "../types/secretTypes";
import CopyReferenceButton from "./CopyReferenceButton";
import SecretValueField from "./SecretValueField";
import styles from "./SecretViewContent.module.css";

interface SecretViewContentProps {
  id?: string;
  isCreateMode: boolean;
}

const monoSx = { fontFamily: "var(--font-mono, monospace)" };

export default function SecretViewContent({ id, isCreateMode }: SecretViewContentProps) {
  const navigate = useNavigate();
  const notify = useWeaverNotification();

  const secretQuery = useSecret(id, { enabled: !isCreateMode });
  const usagesQuery = useSecretUsages(id, { enabled: !isCreateMode });
  const createMutation = useCreateSecret();
  const updateMutation = useUpdateSecret(String(id ?? ""));
  const deleteMutation = useDeleteSecret();

  const secret = secretQuery.data ?? null;
  const usages: SecretUsage[] = usagesQuery.data ?? [];
  const loading = !isCreateMode && Boolean(id) && secretQuery.isPending;
  const notFound = !isCreateMode && toSecretApiError(secretQuery.error, "").code === "SECRET_NOT_FOUND";
  const submitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // The plaintext value lives only here and is cleared after every successful save.
  const [form, setForm] = useState<SecretFormState>(buildEmptySecretForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [replacingValue, setReplacingValue] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Hydrate once per id during render, so background refetches never clobber in-progress edits.
  if (!isCreateMode && id && secret && hydratedFor !== id) {
    setHydratedFor(id);
    setForm({ name: secret.name, value: "", description: secret.description ?? "" });
  }

  const isDirty = isCreateMode
    ? Boolean(form.name || form.value || form.description)
    : replacingValue || form.description !== (secret?.description ?? "");

  const auditFields = useMemo(
    () => getAuditFields(secret, "Unknown creator", "Not modified"),
    [secret]
  );

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  useEffect(() => {
    if (isCreateMode) {
      document.title = "Create Secret";
      return;
    }
    if (!secret?.name) return;
    document.title = `Secrets - ${secret.name}`;
    window.dispatchEvent(
      new CustomEvent("weaver:breadcrumb-title", {
        detail: { title: secret.name, pathname: window.location.pathname },
      })
    );
  }, [isCreateMode, secret?.name]);

  useEffect(() => {
    if (secretQuery.error && !notFound) {
      notify.error(getErrorMessage(secretQuery.error, "Failed to load secret."));
    }
  }, [secretQuery.error, notFound, notify]);

  const handleChange = (field: keyof SecretFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const cancelReplace = () => {
    setReplacingValue(false);
    setForm((prev) => ({ ...prev, value: "" }));
    setFormErrors((prev) => ({ ...prev, value: "" }));
  };

  const reload = async () => {
    await Promise.all([secretQuery.refetch(), usagesQuery.refetch()]);
    setHydratedFor(null);
    cancelReplace();
  };

  const handleSave = async () => {
    const errors = validateSecretForm(form, { isCreateMode, replacingValue });
    setFormErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    try {
      if (isCreateMode) {
        const created = await createMutation.mutateAsync(buildCreatePayload(form));
        setForm(buildEmptySecretForm());
        notify.success(`Secret ${created?.name ?? form.name.trim()} created.`);
        if (created?.id) {
          navigate(`/secrets/${encodeURIComponent(created.id)}`, { replace: true, state: { name: created.name } });
        } else {
          navigate("/secrets");
        }
        return;
      }

      const updated = await updateMutation.mutateAsync(
        buildUpdatePayload(form, { replacingValue, version: secret?.version })
      );
      const refreshed = replacingValue && usages.length > 0;
      cancelReplace();
      if (updated) setForm((prev) => ({ ...prev, description: updated.description ?? "" }));
      notify.success(
        refreshed
          ? `Secret updated. ${usages.length} connection(s) will reconnect with the new value.`
          : "Secret updated."
      );
    } catch (err) {
      const apiError = toSecretApiError(err, isCreateMode ? "Failed to create secret." : "Failed to update secret.");
      if (apiError.code === "SECRET_ALREADY_EXISTS") {
        setFormErrors((prev) => ({ ...prev, name: "A secret with this name already exists" }));
      } else if (apiError.code === "OPTIMISTIC_LOCK_CONFLICT") {
        notify.error({
          title: "Secret changed elsewhere",
          message: "Someone else updated this secret. Reload to see the latest version.",
          action: { label: "Reload", onClick: () => void reload() },
        });
      } else {
        notify.error(apiError.message);
      }
    }
  };

  const handleDelete = async () => {
    if (!id || !secret) return;
    try {
      await deleteMutation.mutateAsync(id);
      notify.success(`Secret ${secret.name} deleted.`);
      navigate("/secrets");
    } catch (err) {
      const apiError = toSecretApiError(err, "Failed to delete secret.");
      notify.error(apiError.message);
      if (apiError.code === "SECRET_IN_USE") void usagesQuery.refetch();
    }
  };

  const previewName = form.name.trim();
  const previewPlaceholder =
    previewName && SECRET_NAME_REGEX.test(previewName) ? buildSecretPlaceholder(previewName) : null;
  const activePlaceholder = isCreateMode ? previewPlaceholder : secret?.placeholder ?? null;
  const deleteBlocked = usages.length > 0;

  if (notFound) {
    return (
      <div className="definitions-page">
        <div className="definitions-content">
          <div className={styles.container}>
            <div className={styles.notFoundCard} role="alert">
              <div className={styles.notFoundContent}>
                <FiAlertTriangle size={18} color="var(--color-status-warn)" />
                <span>This secret doesn&apos;t exist or was deleted.</span>
              </div>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => navigate("/secrets")}
              >
                <FiArrowLeft size={14} />
                <span>Back to secrets</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="definitions-page">
      <div className="definitions-content">
        <div className={styles.container}>
          {/* Top Action Bar */}
          <div className={styles.topHeader}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate("/secrets")}
            >
              <FiArrowLeft size={14} />
              <span>Back</span>
            </button>

            <div className={styles.headerActions}>
              {isDirty ? (
                <span className={styles.dirtyBadge}>
                  <FiAlertCircle size={13} />
                  <span>Unsaved changes</span>
                </span>
              ) : null}

              {!isCreateMode ? (
                <Tooltip
                  title={
                    deleteBlocked
                      ? `Used by ${usages.length} connection(s). Remove the references first.`
                      : ""
                  }
                >
                  <span>
                    <WeaverButton
                      mode="delete"
                      variant="outlined"
                      size="small"
                      onAction={handleDelete}
                      loading={deleteMutation.isPending}
                      loadingLabel="Deleting..."
                      holdLabel="Hold to delete..."
                      disabled={submitting || loading || deleteBlocked || usagesQuery.isPending}
                    >
                      Delete
                    </WeaverButton>
                  </span>
                </Tooltip>
              ) : null}

              <WeaverButton
                mode={isCreateMode ? "save" : "update"}
                variant="contained"
                size="small"
                onAction={handleSave}
                disabled={submitting || loading || (!isCreateMode && !isDirty)}
                loading={submitting}
                loadingLabel={isCreateMode ? "Creating..." : "Saving..."}
              >
                {isCreateMode ? "Create" : "Save changes"}
              </WeaverButton>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState} aria-busy="true" aria-label="Loading secret details">
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} style={{ height: 180 }} />
            </div>
          ) : (
            <div className={`${styles.contentGrid} ${!isCreateMode ? styles.contentGridEdit : ""}`}>
              {/* Left Column: Secret Vault & Reference Configuration */}
              <div
                id={!isCreateMode ? "section-secret-vault" : undefined}
                className={`${styles.card} ${!isCreateMode ? styles.scrollSection : ""}`}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <h1 className={styles.cardTitle}>
                      <FiKey size={16} color="var(--color-accent-fg)" />
                      <span className={!isCreateMode ? styles.cardTitleMono : undefined}>
                        {isCreateMode ? "New Secret" : secret?.name}
                      </span>
                    </h1>
                    <p className={styles.cardSubtitle}>
                      {isCreateMode
                        ? "Define an encrypted credential once and reference it across Database and HTTP connection definitions."
                        : "Manage encrypted secret value rotation, reference syntax, and operational notes."}
                    </p>
                  </div>
                  {!isCreateMode && secret?.version !== undefined ? (
                    <span className={styles.versionPill} title="Optimistic lock version">
                      v{secret.version}
                    </span>
                  ) : null}
                </div>

                <div className={styles.formStack}>
                  {isCreateMode ? (
                    <WeaverTextField
                      label="Name"
                      placeholder="e.g. stripe_live_api_key"
                      value={form.name}
                      onChange={(val) => handleChange("name", val)}
                      fullWidth
                      required
                      autoFocus
                      errorMessage={formErrors.name}
                      helperText="Letters, digits, _ or -. It can't be changed later."
                      slotProps={{ input: { sx: monoSx } }}
                    />
                  ) : null}

                  {/* Interactive Reference Token Console */}
                  <div className={styles.referenceBlock}>
                    <div className={styles.fieldHeadingRow}>
                      <span className={styles.fieldTitle}>
                        <FiLink size={13} color="var(--color-accent-fg)" />
                        <span>Reference</span>
                      </span>
                      {activePlaceholder ? (
                        <CopyReferenceButton
                          placeholder={activePlaceholder}
                          variant="button"
                          label="Copy reference"
                        />
                      ) : null}
                    </div>

                    <div className={styles.referenceBar}>
                      <span
                        className={
                          activePlaceholder ? styles.referenceCode : styles.referenceCodeMuted
                        }
                      >
                        {isCreateMode
                          ? previewPlaceholder ?? "${weaver.secrets.<name>}"
                          : secret?.placeholder}
                      </span>
                    </div>

                    <p className={styles.fieldHint}>
                      Paste this into a database or HTTP connection field to use the secret.
                    </p>
                  </div>

                  {/* Secret Value / Inline Value Rotation */}
                  {isCreateMode ? (
                    <SecretValueField
                      value={form.value}
                      onChange={(v) => handleChange("value", v)}
                      error={formErrors.value}
                      helperText="Encrypted before it's stored. It can't be viewed again after saving."
                    />
                  ) : replacingValue ? (
                    <div className={styles.rotationPanel}>
                      <div className={styles.rotationHeader}>
                        <span className={styles.fieldTitle}>
                          <FiRefreshCw size={13} color="var(--color-accent-fg)" />
                          <span>Rotate Secret Value</span>
                        </span>
                        <span className={styles.encryptionBadge}>Write-only · Encrypted</span>
                      </div>

                      <div className={styles.rotationInputRow}>
                        <div className={styles.rotationInputWrap}>
                          <SecretValueField
                            label="New value"
                            value={form.value}
                            onChange={(v) => handleChange("value", v)}
                            error={formErrors.value}
                            helperText="The new plaintext value is encrypted at rest and never returned by the API."
                            autoFocus
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.cancelRotateBtn}
                          onClick={cancelReplace}
                        >
                          Cancel
                        </button>
                      </div>

                      {usages.length > 0 ? (
                        <div className={styles.blastRadiusWarning} role="status">
                          <FiAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>
                            {usages.length} connection(s) use this secret and will reconnect with the new value after you save.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className={styles.valueVaultBox}>
                      <div className={styles.fieldHeadingRow}>
                        <span className={styles.fieldTitle}>
                          <FiLock size={13} color="var(--color-accent-fg)" />
                          <span>Value</span>
                        </span>
                        <span className={styles.encryptionBadge}>Write-only · Encrypted</span>
                      </div>

                      <div className={styles.valueDisplayRow}>
                        <div className={styles.maskedValueGroup}>
                          <span className={styles.maskedValueText}>
                            {secret?.displayedText || "**********"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={styles.replaceBtn}
                          onClick={() => setReplacingValue(true)}
                          disabled={submitting}
                        >
                          <FiRefreshCw size={12} />
                          <span>Replace value</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <WeaverTextField
                    label="Description"
                    placeholder="Document which external service, environment, or rotation policy applies to this secret..."
                    value={form.description}
                    onChange={(val) => handleChange("description", val)}
                    fullWidth
                    multiline
                    minRows={2}
                    errorMessage={formErrors.description}
                    helperText={`${form.description.length}/${SECRET_DESCRIPTION_MAX}`}
                  />
                </div>
              </div>

              {/* Right Column (View/Edit Mode): Audit History */}
              {!isCreateMode ? (
                <div
                  id="section-secret-governance"
                  className={`${styles.sideColumn} ${styles.scrollSection}`}
                >
                  <div className={styles.auditCard}>
                    <h2 className={styles.auditHeader}>
                      <FiClock size={14} color="var(--color-fg-muted)" />
                      <span>Audit History</span>
                    </h2>

                    <div className={styles.auditRows}>
                      <div className={styles.auditRow}>
                        <div className={styles.auditAvatar}>
                          {getInitials(auditFields.createdBy?.name || "U")}
                        </div>
                        <div className={styles.auditDetails}>
                          <div className={styles.auditText}>
                            Created by <strong>{auditFields.createdBy?.name || "Unknown"}</strong>
                          </div>
                          <div className={styles.auditTimestamp}>
                            {formatExactDateTime(auditFields.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className={styles.auditRow}>
                        <div className={`${styles.auditAvatar} ${styles.auditAvatarSecondary}`}>
                          {getInitials(auditFields.updatedBy?.name || "U")}
                        </div>
                        <div className={styles.auditDetails}>
                          <div className={styles.auditText}>
                            Modified by <strong>{auditFields.updatedBy?.name || "Not modified"}</strong>
                          </div>
                          <div
                            className={styles.auditTimestamp}
                            title={formatTooltipDateTime(auditFields.updatedAt || auditFields.createdAt)}
                          >
                            {formatRelativeTime(auditFields.updatedAt || auditFields.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
