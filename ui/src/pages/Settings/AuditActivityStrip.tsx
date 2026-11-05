import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Tooltip from "@mui/material/Tooltip";
import type { AuditHistogram } from "@/features/settings";
import styles from "./AuditActivityStrip.module.css";

interface AuditActivityStripProps {
  histogram: AuditHistogram | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** e.g. "in the last 24 hours". */
  rangeText: string;
  /** Narrows the list to one bucket. */
  onSelect: (from: number, to: number) => void;
}

const exact = new Intl.NumberFormat();
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const count = (value: number) => (value >= 10_000 ? compact.format(value) : exact.format(value));

const DAY = 86_400_000;
const timeOf = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayOf = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const dayTimeOf = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Axis and tooltip text for a bucket, at the precision its width needs. */
const bucketLabel = (start: number, end: number, bucketMs: number) => {
  if (bucketMs >= DAY) {
    return bucketMs === DAY ? dayOf.format(start) : `${dayOf.format(start)} – ${dayOf.format(end - 1)}`;
  }
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  return sameDay
    ? `${dayOf.format(start)}, ${timeOf.format(start)}–${timeOf.format(end)}`
    : `${dayTimeOf.format(start)} – ${dayTimeOf.format(end)}`;
};

const axisLabel = (time: number, bucketMs: number, spanMs: number) =>
  bucketMs >= DAY ? dayOf.format(time) : spanMs > DAY ? dayTimeOf.format(time) : timeOf.format(time);

const plural = (n: number, word: string) => `${exact.format(n)} ${word}${n === 1 ? "" : "s"}`;

/**
 * One line above the list: how many events the filters match, how many failed, and when. Each
 * bar is one bucket of time; choosing it narrows the list to that period.
 */
export function AuditActivityStrip({ histogram, loading, error, onRetry, rangeText, onSelect }: AuditActivityStripProps) {
  const buckets = useMemo(() => histogram?.buckets ?? [], [histogram]);
  const max = useMemo(() => buckets.reduce((m, b) => Math.max(m, b.total), 0), [buckets]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const barRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // One tab stop: the busiest bucket, so arrowing starts where there is something to read.
  const busiest = useMemo(
    () => buckets.reduce((best, b, i) => (b.total > (buckets[best]?.total ?? -1) ? i : best), 0),
    [buckets]
  );
  const tabIndexAt = Math.min(focusIndex ?? busiest, Math.max(0, buckets.length - 1));

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(buckets.length - 1, index));
    setFocusIndex(next);
    barRefs.current[next]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: tabIndexAt + 1,
      ArrowLeft: tabIndexAt - 1,
      Home: 0,
      End: buckets.length - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      moveTo(keys[e.key]);
    }
  };

  if (error && !histogram) {
    return (
      <section className={styles.strip} aria-label="Activity">
        <p className={styles.message}>
          Couldn’t load the activity for this range.{" "}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        </p>
      </section>
    );
  }

  if (!histogram) {
    return (
      <section className={styles.strip} aria-label="Activity" aria-busy="true">
        <div className={styles.summary}>
          <span className={`${styles.skeleton} ${styles.skeletonCount}`} />
          <span className={`${styles.skeleton} ${styles.skeletonText}`} />
        </div>
        <div className={styles.chart} aria-hidden="true">
          <div className={styles.bars}>
            {Array.from({ length: 30 }, (_, i) => (
              <span key={i} className={styles.skeletonBar} style={{ height: `${20 + ((i * 37) % 70)}%` }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const { total, failed, bucketMs, from, to } = histogram;
  const span = to - from;
  const middle = buckets[Math.floor(buckets.length / 2)];

  return (
    <section className={styles.strip} aria-label="Activity" aria-busy={loading || undefined}>
      <p className={styles.summary}>
        <span className={styles.total} title={total >= 10_000 ? exact.format(total) : undefined}>
          {count(total)} {total === 1 ? "event" : "events"}
        </span>
        <span className={styles.detail}>
          {failed > 0 ? (
            <span className={styles.failed} title={failed >= 10_000 ? exact.format(failed) : undefined}>
              {count(failed)} failed
            </span>
          ) : (
            <span>none failed</span>
          )}
          <span className={styles.range}>{rangeText}</span>
        </span>
      </p>

      <div className={styles.chart}>
        <div
          className={styles.bars}
          role="group"
          aria-label={`Events over time, ${plural(buckets.length, "period")}. Choose one to show only that period.`}
          onKeyDown={handleKeyDown}
        >
          {buckets.map((bucket, i) => {
            const end = Math.min(bucket.start + bucketMs, to);
            const start = Math.max(bucket.start, from);
            const label = bucketLabel(start, end, bucketMs);
            const height = max ? (bucket.total / max) * 100 : 0;
            const failedShare = bucket.total ? (bucket.failed / bucket.total) * 100 : 0;
            const spoken = `${label}: ${plural(bucket.total, "event")}${bucket.failed ? `, ${exact.format(bucket.failed)} failed` : ""}`;
            return (
              <Tooltip
                key={bucket.start}
                title={
                  <span className={styles.tip}>
                    <span>{label}</span>
                    <span>
                      {plural(bucket.total, "event")}
                      {bucket.failed > 0 && ` · ${exact.format(bucket.failed)} failed`}
                    </span>
                    {bucket.total > 0 && <span className={styles.tipHint}>Select to show only this period</span>}
                  </span>
                }
                placement="top"
                disableInteractive
                enterDelay={80}
              >
                <button
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  type="button"
                  className={styles.bar}
                  tabIndex={i === tabIndexAt ? 0 : -1}
                  aria-label={spoken}
                  // Still focusable, so arrowing passes through quiet periods.
                  aria-disabled={bucket.total === 0 || undefined}
                  onFocus={() => setFocusIndex(i)}
                  onClick={() => bucket.total > 0 && onSelect(start, end)}
                >
                  {bucket.total > 0 ? (
                    <span className={styles.column} style={{ height: `max(${height}%, 3px)` }}>
                      {bucket.failed > 0 && (
                        <span className={styles.columnFailed} style={{ height: `max(${failedShare}%, 2px)` }} />
                      )}
                    </span>
                  ) : (
                    <span className={styles.baseline} />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
        {buckets.length > 1 && (
          <div className={styles.axis} aria-hidden="true">
            <span>{axisLabel(from, bucketMs, span)}</span>
            {middle && buckets.length > 4 && <span>{axisLabel(middle.start, bucketMs, span)}</span>}
            <span>{axisLabel(to, bucketMs, span)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default AuditActivityStrip;
