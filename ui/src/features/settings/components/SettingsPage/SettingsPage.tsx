import { useEffect, type ReactNode } from "react";
import { findSettingsItem } from "../../navigation/settingsNavigation";
import styles from "./SettingsPage.module.css";

interface SettingsPageProps {
  /** Id of the page in the Settings navigation; its label and description become the header. */
  sectionId: string;
  /** Buttons on the right of the header. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A Settings page: title, description and actions from the navigation, then the content. */
export function SettingsPage({ sectionId, actions, children }: SettingsPageProps) {
  const item = findSettingsItem(sectionId);
  const title = item?.label ?? "Settings";

  useEffect(() => {
    document.title = `Weaver - Settings - ${title}`;
  }, [title]);

  return (
    <section className={styles.page} aria-labelledby={`settings-${sectionId}-title`}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 id={`settings-${sectionId}-title`} className={styles.title}>
            {title}
          </h1>
          {item?.description && <p className={styles.description}>{item.description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

export default SettingsPage;
