import React from "react";
import styles from "./DashboardSkeleton.module.css";

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className={styles.skeletonLayout} aria-label="Loading dashboard metrics" aria-busy="true">
      {/* Header Skeleton */}
      <div className={styles.headerCard}>
        <div className={styles.shimmerBox} style={{ width: 180, height: 28 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className={styles.shimmerBox} style={{ width: 220, height: 36 }} />
          <div className={styles.shimmerBox} style={{ width: 120, height: 36 }} />
        </div>
      </div>

      {/* KPI Ribbon Skeleton */}
      <div className={styles.ribbonGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.kpiCard}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className={styles.shimmerBox} style={{ width: 90, height: 16 }} />
              <div className={styles.shimmerBox} style={{ width: 28, height: 28, borderRadius: 6 }} />
            </div>
            <div className={styles.shimmerBox} style={{ width: 110, height: 32 }} />
            <div className={styles.shimmerBox} style={{ width: 140, height: 14 }} />
          </div>
        ))}
      </div>

      {/* Tier 2 Split */}
      <div className={styles.tierSplit2}>
        <div className={styles.panelCard}>
          <div className={styles.shimmerBox} style={{ width: 160, height: 20 }} />
          <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 20 }}>
            <div className={styles.shimmerBox} style={{ width: 140, height: 140, borderRadius: "50%" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className={styles.shimmerBox} style={{ height: 24, width: "100%" }} />
              <div className={styles.shimmerBox} style={{ height: 24, width: "100%" }} />
              <div className={styles.shimmerBox} style={{ height: 24, width: "100%" }} />
            </div>
          </div>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.shimmerBox} style={{ width: 160, height: 20 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
            <div className={styles.shimmerBox} style={{ height: 36, width: "100%" }} />
            <div className={styles.shimmerBox} style={{ height: 36, width: "100%" }} />
            <div className={styles.shimmerBox} style={{ height: 36, width: "100%" }} />
          </div>
        </div>
      </div>

      {/* Tier 3 Split */}
      <div className={styles.tierSplit3}>
        <div className={styles.panelCard}>
          <div className={styles.shimmerBox} style={{ width: 160, height: 20 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div className={styles.shimmerBox} style={{ height: 48, width: "100%" }} />
            <div className={styles.shimmerBox} style={{ height: 48, width: "100%" }} />
            <div className={styles.shimmerBox} style={{ height: 48, width: "100%" }} />
          </div>
        </div>

        <div className={styles.panelCard}>
          <div className={styles.shimmerBox} style={{ width: 160, height: 20 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div className={styles.shimmerBox} style={{ height: 40, width: "100%" }} />
            <div className={styles.shimmerBox} style={{ height: 40, width: "100%" }} />
            <div className={styles.shimmerBox} style={{ height: 40, width: "100%" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
