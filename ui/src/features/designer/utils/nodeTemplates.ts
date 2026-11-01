import {
  DEFAULT_HTTP_HEADERS_STR,
  DEFAULT_HTTP_TIMEOUT,
} from "./httpConstants";

const createHttpTemplate = () => {
  const refSuffix = Math.random().toString(36).slice(2, 10).toLowerCase();
  const refName = `http_request_${refSuffix}`;
  return {
    kind: "httpAction",
    name: "HTTP",
    data: {
      config: {
        nodeName: "HTTP",
        name: refName,
        referenceName: refName,
        taskReferenceName: refName,
        method: "GET",
        url: "",
        headers: DEFAULT_HTTP_HEADERS_STR,
        query: "{}",
        body: "{}",
        timeout: DEFAULT_HTTP_TIMEOUT,
        connection: "--NONE--",
      },
    },
  };
};

const createSwitchTemplate = () => ({
  kind: "SWITCH_ACTION",
  name: "Switch",
  config: {
    taskReferenceName: "Switch",
    evaluatorType: "value-param",
    expression: "",
    inputParameters: { switchCaseValue: "switchCaseValue" },
    cases: [{ id: `case-${Date.now()}`, value: "case1", label: "Case 1" }],
    decisionCases: { case1: [] },
    defaultCase: [],
  },
});

const createDatabaseTemplate = () => ({
  kind: "DATABASE_ACTION",
  name: "Query",
  config: {
    name: `database_query_${Math.random().toString(36).slice(2, 10).toLowerCase()}`,
    query: "getCustomerBalance1",
  },
});

const createSubworkflowTemplate = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  const refName = `workflow_${suffix}`;
  return {
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
  };
};

const createTerminateTemplate = () => ({
  kind: "terminateAction",
  name: "Terminate",
  config: { status: "COMPLETED", reason: "Workflow terminated", output: {} },
});

const createRegexTemplate = () => ({
  kind: "regexValidator",
  name: "Regex Validator",
  config: { pattern: "/^[a-zA-Z0-9]+$/", field: "input.value" },
});

const createDelayTemplate = () => ({
  kind: "DELAY_ACTION",
  name: "Delay",
  config: { duration: 1000 },
});

const createJexlTemplate = () => {
  const refName = `script_${Math.random().toString(36).slice(2, 10).toLowerCase()}`;
  return {
    kind: "JEXL_ACTION",
    name: "JEXL",
    config: {
      name: refName,
      referenceName: refName,
      reference: refName,
      taskReferenceName: refName,
      scriptName: "",
      expression: "",
      variables: {},
    },
  };
};

const createScriptTemplate = () => {
  const refName = `script_${Math.random().toString(36).slice(2, 10).toLowerCase()}`;
  return {
    kind: "SCRIPT_ACTION",
    name: "Script",
    config: {
      name: refName,
      referenceName: refName,
      reference: refName,
      taskReferenceName: refName,
      scriptName: "",
      expression: "",
      variables: {},
      language: "JEXL",
      timeout: 30000,
    },
  };
};

const createValidationTemplate = () => {
  const refName = `validation_${Math.random().toString(36).slice(2, 10).toLowerCase()}`;
  return {
    kind: "VALIDATION_ACTION",
    name: "Validation",
    config: {
      name: refName,
      referenceName: refName,
      reference: refName,
      validationRules: [],
      rules: [],
    },
  };
};

const createRespondTemplate = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  const refName = `respond_${suffix}`;
  return {
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
  };
};

const createForEachTemplate = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  const refName = `foreach_${suffix}`;
  return {
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
  };
};

export const NODE_TEMPLATES = {
  httpAction: createHttpTemplate,
  HTTP_ACTION: createHttpTemplate,
  SWITCH_ACTION: createSwitchTemplate,
  DATABASE_ACTION: createDatabaseTemplate,
  subworkflow: createSubworkflowTemplate,
  SUBWORKFLOW_ACTION: createSubworkflowTemplate,
  WORKFLOW: createSubworkflowTemplate,
  SUB_WORKFLOW: createSubworkflowTemplate,
  terminateAction: createTerminateTemplate,
  TERMINATE: createTerminateTemplate,
  respondAction: createRespondTemplate,
  RESPOND_ACTION: createRespondTemplate,
  RESPOND: createRespondTemplate,
  regexValidator: createRegexTemplate,
  REGEX: createRegexTemplate,
  DELAY_ACTION: createDelayTemplate,
  JEXL_ACTION: createJexlTemplate,
  SCRIPT_ACTION: createScriptTemplate,
  VALIDATION_ACTION: createValidationTemplate,
  FOREACH_ACTION: createForEachTemplate,
  FOREACH: createForEachTemplate,
};

export const createNodeData = (kind) => {
  if (!kind) return null;
  const factory = NODE_TEMPLATES[kind];
  return typeof factory === "function" ? factory() : null;
};

export const generateNodeId = (kind) => {
  const suffix = Date.now();
  if (!kind || typeof kind !== "string") {
    return `node-${suffix}`;
  }

  const normalized = kind
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "node"}-${suffix}`;
};

export const getSwitchCaseLabel = (node, handleId) => {
  if (!node || node.type !== "SWITCH_ACTION" || !handleId) return null;

  const cases =
    node?.data?.config?.cases ?? node?.data?.config?.config?.cases ?? [];

  for (let i = 0; i < cases.length; i += 1) {
    const caseData = cases[i] || {};
    const baseId = caseData.id || `case-${i}`;
    if (baseId === handleId) {
      return caseData.label || caseData.value || `case_${i + 1}`;
    }
  }

  if (handleId === "default") return "default";

  return null;
};

