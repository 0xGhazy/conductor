import React from "react";
import styles from "./QueueDepthCard.module.css";
import type { TaskQueueInfo } from "../../types";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

interface QueueDepthCardProps {
  queues: TaskQueueInfo[];
}

export const QueueDepthCard: React.FC<QueueDepthCardProps> = ({ queues }) => {
  const sortedQueues = React.useMemo(() => {
    return [...queues].sort((a, b) => (b.size || 0) - (a.size || 0));
  }, [queues]);

  const totalQueued = React.useMemo(() => {
    return sortedQueues.reduce((sum, q) => sum + (q.size || 0), 0);
  }, [sortedQueues]);

  const activeQueuesCount = React.useMemo(() => {
    return sortedQueues.filter((q) => (q.size || 0) > 0).length;
  }, [sortedQueues]);

  const maxSize = React.useMemo(() => {
    return Math.max(1, ...sortedQueues.map((q) => q.size || 0));
  }, [sortedQueues]);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Task Queue Depth</h2>
          <div className={styles.subtitle}>Conductor task queues and active worker lag</div>
        </div>
        <div className={styles.headerBadges}>
          <span className={styles.badge}>{numberFormatter.format(totalQueued)} queued</span>
          <span className={styles.badge}>{numberFormatter.format(activeQueuesCount)} active</span>
        </div>
      </div>

      {sortedQueues.length > 0 ? (
        <div className={styles.queueList} role="list">
          {sortedQueues.map((queue) => {
            const size = queue.size || 0;
            const pct = Math.min(100, Math.max(2, (size / maxSize) * 100));
            const isHighBacklog = size > 50;

            const tagClass = queue.registeredWorker
              ? styles.tagWorker
              : queue.internalQueue
              ? styles.tagInternal
              : styles.tagTask;

            const tagLabel = queue.registeredWorker
              ? "Worker"
              : queue.internalQueue
              ? "Internal"
              : "Task";

            return (
              <div key={queue.name} className={styles.queueRow}>
                <div className={styles.queueInfo}>
                  <span className={styles.queueName} title={queue.name}>
                    {queue.name}
                  </span>
                  <span className={`${styles.queueTag} ${tagClass}`}>{tagLabel}</span>
                  <span className={styles.spacer} />
                  <span className={styles.queueSize}>{numberFormatter.format(size)}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${isHighBacklog ? styles.barFillWarning : ""}`}
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>No task queue backlog reported by Conductor.</div>
      )}
    </div>
  );
};

export default QueueDepthCard;
