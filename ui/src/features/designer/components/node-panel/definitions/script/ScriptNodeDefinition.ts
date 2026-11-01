import React from "react";
import CodeIcon from "@mui/icons-material/Code";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import { ScriptNodeConfig } from "./ScriptNodeConfig";

export const ScriptNodeDefinition: WeaverNodeDefinition = {
  type: "SCRIPT_ACTION",
  label: "Script",
  description: "Execute custom script expression (Python / JS / JEXL)",
  icon: React.createElement(CodeIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: ScriptNodeConfig,
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
