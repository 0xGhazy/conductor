import React, { type ReactNode, type CSSProperties } from "react";
import {
  Link as LinkIcon,
  Workflow,
  Sliders,
  Power,
  Timer,
  ShieldCheck,
  Repeat,
  Plus,
  Code2,
  Database as DatabaseIcon,
} from "lucide-react";
import MessageSquareQuote from "lucide-react/dist/esm/icons/message-square-quote";
import { TiFlowSwitch } from "react-icons/ti";
import { SiRedis } from "react-icons/si";
import Tooltip from "@mui/material/Tooltip";
import { Handle, Position } from "@xyflow/react";
import { TASK_NODE_COLORS } from "@/features/designer/nodes/WeaverTaskNode/taskNodeColors";
import { formatUntil, normalizeDuration, normalizeWaitMode } from "./wait/model/waitDto";
import { buildSwitchCaseHandles, normalizeCases } from "./switch/model/switchDto";

/**
 * Lightweight, display-only action node metadata (icon, color, label, title/subtitle renderers,
 * handles). Kept free of config forms / custom node components so read-only consumers such as
 * the execution diagram do not pull the whole designer editing UI into their bundle.
 * The full registry (forms, draft/validation behaviour) lives in `actionNodeRegistry.tsx`.
 */

export interface ActionNodeCustomHandlesContext {
  id: string;
  data: any;
  isLR: boolean;
  hoveredHandleId?: string | null;
  setHoveredHandleId?: (id: string | null) => void;
  pendingConnectionSource?: string | null;
  setPendingConnectionSource?: (src: string | null) => void;
  setActionsPanelOpen?: (open: boolean) => void;
}

export interface ActionNodeDisplayMeta {
  type: string;
  label: string;
  icon: any;
  color: string;
  description?: string;
  isTerminal?: boolean;
  targetHandleId?: string;
  sourceHandleId?: string;
  targetHandlePosition?: Position;
  hideSourceHandle?: boolean;
  className?: string | ((data: any) => string);
  style?: CSSProperties | ((context: { data: any; isLR: boolean }) => CSSProperties);
  renderTitle?: (data: any) => ReactNode;
  renderSubtitle?: (data: any) => ReactNode;
  renderCustomHandles?: (context: ActionNodeCustomHandlesContext) => ReactNode;
  renderChildren?: (data: any) => ReactNode;
}

// Helper for Terminate card class
const getTerminateStatusClass = (status: string): string => {
  if (status === "COMPLETED") return "terminate-node-card--completed";
  if (status === "FAILED") return "terminate-node-card--failed";
  return "terminate-node-card--terminated";
};

// Helper for Wait node title
const renderWaitNodeTitle = (cfg: any = {}): ReactNode => {
  if (normalizeWaitMode(cfg.mode) === "UNTIL") {
    return (
      <>
        Wait until <span className="wait-node-title-value">{formatUntil(cfg) || "until"}</span>
      </>
    );
  }
  return (
    <>
      Wait for <span className="wait-node-title-value">{normalizeDuration(cfg.duration)}</span>
    </>
  );
};

// Helper for ForEach node title
const renderForEachNodeTitle = (nodeData?: any): ReactNode => {
  const cfg = nodeData?.config ?? {};
  const itemVar = String(cfg.itemVariable || "item").trim();
  const rawCollection = String(cfg.collectionExpression || cfg.collection || "").trim();

  if (rawCollection) {
    const shortExpr =
      rawCollection.length > 20 ? `${rawCollection.slice(0, 18)}...` : rawCollection;
    return (
      <>
        ForEach <span className="foreach-node-title-value">{itemVar}</span> in{" "}
        <span className="foreach-node-title-value">{shortExpr}</span>
      </>
    );
  }

  return (
    <>
      ForEach <span className="foreach-node-title-value">{nodeData?.name || "Loop"}</span>
    </>
  );
};

export const ACTION_NODE_DISPLAY_REGISTRY: Record<string, ActionNodeDisplayMeta> = {
  DATABASE_ACTION: {
    type: "DATABASE_ACTION",
    label: "Database",
    icon: DatabaseIcon,
    color: TASK_NODE_COLORS.database,
  },
  SCRIPT_ACTION: {
    type: "SCRIPT_ACTION",
    label: "Script",
    icon: Code2,
    color: TASK_NODE_COLORS.script,
  },
  HTTP_ACTION: {
    type: "HTTP_ACTION",
    label: "HTTP",
    icon: LinkIcon,
    color: TASK_NODE_COLORS.http,
    renderSubtitle: (data) => {
      const method = String(data?.config?.method || "GET").toUpperCase();
      const url = String(data?.config?.url || "").trim();
      return url ? `${method} ${url}` : method;
    },
  },
  WORKFLOW: {
    type: "WORKFLOW",
    label: "Workflow",
    icon: Workflow,
    color: TASK_NODE_COLORS.subworkflow,
    renderTitle: (data) =>
      data?.config?.nodeName ||
      data?.config?.workflowName ||
      data?.config?.subWorkflowParam?.name ||
      data?.name ||
      "Workflow",
    renderSubtitle: (data) => {
      const nodeName = data?.config?.nodeName;
      const wfName = data?.config?.workflowName || data?.config?.subWorkflowParam?.name;
      return nodeName ? wfName || undefined : wfName ? "Workflow" : undefined;
    },
  },
  RULE_ENGINE_ACTION: {
    type: "RULE_ENGINE_ACTION",
    label: "Rule Engine",
    icon: Sliders,
    color: TASK_NODE_COLORS.ruleEngine,
    sourceHandleId: "ruleEngineResult",
    className: "rule-engine-node-card",
  },
  TERMINATE: {
    type: "TERMINATE",
    label: "Terminate",
    icon: Power,
    color: TASK_NODE_COLORS.terminate,
    isTerminal: true,
    hideSourceHandle: true,
    targetHandleId: "terminate-input",
    className: (data) => {
      const status = String(data?.config?.status || "COMPLETED").toUpperCase();
      return `terminate-node-card ${getTerminateStatusClass(status)}`;
    },
  },
  WAIT_ACTION: {
    type: "WAIT_ACTION",
    label: "Wait",
    icon: Timer,
    color: TASK_NODE_COLORS.wait,
    sourceHandleId: "waitResult",
    className: "wait-node-card",
    renderTitle: (data) => renderWaitNodeTitle(data?.config),
  },
  RESPOND: {
    type: "RESPOND",
    label: "Respond",
    icon: MessageSquareQuote,
    color: TASK_NODE_COLORS.respond,
    isTerminal: true,
    hideSourceHandle: true,
    targetHandleId: "respond-input",
    className: "respond-node-card respond-node-card--terminal",
  },
  VALIDATION_ACTION: {
    type: "VALIDATION_ACTION",
    label: "Validation",
    icon: ShieldCheck,
    color: TASK_NODE_COLORS.validation,
    sourceHandleId: "validationResult",
    className: "validation-node-card",
  },
  FOREACH_ACTION: {
    type: "FOREACH_ACTION",
    label: "ForEach",
    icon: Repeat,
    color: TASK_NODE_COLORS.forEach,
    hideSourceHandle: true,
    className: "foreach-node-card",
    renderTitle: (data) => renderForEachNodeTitle(data),
    renderChildren: (data) => {
      const cfg = data?.config ?? {};
      return (
        <div className="foreach-node-badges">
          <span className="foreach-badge">{cfg.itemVariable || "item"}</span>
          <span className="foreach-badge foreach-badge--mode">
            {cfg.executionMode || "PARALLEL"}
          </span>
          {cfg.errorStrategy === "COLLECT_ERRORS" ? (
            <span className="foreach-badge">COLLECT</span>
          ) : null}
        </div>
      );
    },
    renderCustomHandles: ({
      id,
      isLR,
      pendingConnectionSource,
      setPendingConnectionSource,
      setActionsPanelOpen,
    }) => {
      const loopPending = pendingConnectionSource === `${id}::loopBody`;
      const nextPending = pendingConnectionSource === `${id}::next`;

      const onBranchClick = (e: React.MouseEvent, branchId: string) => {
        e.stopPropagation();
        e.preventDefault();
        const pendingKey = `${id}::${branchId}`;
        if (pendingConnectionSource === pendingKey) {
          setPendingConnectionSource?.(null);
        } else {
          setPendingConnectionSource?.(pendingKey);
          setActionsPanelOpen?.(true);
        }
      };

      return (
        <>
          <Tooltip
            title={loopPending ? "Click to cancel connection" : "Add node to Loop Body"}
            arrow
            placement={isLR ? "right" : "bottom"}
          >
            <Handle
              type="source"
              position={isLR ? Position.Right : Position.Bottom}
              id="loopBody"
              className={`foreach-handle-plus foreach-handle-plus--loop ${
                loopPending ? "foreach-handle-plus--active" : ""
              }`}
              style={{
                [isLR ? "top" : "left"]: "35%",
                [isLR ? "right" : "bottom"]: -8,
              }}
              onClick={(e) => onBranchClick(e, "loopBody")}
              aria-label="Add node to Loop Body"
            >
              <Plus size={10} strokeWidth={2.8} style={{ pointerEvents: "none" }} />
            </Handle>
          </Tooltip>

          <Tooltip
            title={nextPending ? "Click to cancel connection" : "Add next node after Loop"}
            arrow
            placement={isLR ? "right" : "bottom"}
          >
            <Handle
              type="source"
              position={isLR ? Position.Right : Position.Bottom}
              id="next"
              className={`foreach-handle-plus foreach-handle-plus--next ${
                nextPending ? "foreach-handle-plus--active" : ""
              }`}
              style={{
                [isLR ? "top" : "left"]: "65%",
                [isLR ? "right" : "bottom"]: -8,
              }}
              onClick={(e) => onBranchClick(e, "next")}
              aria-label="Add next node after Loop"
            >
              <Plus size={10} strokeWidth={2.8} style={{ pointerEvents: "none" }} />
            </Handle>
          </Tooltip>
        </>
      );
    },
  },
  SWITCH_ACTION: {
    type: "SWITCH_ACTION",
    label: "Switch",
    icon: TiFlowSwitch,
    color: TASK_NODE_COLORS.switch,
    className: "switch-node-card",
    renderSubtitle: (data) => {
      const cfg = data?.config;
      return cfg?.evaluatorType === "javascript"
        ? cfg.expression || "(no expression)"
        : cfg?.inputParameters?.switchCaseValue || "(no input)";
    },
    style: ({ data, isLR }) => {
      const cases = normalizeCases(data?.config);
      const count = cases.length + 1;
      return {
        minWidth: `${isLR ? 240 : Math.max(180, count * 86)}px`,
        minHeight: isLR ? `${Math.max(90, count * 38)}px` : undefined,
      };
    },
    renderCustomHandles: ({
      id,
      data,
      isLR,
      hoveredHandleId,
      setHoveredHandleId,
      pendingConnectionSource,
      setPendingConnectionSource,
      setActionsPanelOpen,
    }) => {
      const cases = normalizeCases(data?.config);
      const caseHandles = buildSwitchCaseHandles(id, cases);

      const onCaseClick = (e: React.MouseEvent, handleId: string) => {
        e.stopPropagation();
        e.preventDefault();
        const pendingKey = `${id}::${handleId}`;
        if (pendingConnectionSource === pendingKey) {
          setPendingConnectionSource?.(null);
        } else {
          setPendingConnectionSource?.(pendingKey);
          setActionsPanelOpen?.(true);
        }
      };

      return (
        <div className={isLR ? "relative" : "relative pb-4"}>
          {caseHandles.map((handle) => {
            const isThisCasePending = pendingConnectionSource === `${id}::${handle.id}`;
            return (
              <div
                key={handle.key || handle.id}
                onMouseEnter={() => setHoveredHandleId?.(handle.id)}
                onMouseLeave={() => setHoveredHandleId?.(null)}
              >
                <Tooltip
                  title={
                    isThisCasePending
                      ? "Click to cancel node connection"
                      : `Add next node to ${handle.label}`
                  }
                  arrow
                  placement={isLR ? "right" : "bottom"}
                >
                  <Handle
                    type="source"
                    position={isLR ? Position.Right : Position.Bottom}
                    id={handle.id}
                    className={`switch-case-handle-plus ${
                      isThisCasePending ? "switch-case-handle-plus-active" : ""
                    }`}
                    onClick={(e) => onCaseClick(e, handle.id)}
                    aria-label={`Add next node to ${handle.label}`}
                    style={{
                      position: "absolute",
                      zIndex: 5,
                      bottom: isLR ? "auto" : -8,
                      top: isLR ? `${handle.leftPercent}%` : "auto",
                      left: isLR ? "auto" : `${handle.leftPercent}%`,
                      right: isLR ? -8 : "auto",
                      transform: isLR ? "translateY(-50%)" : "translateX(-50%)",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: handle.color,
                      border: "2px solid #fff",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      pointerEvents: "auto",
                      boxShadow: `0 2px 6px ${handle.color}55`,
                    }}
                  >
                    <Plus size={10} strokeWidth={2.8} style={{ pointerEvents: "none" }} />
                  </Handle>
                </Tooltip>
                {hoveredHandleId === handle.id ? (
                  <div
                    className="switch-case-handle-label"
                    style={{
                      position: "absolute",
                      bottom: isLR ? "auto" : undefined,
                      top: isLR ? `${handle.leftPercent}%` : undefined,
                      left: isLR ? "auto" : `${handle.leftPercent}%`,
                      right: isLR ? -12 : undefined,
                      transform: isLR ? "translate(100%, -50%)" : undefined,
                      color: handle.color,
                      zIndex: 20,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {handle.label}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    },
  },
  REDIS_ACTION: {
    type: "REDIS_ACTION",
    label: "Redis",
    icon: SiRedis,
    color: TASK_NODE_COLORS.redis,
    className: "redis-node-card",
    targetHandleId: "target",
    sourceHandleId: "source",
    renderSubtitle: (data) => {
      const a = data?.config?.action || "GET";
      const k = data?.config?.key || "";
      return `${a}${k ? `: ${k}` : ""}`;
    },
  },
};

// Aliases mapping canonical types
export const ACTION_TYPE_ALIASES: Record<string, string> = {
  httpAction: "HTTP_ACTION",
  HTTPACTION: "HTTP_ACTION",
  databaseAction: "DATABASE_ACTION",
  scriptAction: "SCRIPT_ACTION",
  JEXL_ACTION: "SCRIPT_ACTION",
  switchAction: "SWITCH_ACTION",
  terminateAction: "TERMINATE",
  RESPOND_ACTION: "RESPOND",
  respondAction: "RESPOND",
  waitAction: "WAIT_ACTION",
  DELAY_ACTION: "WAIT_ACTION",
  redisAction: "REDIS_ACTION",
  FOREACH: "FOREACH_ACTION",
  subworkflow: "WORKFLOW",
  sub_workflow: "WORKFLOW",
  SUB_WORKFLOW: "WORKFLOW",
  SUBWORKFLOW_ACTION: "WORKFLOW",
  subworkflowAction: "WORKFLOW",
  workflow: "WORKFLOW",
};

export const resolveActionNodeType = (type?: string, data?: any): string => {
  const rawType = String(type || data?.kind || data?.name || "ACTION").trim();
  return ACTION_TYPE_ALIASES[rawType] || rawType;
};

/**
 * Resolves display-only metadata for any given type (generic fallback for unknown types).
 */
export function getActionNodeDisplayMeta(type?: string, data?: any): ActionNodeDisplayMeta {
  const canonicalType = resolveActionNodeType(type, data);
  return (
    ACTION_NODE_DISPLAY_REGISTRY[canonicalType] ?? {
      type: canonicalType,
      label: data?.name || "Action",
      icon: Code2,
      color: "#64748b",
    }
  );
}
