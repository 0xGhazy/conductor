import React from "react";
import LinkIcon from "@mui/icons-material/Link";
import TuneIcon from "@mui/icons-material/Tune";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import type { Node } from "@xyflow/react";
import type { WeaverNodeDefinition } from "../../nodeDefinition.types";
import type { WorkflowValidationIssue } from "@/features/designer/validation/types";
import { VALID_HTTP_METHODS_SET } from "@/features/designer/utils/httpConstants";
import { HttpNodeConfig } from "./HttpNodeConfig";
import { serializeHttpNodeForJson } from "./serializeHttpNodeForJson";

export const HttpNodeDefinition: WeaverNodeDefinition = {
  type: "HTTP_ACTION",
  label: "HTTP",
  description: "Execute external HTTP/REST API request",
  icon: React.createElement(LinkIcon, { fontSize: "small" }),
  defaultTab: "configuration",
  ConfigurationComponent: HttpNodeConfig,
  serializeForJson: serializeHttpNodeForJson,
  validate: (node: Node): WorkflowValidationIssue[] => {
    const issues: WorkflowValidationIssue[] = [];
    const nodeId = node.id;
    const config = (node.data?.config as Record<string, any>) || {};
    const nodeName = (node.data as any)?.name || config.nodeName || config.name || nodeId;

    const url = String(config.url || "").trim();
    if (!url) {
      issues.push({
        id: `http-missing-url-${nodeId}`,
        severity: "error",
        code: "HTTP_URL_REQUIRED",
        message: `HTTP node "${nodeName}" is missing a request URL.`,
        nodeId,
        fieldPath: "url",
        description: "An endpoint URL or URI expression must be specified.",
      });
    }

    const method = String(config.method || "GET").trim().toUpperCase();
    if (!VALID_HTTP_METHODS_SET.has(method)) {
      issues.push({
        id: `http-invalid-method-${nodeId}`,
        severity: "error",
        code: "HTTP_METHOD_INVALID",
        message: `HTTP node "${nodeName}" has invalid HTTP method "${method}".`,
        nodeId,
        fieldPath: "method",
        description: "Supported methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS.",
      });
    }

    return issues;
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
