import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiDatabase, FiExternalLink, FiGlobe, FiLink } from "react-icons/fi";
import { WeaverRelatedTable, type WeaverRelatedTableColumn } from "@/components/common/data";
import { SECRET_USAGE_LABELS, secretUsagePath } from "../services/secretsService";
import type { SecretUsage } from "../types/secretTypes";
import styles from "./SecretViewContent.module.css";

interface SecretUsagesTableProps {
  usages: SecretUsage[];
  loading?: boolean;
  errorMessage?: string;
}

const getUsageId = (usage: SecretUsage) => `${usage.type}:${usage.id}`;
const USAGE_PAGE_SIZES = [5, 10, 25];

/** Connections (databases, HTTP) that reference the secret, each linking to its definition page. */
export default function SecretUsagesTable({ usages, loading, errorMessage }: SecretUsagesTableProps) {
  const navigate = useNavigate();

  const columns = useMemo<WeaverRelatedTableColumn<SecretUsage>[]>(
    () => [
      {
        key: "type",
        label: "Connection Domain",
        getValue: (u) => SECRET_USAGE_LABELS[u.type] ?? u.type,
        sortable: true,
        width: 210,
        render: (u) => {
          const isDb = u.type === "DATASOURCE";
          return (
            <span className={`${styles.usageTypeBadge} ${isDb ? styles.badgeDatasource : styles.badgeHttp}`}>
              {isDb ? <FiDatabase size={12} /> : <FiGlobe size={12} />}
              <span>{SECRET_USAGE_LABELS[u.type] ?? u.type}</span>
            </span>
          );
        },
      },
      {
        key: "name",
        label: "Connection Name",
        getValue: (u) => u.name,
        sortable: true,
        searchable: true,
        render: (u) => (
          <button
            type="button"
            className={styles.usageNameLink}
            onClick={(e) => {
              e.stopPropagation();
              navigate(secretUsagePath(u));
            }}
            title={`Open ${u.name}`}
          >
            <span>{u.name}</span>
            <FiExternalLink size={12} style={{ color: "var(--color-fg-muted)", flexShrink: 0 }} />
          </button>
        ),
      },
    ],
    [navigate]
  );

  return (
    <WeaverRelatedTable<SecretUsage>
      records={usages}
      columns={columns}
      getRecordId={getUsageId}
      searchable
      searchPlaceholder="Search referencing connections..."
      pagination
      pageSizeOptions={USAGE_PAGE_SIZES}
      loading={loading}
      errorMessage={errorMessage}
      onRowClick={(u) => navigate(secretUsagePath(u))}
      emptySearchMessage="No matching connections"
      emptyState={
        <div className={styles.emptyUsages}>
          <FiLink size={24} style={{ color: "var(--color-fg-muted)", opacity: 0.7 }} />
          <div className={styles.emptyTitle}>Not Referenced by Any Connection</div>
          <p className={styles.emptyText}>
            Paste this secret&apos;s reference token into a Database password or HTTP Connection credential field to bind it.
          </p>
        </div>
      }
      maxHeight={360}
    />
  );
}
