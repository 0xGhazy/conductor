import React from "react";
import {
  Globe,
  Diamond,
  Repeat,
  Hourglass,
  Workflow,
  X,
  FileCode2,
  Database as DatabaseIcon,
  Sliders,
  CheckCircle2,
  MessageSquareQuote,
  Radio,
  Rocket,
  GitFork,
} from "lucide-react";
import { SiRedis } from "react-icons/si";
import type { TaskRegistryItem } from "./WeaverTaskPanel.types";

/** SVG Icon for HTTP Poll 3-bar soundwave matching reference screenshot */
const HttpPollIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="8" y1="10" x2="8" y2="16" />
    <line x1="12" y1="6" x2="12" y2="20" />
    <line x1="16" y1="10" x2="16" y2="16" />
  </svg>
);

/** Canonical Task Registry matching reference screenshot & supported Conductor workflow nodes */
export const DEFAULT_TASK_REGISTRY: TaskRegistryItem[] = [
  // --- QUICK ADD SECTION ---
  {
    type: "WORKER_TASK",
    name: "Worker Task",
    shortName: "Worker Task...",
    icon: (
      <span
        style={{
          fontSize: 17,
          fontWeight: 700,
          fontFamily: "system-ui, serif",
          lineHeight: 1,
        }}
      >
        λ
      </span>
    ),
    category: "QUICK ADD",
    description: "Generic Conductor worker task executed by external worker",
    keywords: ["worker", "lambda", "task", "compute", "job"],
    disabled: true,
  },
  {
    type: "HTTP_ACTION",
    name: "HTTP Task",
    shortName: "HTTP Task",
    icon: <Globe size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Call an external HTTP/REST API with configurable parameters",
    keywords: ["http", "api", "rest", "web", "fetch", "get", "post", "curl", "request"],
    disabled: false,
  },
  {
    type: "HTTP_POLL",
    name: "HTTP Poll Task",
    shortName: "HTTP Poll Task",
    icon: <HttpPollIcon size={18} />,
    category: "QUICK ADD",
    description: "Poll an HTTP endpoint periodically until a condition is satisfied",
    keywords: ["poll", "polling", "http poll", "interval", "status check"],
    disabled: true,
  },
  {
    type: "GRPC_TASK",
    name: "gRPC Task",
    shortName: "gRPC Task",
    icon: <Globe size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Invoke remote procedure calls over gRPC",
    keywords: ["grpc", "rpc", "protobuf", "service", "binary"],
    disabled: true,
  },
  {
    type: "PUBLISH_EVENT",
    name: "Publish Event",
    shortName: "Publish Event",
    icon: <Radio size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Publish events to message broker or event queue",
    keywords: ["event", "publish", "kafka", "queue", "topic", "broadcast"],
    disabled: true,
  },
  {
    type: "SWITCH_ACTION",
    name: "Switch",
    shortName: "Switch",
    icon: <Diamond size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Route execution by conditional decision branches",
    keywords: ["switch", "case", "branch", "condition", "if", "route", "decision"],
    disabled: false,
  },
  {
    type: "FORK_JOIN",
    name: "Fork Join",
    shortName: "Fork Join",
    icon: <GitFork size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Execute multiple tasks in parallel and join execution",
    keywords: ["fork", "join", "parallel", "concurrent", "split"],
    disabled: true,
  },
  {
    type: "FOREACH_ACTION",
    name: "Do While",
    shortName: "Do While",
    icon: <Repeat size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Execute loop iterations in parallel or while a condition is true",
    keywords: ["do while", "foreach", "loop", "iterate", "repeat", "cycle", "while"],
    disabled: false,
  },
  {
    type: "SCRIPT_ACTION",
    name: "Set Variable",
    shortName: "Set Variable",
    icon: (
      <span
        style={{
          fontSize: 16,
          fontStyle: "italic",
          fontWeight: 700,
          fontFamily: "serif",
          lineHeight: 1,
        }}
      >
        ƒ
      </span>
    ),
    category: "QUICK ADD",
    description: "Assign and compute variables in workflow state",
    keywords: ["set variable", "variable", "assign", "state", "expression", "formula"],
    disabled: false,
  },
  {
    type: "WAIT_ACTION",
    name: "Wait",
    shortName: "Wait",
    icon: <Hourglass size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Pause execution for a duration or until a specific timestamp",
    keywords: ["wait", "delay", "pause", "sleep", "timer", "schedule", "timeout"],
    disabled: false,
  },
  {
    type: "SUBWORKFLOW_ACTION",
    name: "Sub Workflow",
    shortName: "Sub Workflow",
    icon: <Workflow size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Invoke another workflow as a sub-workflow",
    keywords: ["sub workflow", "workflow", "subprocess", "nested", "call", "flow"],
    disabled: false,
  },
  {
    type: "START_WORKFLOW",
    name: "Start Workflow",
    shortName: "Start Workflo...",
    icon: <Rocket size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Trigger asynchronous start of another workflow definition",
    keywords: ["start workflow", "trigger", "launch", "fire", "spawn"],
    disabled: true,
  },
  {
    type: "TERMINATE",
    name: "Terminate",
    shortName: "Termina...",
    icon: <X size={18} strokeWidth={2} />,
    category: "QUICK ADD",
    description: "Terminate the workflow immediately with completed or failed state",
    keywords: ["terminate", "stop", "end", "exit", "abort", "finish", "kill"],
    disabled: false,
  },
  {
    type: "SCRIPT_ACTION",
    name: "Javascript",
    shortName: "Javascr...",
    icon: <FileCode2 size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Execute JavaScript or JEXL expressions and custom scripts",
    keywords: ["javascript", "js", "script", "code", "eval", "expression", "node"],
    disabled: false,
  },
  {
    type: "DATABASE_ACTION",
    name: "Database",
    shortName: "Database",
    icon: <DatabaseIcon size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Run a database query or command",
    keywords: ["database", "db", "sql", "query", "postgres", "mysql", "data"],
    disabled: false,
  },
  {
    type: "REDIS_ACTION",
    name: "Redis",
    shortName: "Redis",
    icon: <SiRedis size={18} />,
    category: "QUICK ADD",
    description: "Perform dynamic Redis cache and key-value store operations",
    keywords: ["redis", "cache", "key", "val", "store", "memory"],
    disabled: false,
  },
  {
    type: "RULE_ENGINE_ACTION",
    name: "Rule Engine",
    shortName: "Rule Engine",
    icon: <Sliders size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Evaluate complex business logic rules and conditions",
    keywords: ["rule", "rule engine", "logic", "decision", "policy", "business"],
    disabled: false,
  },
  {
    type: "VALIDATION_ACTION",
    name: "Validation",
    shortName: "Validation",
    icon: <CheckCircle2 size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Validate payloads against schema and business constraints",
    keywords: ["validation", "schema", "verify", "check", "assert"],
    disabled: false,
  },
  {
    type: "RESPOND_ACTION",
    name: "Respond",
    shortName: "Respond",
    icon: <MessageSquareQuote size={18} strokeWidth={1.75} />,
    category: "QUICK ADD",
    description: "Reply to client with localized message",
    keywords: ["respond", "reply", "return", "output", "client"],
    disabled: false,
  },
];
