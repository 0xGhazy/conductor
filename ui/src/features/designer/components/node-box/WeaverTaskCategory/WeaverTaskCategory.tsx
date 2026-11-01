import React, { memo } from "react";
import type { WeaverTaskCategoryProps } from "./WeaverTaskCategory.types";
import styles from "./WeaverTaskCategory.module.css";

export const WeaverTaskCategory: React.FC<WeaverTaskCategoryProps> = memo(
  function WeaverTaskCategory({
    title,
    isQuickAdd = false,
    children,
    className = "",
  }) {
    return (
      <section className={`${styles.section} ${className}`} aria-label={title}>
        {isQuickAdd ? (
          <div className={styles.quickAddHeader}>
            <h2 className={styles.quickAddTitle}>{title}</h2>
          </div>
        ) : (
          <div className={styles.categoryDivider}>
            <span className={styles.categoryTitle}>{title}</span>
          </div>
        )}

        <div className={styles.grid}>{children}</div>
      </section>
    );
  }
);
