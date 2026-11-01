import React from "react";
import styles from "./HoldProgress.module.css";

export interface HoldProgressProps {
  /** True while the user is pressing and holding. */
  active: boolean;
  /**
   * Hold duration in milliseconds; should match `useHoldToConfirm`'s duration.
   * @default 1500
   */
  duration?: number;
  /**
   * Render the bottom progress strip; when false only the background fill is shown.
   * @default true
   */
  showBar?: boolean;
}

/**
 * Background flood + bottom progress strip shown during a press-and-hold.
 * Uses `currentColor`; the parent must be `position: relative; overflow: hidden`.
 * The flood strength can be tuned with `--weaver-hold-fill-opacity` (default 0.12).
 */
export function HoldProgress({ active, duration = 1500, showBar = false }: HoldProgressProps) {
  const style = { "--weaver-hold-duration": `${duration}ms` } as React.CSSProperties;
  const activeClass = active ? styles.active : "";

  return (
    <>
      <span className={`${styles.overlay} ${activeClass}`.trim()} style={style} aria-hidden="true" />
      {showBar ? (
        <span className={styles.track} aria-hidden="true">
          <span className={`${styles.bar} ${activeClass}`.trim()} style={style} />
        </span>
      ) : null}
    </>
  );
}

export default HoldProgress;
