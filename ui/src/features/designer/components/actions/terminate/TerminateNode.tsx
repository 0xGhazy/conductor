import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { TerminateNodeData } from "./model/terminateDto";
import "./TerminateNode.css";

export interface TerminateNodeProps extends UniversalActionNodeProps {
  data?: TerminateNodeData;
}

export function TerminateActionNode(props: TerminateNodeProps) {
  return <UniversalActionNode {...props} type="TERMINATE" />;
}

export default TerminateActionNode;
