import React, { useState, type ReactNode } from "react";
import ChevronDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ChevronRightIcon from "@mui/icons-material/KeyboardArrowRight";
import styles from "./NodeConfigSection.module.css";

export interface NodeConfigSectionProps {
  title: string;
  description?: string;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const NodeConfigSection: React.FC<NodeConfigSectionProps> = ({
  title,
  description,
  defaultExpanded = true,
  collapsible = true,
  badge,
  children,
  className = "",
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    if (collapsible) {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <div className={`${styles.section} ${className}`.trim()}>
      <div
        className={`${styles.header} ${collapsible ? styles.interactive : ""}`}
        onClick={toggle}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={collapsible ? expanded : undefined}
      >
        <div className={styles.headerTitleArea}>
          {collapsible && (
            <span className={styles.chevron} aria-hidden="true">
              {expanded ? <ChevronDownIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </span>
          )}
          <span className={styles.title}>{title}</span>
          {badge && <span className={styles.badge}>{badge}</span>}
        </div>
        {description && <div className={styles.description}>{description}</div>}
      </div>

      {expanded && <div className={styles.content}>{children}</div>}
    </div>
  );
};
