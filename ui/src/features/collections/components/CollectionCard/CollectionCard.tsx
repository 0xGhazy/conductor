import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Globe } from "lucide-react";
import { SiPostman, SiSwagger } from "react-icons/si";
import { toTimezoneDateTime } from "@/utils/dateTime";
import type { ApiCollection } from "@/features/collections/types/apiCollectionTypes";
import styles from "./CollectionCard.module.css";

interface CollectionCardProps {
  collection: ApiCollection;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  isSelected = false,
}) => {
  const navigate = useNavigate();
  const format = String(collection?.type || "").toUpperCase();
  const isSwagger = format === "SWAGGER";
  const isPostman = format === "POSTMAN";

  const handleCardClick = () => {
    navigate(`/collections/${encodeURIComponent(collection.id)}`);
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
      onClick={handleCardClick}
      tabIndex={0}
      role="article"
      aria-label={`API Collection ${collection.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleCardClick();
        }
      }}
    >
      {/* Top section: Icon + Title + Format Badge */}
      <div className={styles.cardTop}>
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

        <div className={styles.headerInfo}>
          <div className={styles.titleRow}>
            <Link
              to={`/collections/${encodeURIComponent(collection.id)}`}
              className={styles.name}
              onClick={(e) => e.stopPropagation()}
              title={collection.name}
            >
              {collection.name}
            </Link>
          </div>

          <div className={styles.badgeRow}>
            <span
              className={`${styles.formatBadge} ${
                isSwagger
                  ? styles.badgeSwagger
                  : isPostman
                  ? styles.badgePostman
                  : styles.badgeDefault
              }`}
            >
              {format || "CUSTOM"}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className={styles.description}>
        {collection.description?.trim() || "No description provided for this API collection."}
      </p>

      {/* Metadata */}
      <div className={styles.metadataRow}>
        <div className={styles.metaItem}>
          <Clock size={12} />
          <span>{toTimezoneDateTime(collection.createdAt, "Africa/Cairo") || "Recently registered"}</span>
        </div>
      </div>
    </div>
  );
};

export default CollectionCard;
