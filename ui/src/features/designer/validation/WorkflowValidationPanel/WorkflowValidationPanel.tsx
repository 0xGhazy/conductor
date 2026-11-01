import React, { useState, useMemo, useCallback } from "react";
import {
  X,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Layers,
  Maximize2,
  Minimize2,
  Zap,
  Box,
  FileCode,
  Sliders,
} from "lucide-react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWorkflowValidation } from "@/features/designer/validation/useWorkflowValidation";
import type { WorkflowValidationIssue, ValidationSeverity } from "@/features/designer/validation/types";
import styles from "./WorkflowValidationPanel.module.css";

export const WorkflowValidationPanel: React.FC = () => {
  const validationPanelOpen = useDesignerStore((s) => s.validationPanelOpen);
  const setValidationPanelOpen = useDesignerStore((s) => s.setValidationPanelOpen);
  const nodes = useDesignerStore((s) => s.nodes);
  const setNodes = useDesignerStore((s) => s.setNodes);
  const setSelectedId = useDesignerStore((s) => s.setSelectedId);
  const setSelectedNodeIds = useDesignerStore((s) => s.setSelectedNodeIds);
  const setSelectedEdgeId = useDesignerStore((s) => s.setSelectedEdgeId);
  const setNodePanelCollapsed = useDesignerStore((s) => s.setNodePanelCollapsed);
  const setWorkflowConfigModalOpen = useDesignerStore((s) => s.setWorkflowConfigModalOpen);
  const setHighlightedField = useDesignerStore((s) => s.setHighlightedField);
  const flowInstance = useDesignerStore((s) => s.flowInstance);

  const { issues, summary } = useWorkflowValidation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | ValidationSeverity>("all");
  const [isGroupedByNode, setIsGroupedByNode] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleClose = useCallback(() => {
    setValidationPanelOpen(false);
  }, [setValidationPanelOpen]);

  // Filter issues by severity and search query
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Severity tab filter
      if (selectedFilter !== "all" && issue.severity !== selectedFilter) {
        return false;
      }
      // Search text filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesMessage = issue.message.toLowerCase().includes(query);
        const matchesCode = issue.code.toLowerCase().includes(query);
        const matchesField = issue.fieldPath?.toLowerCase().includes(query) ?? false;
        const matchesDesc = issue.description?.toLowerCase().includes(query) ?? false;
        const targetNode = issue.nodeId ? nodes.find((n) => n.id === issue.nodeId) : null;
        const matchesNodeName = targetNode?.data?.name?.toLowerCase().includes(query) ?? false;

        return matchesMessage || matchesCode || matchesField || matchesDesc || matchesNodeName;
      }
      return true;
    });
  }, [issues, selectedFilter, searchQuery, nodes]);

  // Group filtered issues by Node/Workflow
  const groupedIssues = useMemo(() => {
    const groups: {
      key: string;
      title: string;
      nodeId?: string;
      kind?: string;
      errorCount: number;
      warnCount: number;
      infoCount: number;
      issues: WorkflowValidationIssue[];
    }[] = [];

    const groupMap = new Map<string, typeof groups[0]>();

    filteredIssues.forEach((issue) => {
      const key = issue.nodeId ? `node-${issue.nodeId}` : issue.edgeId ? `edge-${issue.edgeId}` : "workflow";
      if (!groupMap.has(key)) {
        let title = "Workflow Settings";
        let kind = "workflow";
        if (issue.nodeId) {
          const targetNode = nodes.find((n) => n.id === issue.nodeId);
          const nodeName = targetNode?.data?.name;
          const nodeKind = targetNode?.type || (targetNode?.data as any)?.kind;
          kind = nodeKind || "node";
          title = nodeName ? `${nodeName} (${kind})` : `Node: ${issue.nodeId}`;
        } else if (issue.edgeId) {
          title = `Connection: ${issue.edgeId}`;
          kind = "edge";
        }

        const entry = {
          key,
          title,
          nodeId: issue.nodeId,
          kind,
          errorCount: 0,
          warnCount: 0,
          infoCount: 0,
          issues: [],
        };
        groupMap.set(key, entry);
        groups.push(entry);
      }

      const group = groupMap.get(key)!;
      group.issues.push(issue);
      if (issue.severity === "error") group.errorCount++;
      else if (issue.severity === "warning") group.warnCount++;
      else if (issue.severity === "info") group.infoCount++;
    });

    return groups;
  }, [filteredIssues, nodes]);

  // Interactive navigation to invalid node/edge/field
  const handleIssueClick = useCallback(
    (issue: WorkflowValidationIssue) => {
      if (issue.nodeId) {
        // 1. Locate and select node
        setSelectedId(issue.nodeId);
        setSelectedNodeIds([issue.nodeId]);
        setSelectedEdgeId(null);

        // 2. Center/focus canvas on the node
        if (flowInstance) {
          const targetNode = nodes.find((n) => n.id === issue.nodeId);
          if (targetNode?.position) {
            flowInstance.setCenter(
              targetNode.position.x + 120,
              targetNode.position.y + 60,
              { zoom: 1, duration: 350 }
            );
          } else if (typeof flowInstance.fitView === "function") {
            flowInstance.fitView({
              nodes: [{ id: issue.nodeId }],
              padding: 0.35,
              duration: 350,
            });
          }
        }

        // 3. Open configuration panel
        setNodePanelCollapsed(false);

        // 4. Highlight field
        if (issue.fieldPath) {
          setHighlightedField(issue.fieldPath);
          setTimeout(() => {
            const input = document.querySelector<HTMLElement>(
              `[name="${issue.fieldPath}"], [data-field="${issue.fieldPath}"], input[id*="${issue.fieldPath}"]`
            );
            input?.focus?.();
            input?.scrollIntoView?.({ behavior: "smooth", block: "center" });
          }, 200);
        }
      } else if (issue.edgeId) {
        // Edge connection issue
        setSelectedEdgeId(issue.edgeId);
        setSelectedId(null);
        setSelectedNodeIds([]);
      } else {
        // Workflow-level issue (e.g. missing workflow name)
        setWorkflowConfigModalOpen(true);
      }
    },
    [
      nodes,
      flowInstance,
      setSelectedId,
      setSelectedNodeIds,
      setSelectedEdgeId,
      setNodePanelCollapsed,
      setHighlightedField,
      setWorkflowConfigModalOpen,
    ]
  );

  // Quick-fix action handler
  const handleQuickFix = useCallback(
    (issue: WorkflowValidationIssue, e: React.MouseEvent) => {
      e.stopPropagation();

      if (
        (issue.code === "TASK_REF_NAME_REQUIRED" ||
          issue.code === "ERR_MISSING_REF_NAME" ||
          issue.code === "NODE_MISSING_REF_NAME") &&
        issue.nodeId
      ) {
        const targetNode = nodes.find((n) => n.id === issue.nodeId);
        const baseName = String(targetNode?.data?.name || "task")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        const uniqueRef = `${baseName || "task"}_${issue.nodeId.slice(-4)}`;

        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === issue.nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    config: {
                      ...(n.data?.config || {}),
                      referenceName: uniqueRef,
                      taskReferenceName: uniqueRef,
                    },
                  },
                }
              : n
          )
        );
      } else if (issue.code === "TASK_REF_NAME_DUPLICATE" && issue.nodeId) {
        const targetNode = nodes.find((n) => n.id === issue.nodeId);
        const currentRef =
          targetNode?.data?.config?.referenceName ||
          targetNode?.data?.config?.taskReferenceName ||
          "task";
        const uniqueRef = `${currentRef}_${Math.random().toString(36).substring(2, 6)}`;

        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === issue.nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    config: {
                      ...(n.data?.config || {}),
                      referenceName: uniqueRef,
                      taskReferenceName: uniqueRef,
                    },
                  },
                }
              : n
          )
        );
      } else if (issue.code === "WF_NAME_REQUIRED") {
        setWorkflowConfigModalOpen(true);
      } else {
        // Fallback: jump to field for fast user entry
        handleIssueClick(issue);
      }
    },
    [nodes, setNodes, setWorkflowConfigModalOpen, handleIssueClick]
  );

  const renderIssueCard = (issue: WorkflowValidationIssue) => {
    const isError = issue.severity === "error";
    const isWarn = issue.severity === "warning";

    const icon = isError ? (
      <AlertCircle size={15} className={styles.issueIconError} />
    ) : isWarn ? (
      <AlertTriangle size={15} className={styles.issueIconWarn} />
    ) : (
      <Info size={15} className={styles.issueIconInfo} />
    );

    const hasQuickFix =
      issue.code === "TASK_REF_NAME_REQUIRED" ||
      issue.code === "ERR_MISSING_REF_NAME" ||
      issue.code === "NODE_MISSING_REF_NAME" ||
      issue.code === "TASK_REF_NAME_DUPLICATE" ||
      issue.code === "WF_NAME_REQUIRED";

    const quickFixLabel =
      issue.code === "TASK_REF_NAME_REQUIRED" ||
      issue.code === "ERR_MISSING_REF_NAME" ||
      issue.code === "NODE_MISSING_REF_NAME"
        ? "Auto-Generate Reference Name"
        : issue.code === "TASK_REF_NAME_DUPLICATE"
        ? "Make Reference Name Unique"
        : issue.code === "WF_NAME_REQUIRED"
        ? "Set Workflow Name"
        : "Quick Fix";

    return (
      <div
        key={issue.id}
        className={`${styles.issueCard} ${
          isError ? styles.cardError : isWarn ? styles.cardWarning : styles.cardInfo
        }`}
        onClick={() => handleIssueClick(issue)}
        role="button"
        tabIndex={0}
        aria-label={`${issue.severity}: ${issue.message}`}
        data-testid={`issue-card-${issue.code}`}
      >
        <div className={styles.cardHeader}>
          <div className={styles.severityGroup}>
            {icon}
            <span className={styles.issueMessage}>{issue.message}</span>
          </div>

          <div className={styles.badgeRow}>
            <span className={styles.codeBadge}>{issue.code}</span>
            {issue.fieldPath && (
              <span className={styles.fieldBadge}>Field: {issue.fieldPath}</span>
            )}
          </div>
        </div>

        {issue.description && (
          <p className={styles.issueDescription}>{issue.description}</p>
        )}

        <div className={styles.cardFooter}>
          {hasQuickFix && (
            <button
              type="button"
              className={styles.quickFixBtn}
              onClick={(e) => handleQuickFix(issue, e)}
              title="Apply quick fix directly"
            >
              <Zap size={12} />
              <span>{quickFixLabel}</span>
            </button>
          )}

          <div className={styles.jumpHint}>
            <ExternalLink size={12} />
            <span>Locate on canvas & inspector</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`${styles.consolePanel} ${
        validationPanelOpen ? styles.open : styles.closed
      } ${isMaximized ? styles.maximized : ""}`}
      role="region"
      aria-label="Workflow Validation Panel"
      data-testid="workflow-validation-panel"
    >
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <ShieldAlert size={16} className={styles.panelTitleIcon} />
          <h2 className={styles.title}>Workflow Validation</h2>

          {/* Severity Counters & Filter Pills */}
          <div className={styles.filterPills} role="tablist">
            <button
              type="button"
              className={`${styles.pillBtn} ${selectedFilter === "all" ? styles.pillActive : ""}`}
              onClick={() => setSelectedFilter("all")}
            >
              All ({summary.total})
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${styles.pillError} ${
                selectedFilter === "error" ? styles.pillActiveError : ""
              }`}
              onClick={() => setSelectedFilter(selectedFilter === "error" ? "all" : "error")}
            >
              <span className={styles.dotError} />
              Errors ({summary.errors})
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${styles.pillWarn} ${
                selectedFilter === "warning" ? styles.pillActiveWarn : ""
              }`}
              onClick={() => setSelectedFilter(selectedFilter === "warning" ? "all" : "warning")}
            >
              <span className={styles.dotWarn} />
              Warnings ({summary.warnings})
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${styles.pillInfo} ${
                selectedFilter === "info" ? styles.pillActiveInfo : ""
              }`}
              onClick={() => setSelectedFilter(selectedFilter === "info" ? "all" : "info")}
            >
              <span className={styles.dotInfo} />
              Info ({summary.info})
            </button>
          </div>
        </div>

        {/* Center Search Input */}
        <div className={styles.searchSection}>
          <div className={styles.searchWrapper}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search issues, fields, codes, nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search validation issues"
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Right Tools: Grouping toggle, Height toggle, Close */}
        <div className={styles.toolActions}>
          <button
            type="button"
            className={`${styles.toolButton} ${isGroupedByNode ? styles.toolButtonActive : ""}`}
            onClick={() => setIsGroupedByNode(!isGroupedByNode)}
            title={isGroupedByNode ? "Switch to Flat List" : "Group issues by Node"}
            aria-label="Toggle node grouping"
          >
            <Layers size={13} />
            <span>Group by Node</span>
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restore height" : "Expand console height"}
            aria-label={isMaximized ? "Restore height" : "Expand console height"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={handleClose}
            aria-label="Close Validation Panel"
            title="Close console (Esc)"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 2. Main Content Feed */}
      <div className={styles.consoleBody} role="feed" aria-label="Validation issues list">
        {filteredIssues.length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircle2 size={32} className={styles.emptyStateIcon} />
            <div className={styles.emptyStateTitle}>
              {issues.length === 0 ? "No Validation Issues" : "No Matching Issues"}
            </div>
            <p className={styles.emptyStateText}>
              {issues.length === 0
                ? "Your workflow definition has passed all structural and configuration checks."
                : "Try clearing your search query or switching severity filters."}
            </p>
          </div>
        ) : isGroupedByNode ? (
          /* Clustered by Node Groups */
          <div className={styles.groupContainer}>
            {groupedIssues.map((group) => (
              <div key={group.key} className={styles.nodeGroup}>
                <div
                  className={styles.groupHeader}
                  onClick={() => {
                    if (group.nodeId) {
                      const targetNode = nodes.find((n) => n.id === group.nodeId);
                      if (targetNode?.position && flowInstance) {
                        flowInstance.setCenter(
                          targetNode.position.x + 120,
                          targetNode.position.y + 60,
                          { zoom: 1, duration: 350 }
                        );
                        setSelectedId(group.nodeId);
                        setSelectedNodeIds([group.nodeId]);
                        setNodePanelCollapsed(false);
                      }
                    }
                  }}
                  title={group.nodeId ? "Click to focus this node on canvas" : undefined}
                >
                  <div className={styles.groupInfo}>
                    {group.kind === "workflow" ? (
                      <Sliders size={14} className={styles.groupKindIcon} />
                    ) : group.kind === "edge" ? (
                      <FileCode size={14} className={styles.groupKindIcon} />
                    ) : (
                      <Box size={14} className={styles.groupKindIcon} />
                    )}
                    <span className={styles.groupTitle}>{group.title}</span>
                  </div>

                  <div className={styles.groupCounts}>
                    {group.errorCount > 0 && (
                      <span className={styles.countBadgeError}>
                        {group.errorCount} Error{group.errorCount > 1 ? "s" : ""}
                      </span>
                    )}
                    {group.warnCount > 0 && (
                      <span className={styles.countBadgeWarn}>
                        {group.warnCount} Warning{group.warnCount > 1 ? "s" : ""}
                      </span>
                    )}
                    {group.infoCount > 0 && (
                      <span className={styles.countBadgeInfo}>
                        {group.infoCount} Info
                      </span>
                    )}
                    {group.nodeId && (
                      <span className={styles.focusNodeLink}>
                        <ExternalLink size={11} />
                        Focus Node
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.groupCards}>
                  {group.issues.map((issue) => renderIssueCard(issue))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat Issue Cards Feed */
          <div className={styles.flatContainer}>
            {filteredIssues.map((issue) => renderIssueCard(issue))}
          </div>
        )}
      </div>
    </div>
  );
};
