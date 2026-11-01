import type { Node } from "@xyflow/react";
import type { WeaverNodeDefinition } from "./nodeDefinition.types";
import { StartNodeDefinition } from "./definitions/start";
import { HttpNodeDefinition } from "./definitions/http";
import { DatabaseNodeDefinition } from "./definitions/database";
import { ScriptNodeDefinition } from "./definitions/script";
import { SwitchNodeDefinition } from "./definitions/switch";
import {
  TerminateNodeDefinition,
  RespondNodeDefinition,
  WaitNodeDefinition,
  ValidationNodeDefinition,
  RuleEngineNodeDefinition,
  ForEachNodeDefinition,
} from "./definitions/other";
import { RedisNodeDefinition } from "./definitions/redis";
import { WorkflowNodeDefinition } from "./definitions/workflow";
import { isStartNode } from "@/features/designer/utils/designerGraphUtils";

/**
 * Canonical node definition registry mapping node types to their definitions.
 */
export const nodeDefinitionRegistry: Record<string, WeaverNodeDefinition> = {
  START: StartNodeDefinition,
  startFlag: StartNodeDefinition,
  HTTP_ACTION: HttpNodeDefinition,
  httpAction: HttpNodeDefinition,
  HTTPACTION: HttpNodeDefinition,
  DATABASE_ACTION: DatabaseNodeDefinition,
  databaseAction: DatabaseNodeDefinition,
  SCRIPT_ACTION: ScriptNodeDefinition,
  scriptAction: ScriptNodeDefinition,
  JEXL_ACTION: ScriptNodeDefinition,
  SWITCH_ACTION: SwitchNodeDefinition,
  switchAction: SwitchNodeDefinition,
  TERMINATE: TerminateNodeDefinition,
  terminateAction: TerminateNodeDefinition,
  RESPOND_ACTION: RespondNodeDefinition,
  respondAction: RespondNodeDefinition,
  RESPOND: RespondNodeDefinition,
  WAIT_ACTION: WaitNodeDefinition,
  waitAction: WaitNodeDefinition,
  DELAY_ACTION: WaitNodeDefinition,
  REDIS_ACTION: RedisNodeDefinition,
  redisAction: RedisNodeDefinition,
  VALIDATION_ACTION: ValidationNodeDefinition,
  RULE_ENGINE_ACTION: RuleEngineNodeDefinition,
  FOREACH_ACTION: ForEachNodeDefinition,
  FOREACH: ForEachNodeDefinition,
  WORKFLOW: WorkflowNodeDefinition,
  workflow: WorkflowNodeDefinition,
  SUB_WORKFLOW: WorkflowNodeDefinition,
  sub_workflow: WorkflowNodeDefinition,
  subworkflow: WorkflowNodeDefinition,
  SUBWORKFLOW_ACTION: WorkflowNodeDefinition,
  subworkflowAction: WorkflowNodeDefinition,
};

/**
 * Register a new node definition dynamically.
 * Enables zero-touch scaling when adding future node types.
 */
export function registerNodeDefinition(definition: WeaverNodeDefinition): void {
  if (!definition?.type) return;
  nodeDefinitionRegistry[definition.type] = definition;
}

/**
 * Resolve node definition from a node object or raw type string.
 */
export function getNodeDefinition(
  nodeOrType: Node | string | null | undefined
): WeaverNodeDefinition | undefined {
  if (!nodeOrType) return undefined;

  if (typeof nodeOrType === "object") {
    if (isStartNode(nodeOrType)) {
      return StartNodeDefinition;
    }
    const type = nodeOrType.type || nodeOrType.data?.kind;
    if (type && nodeDefinitionRegistry[type]) {
      return nodeDefinitionRegistry[type];
    }
    // Check uppercase normalized
    const normalized = String(type || "").toUpperCase();
    if (nodeDefinitionRegistry[normalized]) {
      return nodeDefinitionRegistry[normalized];
    }
  }

  if (typeof nodeOrType === "string") {
    if (nodeDefinitionRegistry[nodeOrType]) {
      return nodeDefinitionRegistry[nodeOrType];
    }
    const normalized = nodeOrType.toUpperCase();
    if (nodeDefinitionRegistry[normalized]) {
      return nodeDefinitionRegistry[normalized];
    }
    if (nodeOrType === "start" || nodeOrType === "00000000-0000-0000-0000-000000000000") {
      return StartNodeDefinition;
    }
  }

  return undefined;
}
