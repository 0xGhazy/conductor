import React from "react";
import {
  Save,
  Globe,
  Loader2,
} from "lucide-react";
import { SiPostman, SiSwagger } from "react-icons/si";
import { WeaverTextField, WeaverSelectField } from "@/components/common/fields";
import { WeaverButton } from "@/components/common/buttons";
import styles from "./CollectionDetailsHeader.module.css";

interface CollectionDetailsHeaderProps {
  collection: any;
  formErrors: Record<string, string>;
  isCreateMode: boolean;
  loading: boolean;
  submitting: boolean;
  onChange: (field: string, value: any) => void;
  connections: any[];
  connectionsLoading?: boolean;
  onSave: () => void;
  onDelete?: () => void | Promise<void>;
}

export const CollectionDetailsHeader: React.FC<CollectionDetailsHeaderProps> = ({
  collection,
  formErrors,
  isCreateMode,
  loading,
  submitting,
  onChange,
  connections,
  connectionsLoading = false,
  onSave,
  onDelete,
}) => {
  const type = String(collection?.type || "POSTMAN").toUpperCase();
  const isSwagger = type === "SWAGGER";
  const isPostman = type === "POSTMAN";

  const typeOptions = [
    { label: "Postman Collection", value: "POSTMAN" },
    { label: "OpenAPI / Swagger Spec", value: "SWAGGER" },
  ];

  const connectionOptions = [
    { label: "None (No connection)", value: "" },
    ...connections.map((conn) => ({
      label: conn.strategy ? `${conn.name} (${conn.strategy})` : conn.name,
      value: String(conn.id || ""),
    })),
  ];

  return (
    <div className={styles.headerWrapper}>
      {/* Top Action Bar: Delete and Save Changes */}
      <div className={styles.topBar}>
        {!isCreateMode && onDelete && (
          <WeaverButton
            mode="delete"
            variant="outlined"
            size="small"
            onAction={onDelete}
            disabled={loading || submitting}
            loading={submitting}
            loadingLabel="Deleting..."
            holdLabel="Hold to delete..."
            className={styles.deleteWeaverBtn}
          >
            Delete Collection
          </WeaverButton>
        )}

        <button
          type="button"
          className={styles.primarySaveBtn}
          onClick={onSave}
          disabled={submitting || loading}
        >
          {submitting ? (
            <>
              <Loader2 size={15} className="spin" />
              <span>{isCreateMode ? "Creating..." : "Saving..."}</span>
            </>
          ) : (
            <>
              <Save size={15} />
              <span>{isCreateMode ? "Create Collection" : "Save Changes"}</span>
            </>
          )}
        </button>
      </div>

      {/* Collection Configuration Section */}
      <div className={styles.collectionConfigSection}>
        <div className={styles.sectionHeader}>
          <div
            className={`${styles.iconWrapper} ${
              isSwagger
                ? styles.iconSwagger
                : isPostman
                ? styles.iconPostman
                : styles.iconDefault
            }`}
            aria-hidden="true"
          >
            {isSwagger ? (
              <SiSwagger size={22} />
            ) : isPostman ? (
              <SiPostman size={22} />
            ) : (
              <Globe size={22} />
            )}
          </div>

          <div className={styles.headerTitleGroup}>
            <div className={styles.titleRow}>
              <h2 className={styles.panelTitle}>Collection Configuration</h2>
              <span
                className={`${styles.badge} ${
                  isSwagger ? styles.badgeSwagger : styles.badgePostman
                }`}
              >
                {type}
              </span>
            </div>
            <p className={styles.panelSubtitle}>
              Manage collection identity, format specifications, and HTTP connection.
            </p>
          </div>
        </div>

        <div className={styles.fieldsGrid}>
          {/* Collection Name */}
          <div className={styles.gridField}>
            <WeaverTextField
              label="Collection Name"
              required
              value={collection?.name || ""}
              onChange={(val) =>
                onChange(
                  "name",
                  typeof val === "string" ? val : (val as any)?.target?.value ?? ""
                )
              }
              placeholder="e.g. Core Banking APIs"
              errorMessage={formErrors.name}
              disabled={loading || submitting}
            />
          </div>

          {/* Specification Format */}
          <div className={styles.gridField}>
            <WeaverSelectField
              label="Specification Format"
              value={collection?.type || "POSTMAN"}
              options={typeOptions}
              onChange={(val) => onChange("type", val)}
              disabled={loading || submitting}
            />
          </div>

          {/* Connection Binding */}
          <div className={styles.gridField}>
            <WeaverSelectField
              label="HTTP Connection (Optional)"
              value={collection?.connection || ""}
              options={connectionOptions}
              onChange={(val) => onChange("connection", val)}
              disabled={loading || submitting || connectionsLoading}
            />
          </div>

          {/* Description */}
          <div className={styles.gridFieldFull}>
            <WeaverTextField
              label="Description"
              multiline
              rows={3}
              value={collection?.description || ""}
              onChange={(val) =>
                onChange(
                  "description",
                  typeof val === "string" ? val : (val as any)?.target?.value ?? ""
                )
              }
              placeholder="Service overview, authorization instructions, or maintainer contacts..."
              disabled={loading || submitting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionDetailsHeader;
