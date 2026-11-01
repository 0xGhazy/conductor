import React from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Link,
  Database,
  Code,
  CheckCircle2,
  GitFork,
  Clock,
  Repeat,
  Layers,
  Cpu,
  Workflow,
  OctagonX,
  Reply,
  Play,
  Flag,
} from "lucide-react";
import styles from "./WorkflowVersionDiffModal.module.css";
import type { DiffStatus, ParameterDiffItem } from "@/features/designer/utils/workflowDiffUtils";
import { isStartNodeId, isEndNodeId } from "@/features/designer/utils/designerGraphUtils";

export interface DiffNodeData {
  config?: any;
  name?: string;
  title?: string;
  taskReferenceName?: string;
  diffStatus?: DiffStatus;
  parameterDiffs?: ParameterDiffItem[];
  onSelectNode?: (nodeId: string, nodeData: DiffNodeData) => void;
  [key: string]: any;
}

export interface DiffNodeProps {
  id: string;
  type: string;
  data: DiffNodeData;
  selected?: boolean;
}

const getNodeIconAndColor = (type: string, id: string) => {
  if (isStartNodeId(id) || type === "start" || type === "START_NODE") {
    return { icon: Play, color: "var(--hue-green, #16A34A)", label: "Start" };
  }
  if (isEndNodeId(id) || id === "end" || type === "end" || type === "END_NODE" || type === "endFlag") {
    return { icon: Flag, color: "var(--color-fg-muted, #64748B)", label: "End" };
  }

  const normalized = String(type || "").toUpperCase();

  switch (normalized) {
    case "HTTP_ACTION":
    case "HTTP":
      return { icon: Link, color: "var(--hue-blue, #2563EB)", label: "HTTP" };
    case "DATABASE_ACTION":
    case "DATABASE":
      return { icon: Database, color: "var(--hue-teal, #0D9488)", label: "Database" };
    case "SCRIPT_ACTION":
    case "JEXL_ACTION":
    case "SCRIPT":
      return { icon: Code, color: "var(--hue-violet, #7C3AED)", label: "Script" };
    case "VALIDATION_ACTION":
    case "VALIDATION":
      return { icon: CheckCircle2, color: "var(--hue-green, #16A34A)", label: "Validation" };
    case "SWITCH_ACTION":
    case "SWITCH":
      return { icon: GitFork, color: "var(--hue-cyan, #0891B2)", label: "Switch" };
    case "WAIT_ACTION":
    case "DELAY_ACTION":
    case "WAIT":
      return { icon: Clock, color: "var(--hue-amber, #D97706)", label: "Wait" };
    case "FOREACH_ACTION":
    case "FOREACH":
      return { icon: Repeat, color: "var(--hue-lime, #65A30D)", label: "ForEach" };
    case "REDIS_ACTION":
    case "REDIS":
      return { icon: Layers, color: "var(--hue-orange, #EA580C)", label: "Redis" };
    case "RULE_ENGINE_ACTION":
    case "RULE_ENGINE":
      return { icon: Cpu, color: "var(--hue-fuchsia, #C026D3)", label: "Rule Engine" };
    case "SUBWORKFLOW_ACTION":
    case "WORKFLOW":
    case "SUBWORKFLOW":
      return { icon: Workflow, color: "var(--hue-indigo, #4F46E5)", label: "Subworkflow" };
    case "TERMINATE":
      return { icon: OctagonX, color: "var(--hue-red, #DC2626)", label: "Terminate" };
    case "RESPOND":
    case "RESPOND_ACTION":
      return { icon: Reply, color: "var(--hue-pink, #DB2777)", label: "Respond" };
    default:
      return { icon: Workflow, color: "var(--hue-indigo, #4F46E5)", label: type || "Task" };
  }
};

export const DiffNode: React.FC<DiffNodeProps> = ({ id, type, data, selected }) => {
  const diffStatus = data?.diffStatus || "unchanged";
  const parameterDiffs = data?.parameterDiffs || [];
  const { icon: Icon, color, label } = getNodeIconAndColor(type, id);

  const title =
    data?.config?.nodeName ||
    data?.name ||
    data?.title ||
    label;

  const refName =
    data?.config?.taskReferenceName ||
    data?.taskReferenceName ||
    (isStartNodeId(id) ? "start" : isEndNodeId(id) ? "end" : id);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    data?.onSelectNode?.(id, data);
  };

  const isStart = isStartNodeId(id);
  const isEnd = isEndNodeId(id) || id === "end";

  let statusClass = styles.nodeUnchanged;
  if (diffStatus === "added") statusClass = styles.nodeAdded;
  if (diffStatus === "removed") statusClass = styles.nodeRemoved;
  if (diffStatus === "modified") statusClass = styles.nodeModified;

  return (
    <div
      className={`${styles.diffNodeCard} ${statusClass} ${selected ? styles.nodeSelected : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      title={`Click to inspect parameters: ${refName}`}
    >
      {/* Target Handle (Input) */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          className={styles.diffHandle}
          isConnectable={false}
        />
      )}

      {/* Diff Status Pill Badge */}
      {diffStatus !== "unchanged" && (
        <div
          className={`${styles.diffNodeBadge} ${
            diffStatus === "added"
              ? styles.badgeAdded
              : diffStatus === "removed"
              ? styles.badgeRemoved
              : styles.badgeModified
          }`}
        >
          {diffStatus === "added" && "+ Added"}
          {diffStatus === "removed" && "- Removed"}
          {diffStatus === "modified" &&
            `● Modified (${parameterDiffs.length})`}
        </div>
      )}

      {/* Node Content */}
      <div className={styles.diffNodeHeader}>
        <div
          className={styles.diffNodeIconBadge}
          style={{ backgroundColor: color }}
        >
          <Icon size={14} color="#ffffff" />
        </div>
        <div className={styles.diffNodeTextGroup}>
          <div className={styles.diffNodeTitle} title={title}>
            {title}
          </div>
          <div className={styles.diffNodeRef} title={refName}>
            {refName}
          </div>
        </div>
      </div>

      {/* Source Handle (Output) */}
      {!isEnd && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className={styles.diffHandle}
          isConnectable={false}
        />
      )}
    </div>
  );
};
