import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { RedisNodeData } from "./model/redisDto";
import "./RedisNode.css";

export interface RedisNodeProps extends UniversalActionNodeProps {
  data: RedisNodeData;
}

export function RedisNode(props: RedisNodeProps) {
  return <UniversalActionNode {...props} type="REDIS_ACTION" />;
}

export const RedisActionNode = RedisNode;
export default RedisNode;
