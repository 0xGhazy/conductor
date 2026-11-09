import React from "react";
import styles from "./CollectionSettingsForm.module.css";

interface CollectionSettingsFormProps {
  form: any;
  formErrors: Record<string, string>;
  onChange: (field: string, value: any) => void;
  isCreateMode?: boolean;
}

export const CollectionSettingsForm: React.FC<CollectionSettingsFormProps> = ({
  form,
  formErrors,
  onChange,
  isCreateMode = false,
}) => {
  return (
    <div className={styles.settingsPanel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Collection Configuration</h3>
      </div>

      <div className={styles.grid}>
        {/* Name */}
        <div className={styles.formGroup}>
          <label htmlFor="setting-name" className={styles.label}>
            Collection Name <span className={styles.requiredStar}>*</span>
          </label>
          <input
            id="setting-name"
            type="text"
            className={`${styles.input} ${formErrors.name ? styles.inputError : ""}`}
            value={form?.name || ""}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g. Core Banking APIs"
            disabled={!isCreateMode && false}
            required
            minLength={3}
          />
          {formErrors.name && (
            <span className={styles.errorText}>{formErrors.name}</span>
          )}
        </div>

        {/* Type / Format */}
        <div className={styles.formGroup}>
          <label htmlFor="setting-type" className={styles.label}>
            Specification Format
          </label>
          <select
            id="setting-type"
            className={styles.select}
            value={form?.type || "POSTMAN"}
            onChange={(e) => onChange("type", e.target.value)}
          >
            <option value="POSTMAN">Postman Collection</option>
            <option value="SWAGGER">OpenAPI / Swagger Spec</option>
          </select>
        </div>

        {/* Description */}
        <div className={styles.formGroupFull}>
          <label htmlFor="setting-description" className={styles.label}>
            Description
          </label>
          <textarea
            id="setting-description"
            className={styles.textarea}
            value={form?.description || ""}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Service overview, authorization instructions, or maintainer contacts..."
          />
        </div>
      </div>
    </div>
  );
};

export default CollectionSettingsForm;
