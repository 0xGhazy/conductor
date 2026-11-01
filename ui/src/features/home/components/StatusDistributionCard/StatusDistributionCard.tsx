import React from "react";
import { Link } from "react-router-dom";
import styles from "./StatusDistributionCard.module.css";
import type { StatusCount } from "../../types";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const STATUS_COLOR_MAP: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: "Completed", color: "var(--color-status-success, #15803D)" },
  FAILED: { label: "Failed", color: "var(--color-status-danger, #C81E2D)" },
  RUNNING: { label: "Running", color: "var(--color-status-info, #1D4ED8)" },
  TIMED_OUT: { label: "Timed Out", color: "var(--hue-orange, #EA580C)" },
  TERMINATED: { label: "Terminated", color: "var(--color-fg-muted, #667085)" },
  PAUSED: { label: "Paused", color: "var(--hue-amber, #D97706)" },
};

interface StatusDistributionCardProps {
  statuses: StatusCount[];
  totalExecutions: number;
  dateFilterParams: { from: string | null; to: string | null };
}

export const StatusDistributionCard: React.FC<StatusDistributionCardProps> = ({
  statuses,
  totalExecutions,
  dateFilterParams,
}) => {
  const [hoveredStatus, setHoveredStatus] = React.useState<string | null>(null);

  const filterQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    if (dateFilterParams.from) params.set("from", dateFilterParams.from);
    if (dateFilterParams.to) params.set("to", dateFilterParams.to);
    return params.toString();
  }, [dateFilterParams]);

  const totalCalculated = React.useMemo(
    () => statuses.reduce((sum, s) => sum + (s.count || 0), 0),
    [statuses]
  );

  const effectiveTotal = Math.max(totalCalculated, totalExecutions, 0);

  // SVG Donut calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.29

  let accumulatedPercent = 0;
  const segments = statuses
    .filter((s) => s.count > 0 && effectiveTotal > 0)
    .map((s) => {
      const pct = (s.count / effectiveTotal) * 100;
      const strokeLength = (pct / 100) * circumference;
      const strokeOffset = circumference - (accumulatedPercent / 100) * circumference;
      accumulatedPercent += pct;
      const color = STATUS_COLOR_MAP[s.status]?.color || "var(--color-fg-muted)";

      return {
        status: s.status,
        count: s.count,
        percent: pct,
        strokeLength,
        strokeOffset,
        color,
      };
    });

  const activeHoverSegment = segments.find((s) => s.status === hoveredStatus);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Status Distribution</h2>
          <div className={styles.subtitle}>Executed workflows by terminal and active state</div>
        </div>
      </div>

      {effectiveTotal > 0 ? (
        <div className={styles.contentSplit}>
          <div className={styles.chartWrapper} aria-hidden="true">
            <svg className={styles.donutSvg} viewBox="0 0 140 140">
              {/* Background circle track */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="var(--color-surface-soft)"
                strokeWidth="16"
              />
              {/* Colored Segments */}
              {segments.map((seg) => {
                const isHovered = hoveredStatus === seg.status;
                return (
                  <circle
                    key={seg.status}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={isHovered ? 20 : 16}
                    strokeDasharray={`${seg.strokeLength} ${circumference}`}
                    strokeDashoffset={seg.strokeOffset}
                    strokeLinecap="butt"
                    style={{
                      transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                      opacity: hoveredStatus && !isHovered ? 0.45 : 1,
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setHoveredStatus(seg.status)}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                );
              })}
            </svg>

            <div className={styles.centerTextContainer}>
              <div className={styles.centerValue}>
                {numberFormatter.format(
                  activeHoverSegment ? activeHoverSegment.count : effectiveTotal
                )}
              </div>
              <div className={styles.centerLabel}>
                {activeHoverSegment
                  ? STATUS_COLOR_MAP[activeHoverSegment.status]?.label || activeHoverSegment.status
                  : "Total"}
              </div>
            </div>
          </div>

          <div className={styles.legendList} role="list">
            {statuses.map((item) => {
              const meta = STATUS_COLOR_MAP[item.status] || {
                label: item.status,
                color: "var(--color-fg-muted)",
              };
              const pct = effectiveTotal > 0 ? (item.count / effectiveTotal) * 100 : 0;
              const link = `/executions?status=${item.status}${filterQuery ? `&${filterQuery}` : ""}`;

              return (
                <Link
                  key={item.status}
                  to={link}
                  className={styles.legendRow}
                  onMouseEnter={() => setHoveredStatus(item.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  title={`View ${meta.label} executions`}
                >
                  <span
                    className={styles.statusIndicator}
                    style={{ backgroundColor: meta.color }}
                    aria-hidden="true"
                  />
                  <span className={styles.statusName}>{meta.label}</span>
                  <span className={styles.spacer} />
                  <span className={styles.statusCount}>{numberFormatter.format(item.count)}</span>
                  <span className={styles.statusPercent}>{percentFormatter.format(pct)}%</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>No executions recorded in this time range.</div>
      )}
    </div>
  );
};

export default StatusDistributionCard;
