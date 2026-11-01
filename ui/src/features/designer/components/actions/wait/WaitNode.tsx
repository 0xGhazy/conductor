import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { WaitNodeData } from "./model/waitDto";
import "./WaitNode.css";

export interface WaitNodeProps extends UniversalActionNodeProps {
  data?: WaitNodeData;
}

export function WaitActionNode(props: WaitNodeProps) {
  return <UniversalActionNode {...props} type="WAIT_ACTION" />;
}

export default WaitActionNode;
