import { createElement, memo, type ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import { UniversalActionNode } from "@/features/designer/components/actions/UniversalActionNode";
import { StartNode } from "@/features/designer/components/actions/start";
import { EndNode } from "@/features/designer/components/actions/end";
import { ScopeNode } from "@/features/designer/components/actions/ScopeNode";
import { WeaverBranchEdge } from "@/features/designer/components/edges/WeaverBranchEdge";
import { SCOPE_NODE_TYPE } from "@/features/designer/services/scopeGraph";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";

/*
 * React Flow node/edge type maps. They are module-level constants on purpose: a new `nodeTypes`
 * object makes React Flow remount every node. Anything dynamic (workflow name/version, scoped
 * parameter suggestions, callbacks) is read by the nodes themselves from the designer store.
 */

const openStartConfiguration = () => {
  const { clearSelection, setNodePanelCollapsed } = useDesignerStore.getState();
  clearSelection();
  setNodePanelCollapsed?.(false);
};

const StartNodeType = memo(function StartNodeType(props: NodeProps) {
  return createElement(StartNode, { ...props, onStartDoubleClick: openStartConfiguration });
});

const ScopeNodeType = memo(function ScopeNodeType(props: NodeProps) {
  const toggleScope = useDesignerStore((state) => state.toggleScope);
  const focusScope = useDesignerStore((state) => state.focusScope);
  return createElement(ScopeNode, { ...props, onToggleScope: toggleScope, onFocusScope: focusScope });
});

type DesignerNodeComponent = ComponentType<NodeProps>;

const actionNodeTypeCache = new Map<string, DesignerNodeComponent>();

/** One stable, memoized renderer per canonical action type. */
const actionNodeType = (nodeType: string): DesignerNodeComponent => {
  const cached = actionNodeTypeCache.get(nodeType);
  if (cached) return cached;
  const Renderer = memo(function ActionNodeType(props: NodeProps) {
    return createElement(UniversalActionNode, { ...props, type: nodeType });
  });
  Renderer.displayName = `ActionNodeType(${nodeType})`;
  actionNodeTypeCache.set(nodeType, Renderer);
  return Renderer;
};

export const DESIGNER_NODE_TYPES: Record<string, DesignerNodeComponent> = {
  startFlag: StartNodeType,
  endFlag: EndNode as DesignerNodeComponent,
  END: EndNode as DesignerNodeComponent,
  [SCOPE_NODE_TYPE]: ScopeNodeType,
  DATABASE_ACTION: actionNodeType("DATABASE_ACTION"),
  databaseAction: actionNodeType("DATABASE_ACTION"),
  JEXL_ACTION: actionNodeType("SCRIPT_ACTION"),
  SCRIPT_ACTION: actionNodeType("SCRIPT_ACTION"),
  scriptAction: actionNodeType("SCRIPT_ACTION"),
  HTTP_ACTION: actionNodeType("HTTP_ACTION"),
  httpAction: actionNodeType("HTTP_ACTION"),
  VALIDATION_ACTION: actionNodeType("VALIDATION_ACTION"),
  validationAction: actionNodeType("VALIDATION_ACTION"),
  TERMINATE: actionNodeType("TERMINATE"),
  terminateAction: actionNodeType("TERMINATE"),
  RESPOND: actionNodeType("RESPOND"),
  RESPOND_ACTION: actionNodeType("RESPOND"),
  respondAction: actionNodeType("RESPOND"),
  SWITCH_ACTION: actionNodeType("SWITCH_ACTION"),
  switchAction: actionNodeType("SWITCH_ACTION"),
  WAIT_ACTION: actionNodeType("WAIT_ACTION"),
  waitAction: actionNodeType("WAIT_ACTION"),
  DELAY_ACTION: actionNodeType("WAIT_ACTION"),
  FOREACH_ACTION: actionNodeType("FOREACH_ACTION"),
  FOREACH: actionNodeType("FOREACH_ACTION"),
  REDIS_ACTION: actionNodeType("REDIS_ACTION"),
  redisAction: actionNodeType("REDIS_ACTION"),
  RULE_ENGINE_ACTION: actionNodeType("RULE_ENGINE_ACTION"),
  ruleEngineAction: actionNodeType("RULE_ENGINE_ACTION"),
  SUBWORKFLOW_ACTION: actionNodeType("WORKFLOW"),
  subworkflow: actionNodeType("WORKFLOW"),
  WORKFLOW: actionNodeType("WORKFLOW"),
};

export const DESIGNER_EDGE_TYPES = {
  weaverBranchEdge: WeaverBranchEdge,
  step: WeaverBranchEdge,
  smoothstep: WeaverBranchEdge,
  default: WeaverBranchEdge,
};
