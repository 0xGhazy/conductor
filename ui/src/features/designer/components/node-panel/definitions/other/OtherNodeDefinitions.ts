import React from "react";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import MessageIcon from "@mui/icons-material/Message";
import TimerIcon from "@mui/icons-material/Timer";
import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import RuleIcon from "@mui/icons-material/Rule";
import LoopIcon from "@mui/icons-material/Loop";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import {
  TerminateNodeConfig,
  RespondNodeConfig,
  WaitNodeConfig,
  TaskIdentityNodeConfig,
} from "./OtherNodeConfigs";

export const TerminateNodeDefinition: WeaverNodeDefinition = {
  type: "TERMINATE",
  label: "Terminate",
  description: "Terminate workflow execution immediately",
  icon: React.createElement(PowerSettingsNewIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: TerminateNodeConfig,
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

export const RespondNodeDefinition: WeaverNodeDefinition = {
  type: "RESPOND_ACTION",
  label: "Respond",
  description: "Send multi-language response to client",
  icon: React.createElement(MessageIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: RespondNodeConfig,
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

export const WaitNodeDefinition: WeaverNodeDefinition = {
  type: "WAIT_ACTION",
  label: "Wait",
  description: "Delay execution for a specified duration or until timestamp",
  icon: React.createElement(TimerIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: WaitNodeConfig,
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

export { RedisNodeDefinition } from "../redis";

/** Configuration + JSON tabs for tasks whose detailed settings are edited in their own modal. */
const identityOnlyTabs: WeaverNodeDefinition["tabs"] = [
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
];

export const ValidationNodeDefinition: WeaverNodeDefinition = {
  type: "VALIDATION_ACTION",
  label: "Validation",
  description: "Validate workflow data against rules",
  icon: React.createElement(VerifiedUserIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: TaskIdentityNodeConfig,
  tabs: identityOnlyTabs,
};

export const RuleEngineNodeDefinition: WeaverNodeDefinition = {
  type: "RULE_ENGINE_ACTION",
  label: "Rule Engine",
  description: "Evaluate business rules",
  icon: React.createElement(RuleIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: TaskIdentityNodeConfig,
  tabs: identityOnlyTabs,
};

export const ForEachNodeDefinition: WeaverNodeDefinition = {
  type: "FOREACH_ACTION",
  label: "For Each",
  description: "Iterate over a collection",
  icon: React.createElement(LoopIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: TaskIdentityNodeConfig,
  tabs: identityOnlyTabs,
};
