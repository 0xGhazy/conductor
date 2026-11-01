import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { RespondNodeData } from "./model/respondDto";
import "./RespondNode.css";

export interface RespondNodeProps extends UniversalActionNodeProps {
  data?: RespondNodeData;
}

export function RespondActionNode(props: RespondNodeProps) {
  return <UniversalActionNode {...props} type="RESPOND" />;
}

export default RespondActionNode;
