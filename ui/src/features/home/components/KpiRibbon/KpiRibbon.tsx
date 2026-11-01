import React from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle2, Play, AlertTriangle, ArrowRight, Check } from "lucide-react";
import styles from "./KpiRibbon.module.css";
import type { ExecutionMetrics } from "../../types";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface KpiRibbonProps {
  metrics: ExecutionMetrics;
  activeQueuesCount: number;
  dateFilterParams: { from: string | null; to: string | null };
}

export const KpiRibbon: React.FC<KpiRibbonProps> = ({
  metrics,
  activeQueuesCount,
  dateFilterParams,
}) => {
  const { total, completed, failed, running, successRate } = metrics;

  // Build deep link query parameters
  const filterQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    if (dateFilterParams.from) params.set("from", dateFilterParams.from);
    if (dateFilterParams.to) params.set("to", dateFilterParams.to);
    return params.toString();
  }, [dateFilterParams]);

  const failureLink = `/executions?status=FAILED${filterQuery ? `&${filterQuery}` : ""}`;
  const runningLink = `/executions?status=RUNNING${filterQuery ? `&${filterQuery}` : ""}`;
  const completedRatePercent = total > 0 ? (completed / total) * 100 : 0;

  const successBadgeClass =
    successRate >= 95
      ? styles.badgeHealthy
      : successRate >= 85
      ? styles.badgeWarning
      : styles.badgeDanger;

  return (
    <section className={styles.ribbonGrid} aria-label="Key Performance Indicators">
      {/* 1. Total Executions */}
      <div className={styles.kpiCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Total Executions</h2>
          <div className={styles.iconBox} aria-hidden="true">
            <Activity size={16} />
          </div>
        </div>
        <div className={styles.metricValue}>{numberFormatter.format(total)}</div>
        <div className={styles.cardFooter}>
          <span className={styles.subText}>
            {numberFormatter.format(completed)} completed ({percentFormatter.format(completedRatePercent)}%)
          </span>
        </div>
      </div>

      {/* 2. Success Rate */}
      <div className={styles.kpiCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Success Rate</h2>
          <div className={styles.iconBox} aria-hidden="true">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className={styles.metricValue}>{percentFormatter.format(successRate)}%</div>
        <div className={styles.cardFooter}>
          <span className={styles.subText}>SLA Target: 99.0%</span>
          <span className={successBadgeClass}>
            {successRate >= 95 ? "Passing" : successRate >= 85 ? "Degraded" : "Breached"}
          </span>
        </div>
      </div>

      {/* 3. Active Running DAGs */}
      <div className={`${styles.kpiCard} ${styles.activeCard}`}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Active Executions</h2>
          <div className={styles.iconBox} aria-hidden="true">
            <Play size={16} />
          </div>
        </div>
        <div className={styles.metricValue}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span className={styles.runningDot} aria-hidden="true" />
            {numberFormatter.format(running)}
          </span>
        </div>
        <div className={styles.cardFooter}>
          <span className={styles.subText}>{activeQueuesCount} active queues</span>
          {running > 0 && (
            <Link to={runningLink} className={styles.subText} style={{ textDecoration: "underline" }}>
              View running →
            </Link>
          )}
        </div>
      </div>

      {/* 4. Failure Triage Alert (Focal Moment) */}
      <div className={`${styles.kpiCard} ${styles.triageCard}`}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle} style={{ color: "var(--color-status-danger)" }}>
            Failure Triage Alert
          </h2>
          <div
            className={styles.iconBox}
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-status-danger) 12%, transparent)",
              color: "var(--color-status-danger)",
            }}
            aria-hidden="true"
          >
            <AlertTriangle size={16} />
          </div>
        </div>
        <div className={styles.metricValue} style={{ color: failed > 0 ? "var(--color-status-danger)" : "var(--color-fg-default)" }}>
          {numberFormatter.format(failed)}
        </div>
        <div className={styles.cardFooter}>
          {failed > 0 ? (
            <>
              <span className={styles.subText}>
                {percentFormatter.format(total > 0 ? (failed / total) * 100 : 0)}% of total
              </span>
              <Link to={failureLink} className={styles.triageActionBtn} id="btn-triage-failures">
                <span>Triage Failures</span>
                <ArrowRight size={12} strokeWidth={2.5} />
              </Link>
            </>
          ) : (
            <div className={styles.triageCalmBtn}>
              <Check size={14} />
              <span>Zero failures in range</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default KpiRibbon;
