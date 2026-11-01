import React from "react";
import { Link } from "react-router-dom";
import { ListFilter, GitFork } from "lucide-react";
import styles from "./TopWorkflowsCard.module.css";
import type { TopWorkflowInfo } from "../../types";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface TopWorkflowsCardProps {
  workflows: TopWorkflowInfo[];
  dateFilterParams: { from: string | null; to: string | null };
}

export const TopWorkflowsCard: React.FC<TopWorkflowsCardProps> = ({
  workflows,
  dateFilterParams,
}) => {
  const maxExecutions = React.useMemo(() => {
    return Math.max(1, ...workflows.map((w) => w.executionCount || 0));
  }, [workflows]);

  const filterQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    if (dateFilterParams.from) params.set("from", dateFilterParams.from);
    if (dateFilterParams.to) params.set("to", dateFilterParams.to);
    return params.toString();
  }, [dateFilterParams]);

  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Top Executed Workflows</h2>
          <div className={styles.subtitle}>Workflows ranked by total execution throughput</div>
        </div>
      </div>

      {workflows.length > 0 ? (
        <div className={styles.workflowList} role="list">
          {workflows.map((workflow, index) => {
            const count = workflow.executionCount || 0;
            const pct = Math.min(100, Math.max(3, (count / maxExecutions) * 100));
            const rate = workflow.successRate || 0;

            const rateClass =
              rate >= 95
                ? styles.rateSuccess
                : rate >= 85
                ? styles.rateWarn
                : styles.rateDanger;

            const executionsUrl = `/executions?workflowName=${encodeURIComponent(
              workflow.workflowName
            )}${filterQuery ? `&${filterQuery}` : ""}`;
            const designerUrl = `/designer/${encodeURIComponent(workflow.workflowName)}`;

            return (
              <div key={workflow.workflowName} className={styles.workflowRow}>
                <div className={styles.rowTop}>
                  <span className={styles.rankBadge}>#{index + 1}</span>
                  <span className={styles.workflowName} title={workflow.workflowName}>
                    {workflow.workflowName}
                  </span>
                  <span className={styles.spacer} />
                  <span className={`${styles.ratePill} ${rateClass}`}>
                    {percentFormatter.format(rate)}%
                  </span>
                  <div className={styles.actionLinks}>
                    <Link
                      to={executionsUrl}
                      className={styles.actionIconBtn}
                      title="Inspect Executions"
                      aria-label={`View executions for ${workflow.workflowName}`}
                    >
                      <ListFilter size={13} />
                    </Link>
                    <Link
                      to={designerUrl}
                      className={styles.actionIconBtn}
                      title="Open in Designer"
                      aria-label={`Open ${workflow.workflowName} in designer`}
                    >
                      <GitFork size={13} />
                    </Link>
                  </div>
                </div>

                <div className={styles.rowBottom}>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className={styles.statsText}>
                    {numberFormatter.format(count)} runs ({numberFormatter.format(workflow.failedCount)} failed)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          No workflow runs recorded in this window. Launch a workflow to see throughput.
        </div>
      )}
    </div>
  );
};

export default TopWorkflowsCard;
