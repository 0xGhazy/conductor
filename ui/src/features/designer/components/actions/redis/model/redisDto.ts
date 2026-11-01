import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export interface RedisActionConfig extends BaseActionConfig {
  datasourceId?: string;
  datasourceName?: string;
  action: string;
  key?: string;
  value?: string;
  field?: string;
  ttlSeconds?: number;
  delta?: number;
}

export interface RedisNodeData extends WeaverActionNodeData<RedisActionConfig> {
  label?: string;
  type?: string;
}

export const DEFAULT_REDIS_ACTION_CONFIG: RedisActionConfig = {
  name: "redis_1",
  referenceName: "redis_1",
  reference: "redis_1",
  datasourceId: "",
  datasourceName: "",
  action: "GET",
  key: "",
  value: "",
  field: "",
  ttlSeconds: undefined,
  delta: undefined,
};

let redisCounter = 1;

export const generateRedisReferenceName = (): string => {
  const name = `redis_${redisCounter}`;
  redisCounter += 1;
  return name;
};

export const exportRedisActionData = (
  nodeData: RedisNodeData,
  id?: string,
  _position?: { x?: number; y?: number }
) => {
  const rawConfig = nodeData?.config ?? DEFAULT_REDIS_ACTION_CONFIG;
  const refName = rawConfig.name || rawConfig.referenceName || rawConfig.reference || "redis_1";

  return {
    name: "RedisWorker",
    taskReferenceName: refName,
    inputParameters: {
      action: rawConfig.action || "GET",
      key: rawConfig.key || "",
      value: rawConfig.value || "",
      field: rawConfig.field || "",
      datasourceId: rawConfig.datasourceId || "",
      datasourceName: rawConfig.datasourceName || "",
      ...(rawConfig.ttlSeconds !== undefined ? { ttlSeconds: rawConfig.ttlSeconds } : {}),
      ...(rawConfig.delta !== undefined ? { delta: rawConfig.delta } : {}),
    },
    type: "SIMPLE",
  };
};
