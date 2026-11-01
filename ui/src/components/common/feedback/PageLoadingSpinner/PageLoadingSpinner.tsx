import styles from "./PageLoadingSpinner.module.css";

export interface PageLoadingSpinnerProps {
  message?: string;
  /**
   * When true (default) the spinner fills the viewport (`min-height: 100vh`).
   * Set to false to render it inside existing page content (e.g. within the app layout).
   */
  fullScreen?: boolean;
}

export default function PageLoadingSpinner({
  message = "Loading view...",
  fullScreen = true,
}: PageLoadingSpinnerProps) {
  const className = fullScreen ? styles.container : `${styles.container} ${styles.inline}`;
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className={styles.spinnerWrapper}>
        <div className={styles.spinnerGlow} aria-hidden="true" />
        <div className={styles.spinnerOuter} aria-hidden="true" />
        <div className={styles.spinnerInner} aria-hidden="true" />
      </div>
      {message && <span className={styles.label}>{message}</span>}
    </div>
  );
}
