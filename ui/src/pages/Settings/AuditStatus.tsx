import styles from "./SettingsPages.module.css";

/** Success / Failed with a status dot, as used in the audit table and the event panel. */
export function AuditStatus({ status }: { status: string }) {
  const failed = status === "FAILED";
  return (
    <span className={styles.status}>
      <span
        className={`${styles.statusDot} ${failed ? styles.statusDotFailed : styles.statusDotOn}`}
        aria-hidden="true"
      />
      {failed ? "Failed" : status === "SUCCESS" ? "Success" : status}
    </span>
  );
}

export default AuditStatus;
