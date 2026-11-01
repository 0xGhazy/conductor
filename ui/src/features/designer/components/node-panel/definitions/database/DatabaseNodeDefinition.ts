import React from "react";
import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import { DatabaseNodeConfig } from "./DatabaseNodeConfig";

export const DatabaseNodeDefinition: WeaverNodeDefinition = {
  type: "DATABASE_ACTION",
  label: "Database",
  description: "Execute database SQL query or command",
  icon: React.createElement(StorageIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: DatabaseNodeConfig,
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
