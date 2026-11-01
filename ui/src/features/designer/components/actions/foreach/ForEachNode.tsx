import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { ForEachNodeData } from "./model/forEachDto";
import "./ForEachNode.css";

export interface ForEachNodeProps extends UniversalActionNodeProps {
  data?: ForEachNodeData;
}

export function ForEachActionNode(props: ForEachNodeProps) {
  return <UniversalActionNode {...props} type="FOREACH_ACTION" />;
}

export default ForEachActionNode;
