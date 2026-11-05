import type { ReactNode } from "react";
import { Info } from "lucide-react";
import styles from "./SettingsNotice.module.css";

interface SettingsNoticeProps {
  title: string;
  children?: ReactNode;
}

/** A calm, inline note at the top of a page, e.g. "this shows sample data". */
export function SettingsNotice({ title, children }: SettingsNoticeProps) {
  return (
    <div className={styles.notice} role="note">
      <Info size={16} aria-hidden className={styles.icon} />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
      </div>
    </div>
  );
}

export default SettingsNotice;
