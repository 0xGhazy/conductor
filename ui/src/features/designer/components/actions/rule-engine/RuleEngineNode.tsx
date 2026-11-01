import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { RuleEngineNodeData } from "./model/ruleEngineDto";
import "./RuleEngineNode.css";

export interface RuleEngineNodeProps extends UniversalActionNodeProps {
  data: RuleEngineNodeData;
}

export function RuleEngineNode(props: RuleEngineNodeProps) {
  return <UniversalActionNode {...props} type="RULE_ENGINE_ACTION" />;
}

export const RuleEngineActionNode = RuleEngineNode;
export default RuleEngineNode;
