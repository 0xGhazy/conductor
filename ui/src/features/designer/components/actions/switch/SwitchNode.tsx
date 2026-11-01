import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { SwitchNodeData } from "./model/switchDto";
import "./SwitchNode.css";

export interface SwitchNodeProps extends UniversalActionNodeProps {
  data?: SwitchNodeData;
}

export function SwitchActionNode(props: SwitchNodeProps) {
  return <UniversalActionNode {...props} type="SWITCH_ACTION" />;
}

export default SwitchActionNode;
