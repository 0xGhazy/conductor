import React from "react";
import FlagIcon from "@mui/icons-material/Flag";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import { StartNodeConfig } from "./StartNodeConfig";

export const StartNodeDefinition: WeaverNodeDefinition = {
  type: "START",
  label: "Start",
  description: "Workflow initiation and parameters",
  icon: React.createElement(FlagIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: StartNodeConfig,
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
  ],
};
