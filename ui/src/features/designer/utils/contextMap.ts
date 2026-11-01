const START_NODE_ID = "00000000-0000-0000-0000-000000000000";
const LEGACY_START_NODE_ID = "start";
const START_NODE_TYPE = "STARTFLAG";
const WORKFLOW_KEY = "workflow";
const DEFAULT_START_TIMEOUT_SECONDS = 10;

const UI_ONLY_NODE_TYPES = new Set(["SCOPE"]);

const trim = (value) => String(value ?? "").trim();

const normalizeNodeType = (nodeType) => trim(nodeType).toUpperCase();

const isStartNode = (node) => {
  if (!node) return false;
  const id = trim(node.id).toLowerCase();
  return (
    id === START_NODE_ID ||
    id === LEGACY_START_NODE_ID ||
    normalizeNodeType(node.type) === START_NODE_TYPE
  );
};

const getStartNode = (nodes = []) =>
  (Array.isArray(nodes) ? nodes : []).find((node) => isStartNode(node)) || null;

const providerDefault = () => ["output.result"];

const providerHttp = () => [
  "output.result",
  "output.result.status",
  "output.result.response",
  "output.result.headers",
];

const providerDatabase = () => [
  "output.result",
  "output.result.resultSet",
  "output.result.affectedRowsCount",
  "output.result.status",
  "output.result.executionTime",
  "output.result.errorCode",
  "output.result.reason",
];

const providerJexl = () => ["output.result", "output.error"];

const providerValidation = () => [
  "output.validationResult",
  "output.validationResult.valid",
  "output.validationResult.errors",
  "output.result",
  "output.error",
];

const providerSwitch = () => ["output"];

const providerTerminate = () => ["output"];

const providerWait = () => ["output"];

const providerForEach = () => [
  "output",
  "output.results",
  "output.total",
  "output.successful",
  "output.failed",
  "output.status",
  "output.errors",
];

export const NODE_SUGGESTION_PROVIDERS = {
  HTTP_ACTION: providerHttp,
  DATABASE_ACTION: providerDatabase,
  JEXL_ACTION: providerJexl,
  SCRIPT_ACTION: providerJexl,
  VALIDATION_ACTION: providerValidation,
  SWITCH_ACTION: providerSwitch,
  WAIT_ACTION: providerWait,
  WAIT: providerWait,
  FOREACH_ACTION: providerForEach,
  FOREACH: providerForEach,
  TERMINATE: providerTerminate,
  terminateAction: providerTerminate,
};

export const getNodeSuggestionPaths = (node) => {
  const nodeType = normalizeNodeType(node?.type);
  const provider = NODE_SUGGESTION_PROVIDERS[nodeType] || providerDefault;
  const rawPaths = provider(node);
  if (!Array.isArray(rawPaths)) return providerDefault();
  return rawPaths
    .map((path) => trim(path))
    .filter(Boolean);
};

export const resolveNodeReferenceName = (node) => {
  if (!node || isStartNode(node)) return "";
  const nodeType = normalizeNodeType(node.type);
  if (UI_ONLY_NODE_TYPES.has(nodeType)) return "";
  const nodeId = trim(node.id);
  if (!nodeId) return "";

  const taskReferenceName = trim(node?.data?.config?.taskReferenceName);
  if (taskReferenceName) return taskReferenceName;

  const referenceName = trim(node?.data?.config?.referenceName);
  if (referenceName) return referenceName;

  const reference = trim(node?.data?.config?.reference);
  if (reference) return reference;

  const configName = trim(node?.data?.config?.name);
  if (configName) return configName;

  return "";
};

export const buildNodeRefsIndex = (nodes = []) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  return safeNodes.reduce((acc, node) => {
    if (!node || isStartNode(node)) return acc;
    const nodeId = trim(node.id);
    const referenceName = resolveNodeReferenceName(node);
    if (!nodeId || !referenceName) return acc;
    acc[nodeId] = referenceName;
    return acc;
  }, {});
};

const getUniqueOrdered = (values = []) => {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = trim(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
};

const wrapSuggestionToken = (token) => {
  const normalized = trim(token);
  if (!normalized) return "";
  if (
    normalized.startsWith("${") &&
    normalized.endsWith("}") &&
    normalized.length > 3
  ) {
    return normalized;
  }
  return `\${${normalized}}`;
};

export const DEFAULT_WORKFLOW_INPUTS = ["_language"];

export const buildWorkflowContextMetadata = ({
  nodes = [],
  workflowName = "",
  workflowVersion = 1,
  workflowVariables = {},
} = {}) => {
  const startNode = getStartNode(nodes);
  const startConfig = startNode?.data?.config || {};
  const timeoutRaw = Number(startConfig.timeoutSeconds ?? startConfig.timeout ?? NaN);
  const timeoutSeconds =
    Number.isFinite(timeoutRaw) && timeoutRaw > 0
      ? timeoutRaw
      : DEFAULT_START_TIMEOUT_SECONDS;
  const timeoutPolicy =
    trim(startConfig.timeoutPolicy) === "ALERT_ONLY" ? "ALERT_ONLY" : "TIME_OUT_WF";

  const inputDefinitionNames = Array.isArray(startConfig.inputDefinitions)
    ? startConfig.inputDefinitions.map((entry) => trim(entry?.name)).filter(Boolean)
    : [];

  const inputParameterNames =
    startConfig.inputParameters &&
    typeof startConfig.inputParameters === "object" &&
    !Array.isArray(startConfig.inputParameters)
      ? Object.keys(startConfig.inputParameters)
      : [];

  const variableNames = [
    ...(workflowVariables && typeof workflowVariables === "object" && !Array.isArray(workflowVariables)
      ? Object.keys(workflowVariables)
      : []),
    ...(startConfig.variables && typeof startConfig.variables === "object" && !Array.isArray(startConfig.variables)
      ? Object.keys(startConfig.variables)
      : []),
  ];

  const inputs = getUniqueOrdered([
    ...DEFAULT_WORKFLOW_INPUTS,
    ...inputDefinitionNames,
    ...inputParameterNames,
  ]);

  const variables = getUniqueOrdered(variableNames);

  return {
    name: trim(workflowName) || "Untitled",
    version: workflowVersion,
    timeoutSeconds,
    timeoutPolicy,
    inputs,
    variables,
  };
};

const buildIncomingEdgesIndex = (edges = []) => {
  const safeEdges = Array.isArray(edges) ? edges : [];
  return safeEdges.reduce((acc, edge) => {
    const source = trim(edge?.source);
    const target = trim(edge?.target);
    if (!source || !target) return acc;
    if (!acc.has(target)) acc.set(target, new Set());
    acc.get(target).add(source);
    return acc;
  }, new Map());
};

const collectAncestorNodeIds = ({ nodeId, edges = [] }) => {
  const targetNodeId = trim(nodeId);
  if (!targetNodeId) return new Set();

  const incomingByTarget = buildIncomingEdgesIndex(edges);
  const ancestors = new Set();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    const incoming = incomingByTarget.get(current);
    if (!incoming) continue;
    incoming.forEach((parentId) => {
      if (ancestors.has(parentId)) return;
      ancestors.add(parentId);
      queue.push(parentId);
    });
  }

  return ancestors;
};

const resolveVisibleNodeIds = ({ nodes = [], edges = [], selectedNodeId = "" }) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const selectedId = trim(selectedNodeId);
  if (!selectedId) {
    return new Set(
      safeNodes
        .filter((node) => node && !isStartNode(node))
        .map((node) => trim(node.id))
        .filter(Boolean)
    );
  }

  const selectedNodeExists = safeNodes.some((node) => trim(node?.id) === selectedId);
  if (!selectedNodeExists) return new Set();

  if (selectedId.toLowerCase() === START_NODE_ID || selectedId.toLowerCase() === LEGACY_START_NODE_ID) {
    return new Set();
  }

  const visible = collectAncestorNodeIds({ nodeId: selectedId, edges });
  return visible;
};

export const buildSimpleContextMap = ({
  nodes = [],
  workflowName = "",
  workflowVersion = 1,
  workflowVariables = {},
  edges = [],
  selectedNodeId = "",
  scoped = false,
} = {}) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const nodeRefs = buildNodeRefsIndex(safeNodes);
  const workflow = buildWorkflowContextMetadata({
    nodes: safeNodes,
    workflowName,
    workflowVersion,
    workflowVariables,
  });

  const visibleNodeIds = scoped
    ? resolveVisibleNodeIds({ nodes: safeNodes, edges, selectedNodeId })
    : new Set(Object.keys(nodeRefs));

  const contextMap = {
    [WORKFLOW_KEY]: workflow,
  };

  safeNodes.forEach((node) => {
    if (!node || isStartNode(node)) return;
    const nodeId = trim(node.id);
    if (!nodeId) return;
    if (scoped && !visibleNodeIds.has(nodeId)) return;

    const referenceName = nodeRefs[nodeId];
    if (!referenceName || contextMap[referenceName]) return;
    contextMap[referenceName] = getNodeSuggestionPaths(node);
  });

  return {
    contextMap,
    nodeRefs,
  };
};

export const flattenContextMapSuggestions = (contextMap = {}) => {
  if (!contextMap || typeof contextMap !== "object") return [];

  const tokens = [];
  const workflow = contextMap[WORKFLOW_KEY];
  if (workflow && typeof workflow === "object" && !Array.isArray(workflow)) {
    if (workflow.name != null) tokens.push("workflow.name");
    if (workflow.version != null) tokens.push("workflow.version");
    if (workflow.timeoutSeconds != null) tokens.push("workflow.timeoutSeconds");
    if (workflow.timeoutPolicy != null) tokens.push("workflow.timeoutPolicy");
    const workflowInputs = Array.isArray(workflow.inputs) ? workflow.inputs : [];
    workflowInputs.forEach((inputName) => {
      const normalizedInput = trim(inputName);
      if (!normalizedInput) return;
      tokens.push(`workflow.input.${normalizedInput}`);
    });
    const workflowVariables = Array.isArray(workflow.variables) ? workflow.variables : [];
    workflowVariables.forEach((variableName) => {
      const normalizedVar = trim(variableName);
      if (!normalizedVar) return;
      tokens.push(`workflow.variables.${normalizedVar}`);
    });
  }

  Object.entries(contextMap).forEach(([key, value]) => {
    if (key === WORKFLOW_KEY) return;
    const referenceName = trim(key);
    if (!referenceName || !Array.isArray(value)) return;
    value.forEach((path) => {
      const normalizedPath = trim(path);
      if (!normalizedPath) return;
      tokens.push(`${referenceName}.${normalizedPath}`);
    });
  });

  return getUniqueOrdered(tokens.map((token) => wrapSuggestionToken(token)));
};

export const buildScopedSuggestions = ({
  nodes = [],
  edges = [],
  selectedNodeId = "",
  workflowName = "",
  workflowVersion = 1,
  workflowVariables = {},
} = {}) => {
  const { contextMap, nodeRefs } = buildSimpleContextMap({
    nodes,
    edges,
    selectedNodeId,
    workflowName,
    workflowVersion,
    workflowVariables,
    scoped: true,
  });

  return {
    contextMap,
    nodeRefs,
    suggestions: flattenContextMapSuggestions(contextMap),
  };
};
