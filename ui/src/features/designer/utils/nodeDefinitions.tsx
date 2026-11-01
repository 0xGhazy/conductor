import React from "react";
import {
  Link as LinkIcon,
  Database as DatabaseIcon,
  CodeXml,
  Power,
  GitBranch,
  RadioTower,
  HardDrive,
  Mail,
  Bot,
  FileCode2,
  TerminalSquare,
  Shuffle,
  GitMerge,
  Repeat,
  Workflow,
  ScrollText,
  Webhook,
  Timer,
  MessageSquareQuote,
} from "lucide-react";
import { createUuid } from "@/utils/uuid";

export interface NodeToolboxItem {
  type: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  description: string;
  disabled?: boolean;
}

export const NODE_TOOLBOX_CATEGORY_ORDER = [
  "Web",
  "Code",
  "Data",
  "Logic",
  "Control",
  "Future work (coming soon)",
];

export const NODE_TOOLBOX_CATEGORY_STYLES: Record<string, {
  iconColor: string;
  iconBackground: string;
  iconBorder: string;
  headerColor: string;
  headerBackground: string;
}> = {
  Web: {
    iconColor: "#1d4ed8",
    iconBackground: "rgba(37, 99, 235, 0.14)",
    iconBorder: "rgba(37, 99, 235, 0.36)",
    headerColor: "#1e3a8a",
    headerBackground: "rgba(37, 99, 235, 0.1)",
  },
  Code: {
    iconColor: "#7c3aed",
    iconBackground: "rgba(124, 58, 237, 0.14)",
    iconBorder: "rgba(124, 58, 237, 0.34)",
    headerColor: "#5b21b6",
    headerBackground: "rgba(124, 58, 237, 0.1)",
  },
  Data: {
    iconColor: "#0f766e",
    iconBackground: "rgba(15, 118, 110, 0.14)",
    iconBorder: "rgba(15, 118, 110, 0.34)",
    headerColor: "#115e59",
    headerBackground: "rgba(15, 118, 110, 0.1)",
  },
  Logic: {
    iconColor: "#b45309",
    iconBackground: "rgba(180, 83, 9, 0.14)",
    iconBorder: "rgba(180, 83, 9, 0.34)",
    headerColor: "#92400e",
    headerBackground: "rgba(180, 83, 9, 0.1)",
  },
  Control: {
    iconColor: "#be123c",
    iconBackground: "rgba(190, 18, 60, 0.14)",
    iconBorder: "rgba(190, 18, 60, 0.34)",
    headerColor: "#9f1239",
    headerBackground: "rgba(190, 18, 60, 0.1)",
  },
  "Future work (coming soon)": {
    iconColor: "#475569",
    iconBackground: "rgba(71, 85, 105, 0.14)",
    iconBorder: "rgba(71, 85, 105, 0.34)",
    headerColor: "#334155",
    headerBackground: "rgba(71, 85, 105, 0.1)",
  },
  default: {
    iconColor: "#374151",
    iconBackground: "rgba(107, 114, 128, 0.12)",
    iconBorder: "rgba(107, 114, 128, 0.3)",
    headerColor: "#4b5563",
    headerBackground: "rgba(107, 114, 128, 0.09)",
  },
};

export const NODE_TOOLBOX_ITEMS: NodeToolboxItem[] = [
  {
    type: "HTTP_ACTION",
    label: "HTTP",
    icon: <LinkIcon size={18} />,
    category: "Web",
    description: "Call an external HTTP API",
  },
  {
    type: "DATABASE_ACTION",
    label: "Database",
    icon: <DatabaseIcon size={18} />,
    category: "Data",
    description: "Run a DB query or command",
  },
  {
    type: "SWITCH_ACTION",
    label: "Switch",
    icon: <GitBranch size={18} />,
    category: "Logic",
    description: "Route execution by condition",
  },
  {
    type: "FOREACH_ACTION",
    label: "ForEach",
    icon: <Repeat size={18} />,
    category: "Logic",
    description: "Execute loop iterations in parallel",
  },
  {
    type: "TERMINATE",
    label: "Terminate",
    icon: <Power size={18} />,
    category: "Control",
    description: "Terminate the workflow",
  },
  {
    type: "RESPOND_ACTION",
    label: "Respond",
    icon: <MessageSquareQuote size={18} />,
    category: "Control",
    description: "Reply to client with multi-language message",
  },
  {
    type: "FUTURE_MESSAGE_BROKER",
    label: "Message broker",
    icon: <RadioTower size={18} />,
    category: "Future work (coming soon)",
    description: "Kafka, RabbitMQ, and Active MQ",
    disabled: true,
  },
  {
    type: "FUTURE_REDIS_CACHE",
    label: "Redis",
    icon: <HardDrive size={18} />,
    category: "Future work (coming soon)",
    description: "Perform cahce operations",
    disabled: true,
  },
  {
    type: "FUTURE_EMAIL",
    label: "Email",
    icon: <Mail size={18} />,
    category: "Future work (coming soon)",
    description: "send email usign email template and smtp",
    disabled: true,
  },
  {
    type: "FUTURE_AGENT",
    label: "Agent",
    icon: <Bot size={18} />,
    category: "Future work (coming soon)",
    description: "AI agent",
    disabled: true,
  },
  {
    type: "FUTURE_PYTHON",
    label: "Python",
    icon: <FileCode2 size={18} />,
    category: "Future work (coming soon)",
    description: "Execute python scripts",
    disabled: true,
  },
  {
    type: "FUTURE_JS",
    label: "JS",
    icon: <CodeXml size={18} />,
    category: "Future work (coming soon)",
    description: "Execute Javascript scripts",
    disabled: true,
  },
  {
    type: "FUTURE_TERMINAL",
    label: "Terminal",
    icon: <TerminalSquare size={18} />,
    category: "Future work (coming soon)",
    description: "execute OS shell commands",
    disabled: true,
  },
  {
    type: "FUTURE_MEDIATOR",
    label: "Mediator",
    icon: <Shuffle size={18} />,
    category: "Future work (coming soon)",
    description: "Data transformers",
    disabled: true,
  },
  {
    type: "FUTURE_JOIN",
    label: "Join",
    icon: <GitMerge size={18} />,
    category: "Future work (coming soon)",
    description: "for conccurent tasks execution.",
    disabled: true,
  },
  {
    type: "FUTURE_DO_WHILE",
    label: "Do While",
    icon: <Repeat size={18} />,
    category: "Future work (coming soon)",
    description: "Repeat steps while a condition remains true",
    disabled: true,
  },
  {
    type: "SUBWORKFLOW_ACTION",
    label: "Workflow",
    icon: <Workflow size={18} />,
    category: "Control",
    description: "Invoke another workflow as a sub-workflow",
  },
  {
    type: "FUTURE_LOGGER",
    label: "Logger",
    icon: <ScrollText size={18} />,
    category: "Future work (coming soon)",
    description: "Log runtime data and execution traces",
    disabled: true,
  },
  {
    type: "FUTURE_WEBHOOK",
    label: "Webhook",
    icon: <Webhook size={18} />,
    category: "Future work (coming soon)",
    description: "Trigger or receive webhook events",
    disabled: true,
  },
  {
    type: "FUTURE_WAIT",
    label: "Wait",
    icon: <Timer size={18} />,
    category: "Future work (coming soon)",
    description: "Pause execution for a configured duration",
    disabled: true,
  },
];

export const buildNodeDataForKind = (
  kind: string,
  options: { workflowName?: string; workflowVersion?: string | number } = {}
): { type: string; data: Record<string, any> } | null => {
  const normalizedKind =
    kind === "httpAction"
      ? "HTTP_ACTION"
      : kind === "terminateAction"
        ? "TERMINATE"
        : kind === "respondAction" || kind === "RESPOND"
          ? "RESPOND_ACTION"
          : kind;
  const randomRefSuffix = Math.random().toString(36).slice(2, 10).toLowerCase();

  if (normalizedKind === "HTTP_ACTION") {
    return {
      type: "HTTP_ACTION",
      data: {
        kind: "HTTP_ACTION",
        name: "HTTP",
        config: {
          name: "HttpWorker",
          nodeName: "HTTP",
          taskReferenceName: `request_${randomRefSuffix}`,
          method: "GET",
          url: "",
          headers:
          {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: {},
          timeout: 3000,
          connection: "--NONE--",
        },
      },
    };
  }

  if (normalizedKind === "SWITCH_ACTION") {
    return {
      type: "SWITCH_ACTION",
      data: {
        kind: "SWITCH_ACTION",
        name: "Switch",
        config: {
          name: `switch_${randomRefSuffix}`,
          taskReferenceName: "Switch",
          evaluatorType: "value-param",
          expression: "",
          inputParameters: { switchCaseValue: "switchCaseValue" },
          cases: [
            { id: `case-${createUuid()}`, value: "case1", label: "Case 1" },
          ],
          decisionCases: { case1: [] },
          defaultCase: [],
        },
      },
    };
  }

  if (normalizedKind === "DATABASE_ACTION") {
    return {
      type: "DATABASE_ACTION",
      data: {
        kind: "DATABASE_ACTION",
        name: "Query",
        config: {
          name: `database_query_${randomRefSuffix}`,
          query: "getCustomerBalance1",
        },
      },
    };
  }

  if (normalizedKind === "JEXL_ACTION") {
    return {
      type: "JEXL_ACTION",
      data: {
        kind: "JEXL_ACTION",
        name: "JEXL",
        config: {
          name: `jexl_expr_${randomRefSuffix}`,
        },
      },
    };
  }

  if (normalizedKind === "SCRIPT_ACTION") {
    return {
      type: "SCRIPT_ACTION",
      data: {
        kind: "SCRIPT_ACTION",
        name: "Script",
        config: {
          name: `script_${randomRefSuffix}`,
          referenceName: `script_${randomRefSuffix}`,
          reference: `script_${randomRefSuffix}`,
          taskReferenceName: `script_${randomRefSuffix}`,
          language: "JEXL",
          expression: "",
          variables: {},
          timeout: 30000,
        },
      },
    };
  }

  if (normalizedKind === "VALIDATION_ACTION") {
    return {
      type: "VALIDATION_ACTION",
      data: {
        kind: "VALIDATION_ACTION",
        name: "Validation",
        config: { validationRules: [] },
      },
    };
  }

  if (normalizedKind === "REDIS_ACTION") {
    return {
      type: "REDIS_ACTION",
      data: {
        kind: "REDIS_ACTION",
        name: "Redis",
        config: {
          name: `redis_${randomRefSuffix}`,
          referenceName: `redis_${randomRefSuffix}`,
          reference: `redis_${randomRefSuffix}`,
          datasourceId: "",
          datasourceName: "",
          action: "GET",
          key: "",
          value: "",
          field: "",
        },
      },
    };
  }

  if (normalizedKind === "TERMINATE") {
    return {
      type: "TERMINATE",
      data: {
        kind: "TERMINATE",
        name: "Terminate",
        config: {
          name: `terminate_${randomRefSuffix}`,
          reason: "Workflow terminated",
          output: {},
        },
      },
    };
  }

  if (normalizedKind === "RESPOND_ACTION") {
    const refName = `respond_${randomRefSuffix}`;
    return {
      type: "RESPOND_ACTION",
      data: {
        kind: "RESPOND_ACTION",
        name: "Respond",
        config: {
          name: refName,
          referenceName: refName,
          reference: refName,
          taskReferenceName: refName,
          messageCode: "",
          languageCode: "${workflow.input._language}",
          previewText: "",
        },
      },
    };
  }

  if (normalizedKind === "WAIT_ACTION" || normalizedKind === "DELAY_ACTION") {
    return {
      type: "WAIT_ACTION",
      data: {
        kind: "WAIT_ACTION",
        name: "Wait",
        config: {
          name: `wait_${randomRefSuffix}`,
          referenceName: `wait_${randomRefSuffix}`,
          reference: `wait_${randomRefSuffix}`,
          mode: "DURATION",
          duration: "1 minute",
        },
      },
    };
  }

  if (normalizedKind === "FOREACH_ACTION" || normalizedKind === "FOREACH") {
    const refName = `foreach_${randomRefSuffix}`;
    return {
      type: "FOREACH_ACTION",
      data: {
        kind: "FOREACH_ACTION",
        name: "ForEach",
        config: {
          name: refName,
          referenceName: refName,
          reference: refName,
          taskReferenceName: refName,
          collection: "${workflow.input.items}",
          collectionExpression: "${workflow.input.items}",
          itemVariable: "item",
          indexVariable: "index",
          executionMode: "PARALLEL",
          errorStrategy: "FAIL_FAST",
          maxIterations: 1000,
          preserveOrder: true,
          loopOver: [],
        },
      },
    };
  }

  if (normalizedKind === "RULE_ENGINE_ACTION") {
    return {
      type: "RULE_ENGINE_ACTION",
      data: {
        kind: "RULE_ENGINE_ACTION",
        name: "Rule Engine",
        config: {
          name: `rule_${randomRefSuffix}`,
          referenceName: `rule_${randomRefSuffix}`,
          reference: `rule_${randomRefSuffix}`,
          rules: [],
        },
      },
    };
  }

  if (
    normalizedKind === "subworkflow" ||
    normalizedKind === "SUBWORKFLOW_ACTION" ||
    normalizedKind === "WORKFLOW" ||
    normalizedKind === "SUB_WORKFLOW"
  ) {
    const refName = `workflow_${randomRefSuffix}`;
    return {
      type: "SUBWORKFLOW_ACTION",
      data: {
        kind: "SUBWORKFLOW_ACTION",
        name: "Workflow",
        config: {
          name: refName,
          referenceName: refName,
          reference: refName,
          taskReferenceName: refName,
          workflowName: "",
          version: null,
          subWorkflowParam: {
            name: "",
            version: null,
          },
          inputs: {},
          correlationId: "",
          mode: "ASYNC",
        },
      },
    };
  }

  if (normalizedKind === "regexValidator") {
    return {
      type: "regexValidator",
      data: {
        kind: "regexValidator",
        name: "Regex Validator",
        config: { pattern: "/^[a-zA-Z0-9]+$/", field: "input.value" },
      },
    };
  }

  return null;
};
