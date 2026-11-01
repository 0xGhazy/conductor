import React from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Plus } from "lucide-react";
import styles from "./DashboardHeader.module.css";
import type { PresetRangeKey } from "../../types";

const REFRESH_OPTIONS = [
  { label: "5s refresh", value: 5000 },
  { label: "10s refresh", value: 10000 },
  { label: "30s refresh", value: 30000 },
  { label: "1m refresh", value: 60000 },
  { label: "5m refresh", value: 300000 },
  { label: "Pause refresh", value: 0 },
];

interface DashboardHeaderProps {
  preset: PresetRangeKey;
  onPresetChange: (preset: PresetRangeKey) => void;
  customDates: { from: string; to: string };
  onCustomDateChange: (field: "from" | "to", val: string) => void;
  autoRefreshMs: number;
  onAutoRefreshChange: (ms: number) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  lastGeneratedAt: string | null;
  isConductorHealthy: boolean;
  isWeaverHealthy: boolean;
}

const PRESETS: Array<{ key: PresetRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7d" },
  { key: "30d", label: "Last 30d" },
  { key: "custom", label: "Custom" },
];

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  preset,
  onPresetChange,
  customDates,
  onCustomDateChange,
  autoRefreshMs,
  onAutoRefreshChange,
  onManualRefresh,
  isRefreshing,
  lastGeneratedAt,
  isConductorHealthy,
  isWeaverHealthy,
}) => {
  const isAllHealthy = isConductorHealthy && isWeaverHealthy;

  const formattedLastUpdated = lastGeneratedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(lastGeneratedAt))
    : "—";

  return (
    <header className={styles.headerWrapper}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>Command Center</h1>
          <div
            className={`${styles.clusterStatusPill} ${
              !isAllHealthy ? styles.clusterStatusPillDegraded : ""
            }`}
            title={`Weaver API: ${isWeaverHealthy ? "UP" : "DEGRADED"} | Conductor: ${
              isConductorHealthy ? "UP" : "DEGRADED"
            }`}
          >
            <span className={styles.pulseDot} />
            {isAllHealthy ? "Cluster Healthy" : "Degraded Services"}
          </div>
        </div>

        <div className={styles.actionsGroup}>
          <div className={styles.presetGroup} role="group" aria-label="Date range selection">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.presetBtn} ${preset === item.key ? styles.presetBtnActive : ""}`}
                onClick={() => onPresetChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            className={styles.selectControl}
            value={autoRefreshMs}
            onChange={(e) => onAutoRefreshChange(Number(e.target.value))}
            aria-label="Auto refresh frequency"
          >
            {REFRESH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={onManualRefresh}
            title="Refresh metrics now"
            aria-label="Refresh metrics"
            disabled={isRefreshing}
          >
            <RefreshCw size={15} className={isRefreshing ? styles.spinning : ""} />
          </button>

          <Link to="/designer" className={styles.primaryCta} id="btn-create-workflow-dashboard">
            <Plus size={15} strokeWidth={2.5} />
            <span>New Workflow</span>
          </Link>
        </div>
      </div>

      {preset === "custom" && (
        <div className={styles.customDateRow}>
          <div className={styles.dateInputGroup}>
            <label className={styles.dateLabel} htmlFor="custom-date-from">
              From:
            </label>
            <input
              id="custom-date-from"
              type="datetime-local"
              className={styles.dateInput}
              value={customDates.from}
              onChange={(e) => onCustomDateChange("from", e.target.value)}
            />
          </div>

          <div className={styles.dateInputGroup}>
            <label className={styles.dateLabel} htmlFor="custom-date-to">
              To:
            </label>
            <input
              id="custom-date-to"
              type="datetime-local"
              className={styles.dateInput}
              value={customDates.to}
              onChange={(e) => onCustomDateChange("to", e.target.value)}
            />
          </div>

          <span className={styles.metaInfo}>Last telemetry sync: {formattedLastUpdated}</span>
        </div>
      )}
    </header>
  );
};

export default DashboardHeader;
