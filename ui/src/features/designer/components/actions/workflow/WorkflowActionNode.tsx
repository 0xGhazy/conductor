import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";

export interface WorkflowActionNodeProps extends UniversalActionNodeProps {}

export function WorkflowActionNode(props: WorkflowActionNodeProps) {
  return <UniversalActionNode {...props} type="WORKFLOW" />;
}

export default WorkflowActionNode;
