import { useState, type FormEvent, type KeyboardEvent } from "react";
import Button from "@mui/material/Button";
import { WeaverTextField } from "@/components/common/fields";
import { EMPTY_ADVANCED, validateAdvanced, type AdvancedFilters } from "./auditLogFilters";
import styles from "./SettingsPages.module.css";

interface AuditAdvancedFiltersProps {
  value: AdvancedFilters;
  onApply: (value: AdvancedFilters) => void;
  onClose: () => void;
}

const FIELDS: Array<{ key: keyof AdvancedFilters; label: string; placeholder: string; inputMode?: "numeric" }> = [
  { key: "actor", label: "Actor", placeholder: "Username, name or email" },
  { key: "resourceId", label: "Resource ID", placeholder: "Exact ID" },
  { key: "eventId", label: "Event ID", placeholder: "Exact event ID" },
  { key: "clientIp", label: "Client IP", placeholder: "e.g. 10.20.4.17" },
  { key: "minDurationMs", label: "Min duration (ms)", placeholder: "0", inputMode: "numeric" },
  { key: "maxDurationMs", label: "Max duration (ms)", placeholder: "Any", inputMode: "numeric" },
];

/**
 * The less common filters, edited as a draft and applied together, so typing an ID doesn't send a
 * request per keystroke. Exact identifiers are checked before they are sent.
 */
export function AuditAdvancedFilters({ value, onApply, onClose }: AuditAdvancedFiltersProps) {
  const [draft, setDraft] = useState<AdvancedFilters>(value);
  const [submitted, setSubmitted] = useState(false);
  const errors = validateAdvanced(draft);
  const shownErrors = submitted ? errors : {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    onApply(
      Object.fromEntries(Object.entries(draft).map(([key, v]) => [key, v.trim()])) as unknown as AdvancedFilters
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <form
      id="audit-advanced-filters"
      className={styles.advancedFilters}
      aria-label="More filters"
      onSubmit={submit}
      onKeyDown={handleKeyDown}
      noValidate
    >
      <div className={styles.advancedGrid}>
        {FIELDS.map((field) => (
          <WeaverTextField
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            value={draft[field.key]}
            onChange={(next) => setDraft((prev) => ({ ...prev, [field.key]: next }))}
            errorMessage={shownErrors[field.key]}
            inputProps={field.inputMode ? { inputMode: field.inputMode } : undefined}
            clearable
            onClear={() => setDraft((prev) => ({ ...prev, [field.key]: "" }))}
            autoFocus={field.key === "actor"}
          />
        ))}
      </div>
      <div className={styles.advancedActions}>
        <Button type="submit" size="small" variant="contained" disableElevation>
          Apply
        </Button>
        <Button size="small" variant="text" onClick={() => setDraft(EMPTY_ADVANCED)}>
          Clear these
        </Button>
        <Button size="small" variant="text" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default AuditAdvancedFilters;
