import React from "react";
import { SiRedis } from "react-icons/si";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import { RedisNodeConfig } from "./RedisNodeConfig";
import { exportRedisActionData } from "@/features/designer/components/actions/redis/model/redisDto";

export const RedisNodeDefinition: WeaverNodeDefinition = {
  type: "REDIS_ACTION",
  label: "Redis",
  description: "Execute Redis cache commands",
  icon: React.createElement(SiRedis, { size: 16, color: "#dc382d" }),
  defaultTab: "configuration",
  ConfigurationComponent: RedisNodeConfig,
  serializeForJson: (node) => {
    return exportRedisActionData(node.data, node.id, node.position);
  },
  tabs: [
    {
      id: "configuration",
      label: "Configuration",
      icon: React.createElement(TuneIcon, { fontSize: "small" }),
      render: "configuration",
    },
    {
      id: "json",
      label: "JSON",
      icon: React.createElement(DataObjectIcon, { fontSize: "small" }),
      render: "json",
    },
    {
      id: "result",
      label: "Result",
      icon: React.createElement(QueryStatsIcon, { fontSize: "small" }),
      render: "result",
    },
    {
      id: "logs",
      label: "Logs",
      icon: React.createElement(ReceiptLongIcon, { fontSize: "small" }),
      render: "logs",
    },
  ],
};
