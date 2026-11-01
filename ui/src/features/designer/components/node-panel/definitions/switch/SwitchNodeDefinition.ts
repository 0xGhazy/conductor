import React from "react";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import { SwitchNodeConfig } from "./SwitchNodeConfig";

export const SwitchNodeDefinition: WeaverNodeDefinition = {
  type: "SWITCH_ACTION",
  label: "Switch",
  description: "Route workflow execution based on evaluated condition",
  icon: React.createElement(AltRouteIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: SwitchNodeConfig,
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
  ],
};
