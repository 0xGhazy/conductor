import React from "react";
import styles from "./WorkerPoolCard.module.css";
import type { WorkerInfo } from "../../types";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

interface WorkerPoolCardProps {
  workers: WorkerInfo[];
}

const formatLastPoll = (timestamp?: number): string | null => {
  if (!timestamp || timestamp <= 0) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

export const WorkerPoolCard: React.FC<WorkerPoolCardProps> = ({ workers }) => {
  const totalThreads = React.useMemo(() => {
    return workers.reduce((sum, w) => sum + (w.threadCount || 0), 0);
  }, [workers]);

  const registeredCount = React.useMemo(() => {
    return workers.filter((w) => w.registered).length;
  }, [workers]);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Registered Worker Pools</h2>
          <div className={styles.subtitle}>Conductor task polling workers and thread allocation</div>
        </div>
        <div className={styles.headerBadges}>
          <span className={styles.badge}>{numberFormatter.format(registeredCount)} active</span>
          <span className={styles.badge}>{numberFormatter.format(totalThreads)} threads</span>
        </div>
      </div>

      {workers.length > 0 ? (
        <div className={styles.workerList} role="list">
          {workers.map((worker, index) => {
            const hasCustomThreads = worker.threadCount != null;
            const lastPollText = formatLastPoll(worker.lastPollTime);

            return (
              <div key={`${worker.name}-${worker.workerId || index}`} className={styles.workerRow}>
                <span
                  className={`${styles.statusDot} ${
                    worker.registered ? styles.dotRegistered : styles.dotUnregistered
                  }`}
                  aria-hidden="true"
                />
                <div className={styles.workerIdentity}>
                  <span className={styles.workerName} title={worker.name}>
                    {worker.name}
                  </span>
                  {worker.workerId && (
                    <span className={styles.workerIdSub} title={`Worker ID: ${worker.workerId}`}>
                      {worker.workerId}
                    </span>
                  )}
                </div>
                <span className={styles.spacer} />
                {lastPollText && (
                  <span
                    className={styles.lastPollPill}
                    title={
                      worker.lastPollTime
                        ? `Last polled: ${new Date(worker.lastPollTime).toLocaleString()}`
                        : undefined
                    }
                  >
                    {lastPollText}
                  </span>
                )}
                <span className={styles.threadPill}>
                  {hasCustomThreads
                    ? `${numberFormatter.format(worker.threadCount!)} threads`
                    : "default threads"}
                </span>
                <span
                  className={worker.registered ? styles.registeredChip : styles.unregisteredChip}
                >
                  {worker.registered ? "Active" : "Inactive"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>No worker pools reported by the Conductor backend.</div>
      )}
    </div>
  );
};

export default WorkerPoolCard;
