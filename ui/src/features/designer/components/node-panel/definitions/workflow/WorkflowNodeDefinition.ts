import React from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import { WorkflowNodeConfig } from "./WorkflowNodeConfig";
import { serializeWorkflowNodeForJson } from "./serializeWorkflowNodeForJson";

/**
 * Node definition for the Workflow node representing the invocation
 * of another workflow as a sub-workflow task.
 */
export const WorkflowNodeDefinition: WeaverNodeDefinition = {
  type: "WORKFLOW",
  label: "Workflow",
  description: "Invoke and execute another workflow as a sub-workflow",
  icon: React.createElement(AccountTreeIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: WorkflowNodeConfig,
  serializeForJson: serializeWorkflowNodeForJson,
  tabs: [
    {
      id: "configuration",
      label: "Configurations",
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
      id: "output",
      label: "Output",
      icon: React.createElement(QueryStatsIcon, { fontSize: "small" }),
      render: "result",
    },
  ],
};
