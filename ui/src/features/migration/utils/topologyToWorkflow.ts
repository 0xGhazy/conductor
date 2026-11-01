import { LEGACY_START_NODE_ID, START_NODE_ID } from "@/features/designer";
import { createUuid } from "@/utils/uuid";

type JsonMap = Record<string, any>;

const OWNER_EMAIL = "conductor.wrapper@vodafone.com";
const DEFAULT_DATABASE_DATASOURCE_ID = "019dba58-50f7-78eb-addf-632e48578cda";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREFIXED_UUID_PATTERN = /^.+_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

const DEFAULT_WORKFLOW_INPUT = {
  nodes: [
    {
      id: START_NODE_ID,
      type: "startFlag",
      position: { x: 220, y: 140 },
      data: { name: "Start" },
      draggable: false,
      selectable: true,
    },
  ],
  edges: [],
  meta: {
    workflowName: "Untitled",
    version: 1,
    description: "",
  },
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null)) as T;
const trim = (value: any) => String(value ?? "").trim();
const isObject = (value: any): value is JsonMap =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const parseJsonObject = (value: any, fallback: JsonMap = {}) => {
  if (isObject(value)) return clone(value);
  if (typeof value !== "string" || !value.trim()) return clone(fallback);
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : clone(fallback);
  } catch {
    return clone(fallback);
  }
};
const asNumber = (value: any, fallback: number) => {
  if (typeof value === "boolean") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const isUuid = (value: any) => UUID_PATTERN.test(trim(value));
const isStartNodeId = (value: any) => [START_NODE_ID, LEGACY_START_NODE_ID].includes(trim(value));
const normalizeNodeType = (node: JsonMap | null | undefined) => trim(node?.type).toUpperCase();
const isStartNode = (node: JsonMap | null | undefined) =>
  Boolean(node) && (isStartNodeId(node?.id) || normalizeNodeType(node) === "STARTFLAG");
const isScopeNode = (node: JsonMap | null | undefined) => normalizeNodeType(node) === "SCOPE";

const normalizeNodeId = (rawId: any, idMap?: Map<string, string>) => {
  const value = trim(rawId);
  if (!value) return createUuid();
  if (isStartNodeId(value)) return START_NODE_ID;
  if (value === "end") return value;
  if (isUuid(value)) return value;
  const match = value.match(PREFIXED_UUID_PATTERN);
  if (match?.[1]) return match[1];
  if (!idMap) return createUuid();
  if (!idMap.has(value)) idMap.set(value, createUuid());
  return idMap.get(value) || createUuid();
};

const buildNodeIdMap = (nodes: JsonMap[]) => {
  const idMap = new Map<string, string>();
  nodes.forEach((node) => {
    const rawId = trim(node?.id);
    if (rawId && !idMap.has(rawId)) {
      idMap.set(rawId, normalizeNodeId(rawId, idMap));
    }
  });
  return idMap;
};

const mapNodeId = (idMap: Map<string, string>, rawId: any) => {
  const value = trim(rawId);
  return value ? idMap.get(value) || normalizeNodeId(value, idMap) : value;
};

const resolveRefName = (
  node: JsonMap,
  fallbackPrefix: string,
  configKeys = ["name", "referenceName", "reference", "taskReferenceName"],
  dataName: any = null
) => {
  const data = isObject(node.data) ? node.data : {};
  const cfg = isObject(data.config) ? data.config : {};
  const candidates = [...configKeys.map((key) => cfg[key]), dataName];
  const resolved = candidates.map(trim).find(Boolean);
  return resolved || `${fallbackPrefix}_${trim(node.id) || createUuid().slice(0, 8)}`;
};


const normalizeHeaders = (cfg: JsonMap) => {
  const headers = typeof cfg.headers === "string" ? parseJsonObject(cfg.headers) : clone(cfg.headers || {});
  const rows = Array.isArray(cfg.headersRows) ? cfg.headersRows : [];
  rows.forEach((row) => {
    if (!isObject(row)) return;
    const key = trim(row.header);
    if (key) headers[key] = trim(row.value);
  });
  return headers;
};

const buildHttpTask = (node: JsonMap) => {
  const data = isObject(node.data) ? node.data : {};
  const cfg = isObject(data.config) ? data.config : {};
  const refName = resolveRefName(node, "request", ["name", "referenceName", "taskReferenceName"], ["HTTP", "Http"].includes(data.name) ? null : data.name);
  const body =
    typeof cfg.bodyDraftText === "string" && cfg.bodyDraftText.trim()
      ? parseJsonObject(cfg.bodyDraftText, {})
      : cfg.body ?? {};
  return {
    name: "HttpWorker",
    taskReferenceName: refName,
    inputParameters: {
      ...taskMetadata(node, refName),
      method: trim(cfg.method || "POST").toUpperCase(),
      url: cfg.url || "",
      timeout: asNumber(cfg.timeout, 30),
      connection: cfg.connection || "--NONE--",
      headers: normalizeHeaders(cfg),
      body,
    },
    type: "SIMPLE",
  };
};

const buildDatabaseTask = (node: JsonMap) => {
  const data = isObject(node.data) ? node.data : {};
  const cfg = isObject(data.config) ? data.config : {};
  const refName = resolveRefName(
    node,
    "query",
    ["name", "referenceName", "taskReferenceName"],
    ["Database Query", "DATABASE"].includes(data.name) ? null : data.name
  );
  return {
    name: "DatabaseWorker",
    taskReferenceName: refName,
    inputParameters: {
      ...taskMetadata(node, refName),
      queryId: cfg.queryId || "",
      queryName: cfg.queryName || cfg.query || refName,
      datasourceId: cfg.datasourceId || cfg.dataSourceId || DEFAULT_DATABASE_DATASOURCE_ID,
      dataSourceName: cfg.dataSourceName || cfg.datasourceName || cfg.dataSource || "",
      params: clone(cfg.params || {}),
    },
    type: "SIMPLE",
  };
};

const buildScriptTask = (node: JsonMap) => {
  const data = isObject(node.data) ? node.data : {};
  const cfg = isObject(data.config) ? data.config : {};
  const refName = resolveRefName(
    node,
    "script",
    ["reference", "name", "taskReferenceName"],
    ["Script Action", "SCRIPT"].includes(data.name) ? null : data.name
  );
  const variables = typeof cfg.variables === "string" ? parseJsonObject(cfg.variables) : cfg.variables || {};
  return {
    name: "ScriptWorker",
    taskReferenceName: refName,
    inputParameters: {
      ...taskMetadata(node, refName),
      script: trim(cfg.script ?? cfg.expression ?? ""),
      variables: isObject(variables) ? clone(variables) : {},
      language: trim(cfg.language || cfg.scriptLanguage || "JEXL").toUpperCase(),
      timeout: asNumber(cfg.timeout ?? cfg.timeoutMs ?? cfg.timeoutMS, 30000),
    },
    type: "SIMPLE",
  };
};

const buildValidationTask = (node: JsonMap) => {
  const cfg = isObject(node.data?.config) ? node.data.config : {};
  const refName = resolveRefName(node, "validation", ["taskReferenceName", "referenceName", "reference", "name"]);
  const rules = cfg.validationRules ?? cfg.rules ?? cfg.config ?? [];
  return {
    name: "ValidationWorker",
    taskReferenceName: refName,
    inputParameters: { ...taskMetadata(node, refName), rules: Array.isArray(rules) ? clone(rules) : [] },
    type: "SIMPLE",
  };
};

const buildRedisTask = (node: JsonMap) => {
  const cfg = isObject(node.data?.config) ? node.data.config : {};
  const refName = resolveRefName(node, "redis");
  return {
    name: "RedisWorker",
    taskReferenceName: refName,
    inputParameters: {
      ...taskMetadata(node, refName),
      action: cfg.action || "GET",
      key: cfg.key || "",
      value: cfg.value || "",
      datasourceId: cfg.datasourceId || "",
    },
    type: "SIMPLE",
  };
};

const buildRuleEngineTask = (node: JsonMap) => {
  const cfg = isObject(node.data?.config) ? node.data.config : {};
  const refName = resolveRefName(node, "rule");
  return {
    name: "RuleEngineWorker",
    taskReferenceName: refName,
    inputParameters: { ...taskMetadata(node, refName), rules: clone(cfg.rules || []) },
    type: "SIMPLE",
  };
};

const buildWaitTask = (node: JsonMap) => {
  const cfg = isObject(node.data?.config) ? node.data.config : {};
  const refName = resolveRefName(node, "wait");
  const mode = trim(cfg.mode || "DURATION").toUpperCase();
  return {
    name: "wait",
    taskReferenceName: refName,
    inputParameters: {
      ...taskMetadata(node, refName),
      mode,
      duration: cfg.duration || (mode === "DURATION" ? "1 minute" : ""),
      until: cfg.until || "",
    },
    type: "WAIT",
  };
};

const normalizeWorkflowOutput = (output: any) => {
  if (isObject(output)) return clone(output);
  if (typeof output === "string") return parseJsonObject(output);
  return {};
};

const buildTerminateTask = (node: JsonMap) => {
  const cfg = isObject(node.data?.config) ? node.data.config : {};
  const refName = resolveRefName(node, "terminate", ["taskReferenceName", "referenceName", "name"]);
  return {
    name: "terminate",
    taskReferenceName: refName,
    inputParameters: {
      ...taskMetadata(node, refName),
      terminationStatus: trim(cfg.status || cfg.terminationStatus || "COMPLETED").toUpperCase(),
      workflowOutput: normalizeWorkflowOutput(cfg.output ?? cfg.workflowOutput ?? {}),
      terminationReason: cfg.reason || cfg.terminationReason || "Workflow terminated",
    },
    type: "TERMINATE",
  };
};

const normalizeSwitchHandleId = (handleId: any) => trim(handleId) || "default";
const getCaseValue = (caseData: JsonMap, index: number) => trim(caseData.value) || `case_${index + 1}`;

const buildSwitchBaseTask = (node: JsonMap) => {
  const data = isObject(node.data) ? node.data : {};
  const cfg = isObject(data.config) ? data.config : {};
  const refName = resolveRefName(node, "switch", ["name", "referenceName", "taskReferenceName"], ["SWITCH", "Switch"].includes(data.name) ? null : data.name);
  const inputParameters = isObject(cfg.inputParameters) ? cfg.inputParameters : {};
  const evaluatorType = cfg.evaluatorType || "value-param";
  return {
    name: "switch",
    taskReferenceName: refName,
    inputParameters: {
      ...taskMetadata(node, refName),
      switchCaseValue: inputParameters.switchCaseValue || "${workflow.input}",
    },
    type: "SWITCH",
    decisionCases: {},
    defaultCase: [],
    evaluatorType,
    expression: evaluatorType === "value-param" ? "switchCaseValue" : cfg.expression || "",
  };
};

const buildTaskFromNode = (node: JsonMap | undefined) => {
  if (!node || isStartNode(node) || isScopeNode(node)) return null;
  switch (node.type) {
    case "HTTP_ACTION":
      return buildHttpTask(node);
    case "DATABASE_ACTION":
      return buildDatabaseTask(node);
    case "JEXL_ACTION":
    case "SCRIPT_ACTION":
      return buildScriptTask(node);
    case "VALIDATION_ACTION":
      return buildValidationTask(node);
    case "TERMINATE":
    case "terminateAction":
      return buildTerminateTask(node);
    case "SWITCH_ACTION":
      return buildSwitchBaseTask(node);
    case "WAIT_ACTION":
    case "DELAY_ACTION":
      return buildWaitTask(node);
    case "REDIS_ACTION":
      return buildRedisTask(node);
    case "RULE_ENGINE_ACTION":
      return buildRuleEngineTask(node);
    default:
      return null;
  }
};

const dedupeTaskTraversalEdges = (edges: JsonMap[], keyBuilder: (edge: JsonMap) => string) => {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = keyBuilder(edge);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const dedupeSequentialTaskEdges = (edges: JsonMap[]) => dedupeTaskTraversalEdges(edges, (edge) => trim(edge.target));
const dedupeSwitchTaskEdges = (edges: JsonMap[]) =>
  dedupeTaskTraversalEdges(edges, (edge) => `${normalizeSwitchHandleId(edge.sourceHandle)}::${trim(edge.target)}`);

const replaceTaskReferenceAliases = (value: any, aliases: Map<string, string>): any => {
  if (!aliases.size) return clone(value);
  if (typeof value === "string") {
    let nextValue = value;
    aliases.forEach((nextRef, oldRef) => {
      if (oldRef && nextRef && oldRef !== nextRef) {
        nextValue = nextValue.replaceAll(`\${${oldRef}.`, `\${${nextRef}.`);
      }
    });
    return nextValue;
  }
  if (Array.isArray(value)) return value.map((item) => replaceTaskReferenceAliases(item, aliases));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTaskReferenceAliases(item, aliases)]));
  }
  return clone(value);
};

const uniquifyWorkflowTaskReferences = (
  tasks: JsonMap[],
  counts = new Map<string, number>(),
  aliases = new Map<string, string>()
): JsonMap[] =>
  tasks.map((task) => {
    const activeAliases = new Map(aliases);
    const nextTask = replaceTaskReferenceAliases(task, activeAliases);
    const refName = trim(nextTask.taskReferenceName);
    if (refName) {
      const count = counts.get(refName) || 0;
      counts.set(refName, count + 1);
      if (count > 0) {
        const nextRefName = `${refName}_${count}`;
        nextTask.taskReferenceName = nextRefName;
        activeAliases.set(refName, nextRefName);
      }
    }

    if (isObject(nextTask.decisionCases)) {
      nextTask.decisionCases = Object.fromEntries(
        Object.entries(nextTask.decisionCases).map(([caseKey, caseTasks]) => [
          caseKey,
          uniquifyWorkflowTaskReferences(Array.isArray(caseTasks) ? caseTasks : [], counts, new Map(activeAliases)),
        ])
      );
    }
    if (Array.isArray(nextTask.defaultCase)) {
      nextTask.defaultCase = uniquifyWorkflowTaskReferences(nextTask.defaultCase, counts, new Map(activeAliases));
    }
    return nextTask;
  });

const collectScriptTaskRefs = (tasks: JsonMap[]): Set<string> =>
  tasks.reduce<Set<string>>((refs, task) => {
    if (task.name === "ScriptWorker") {
      const ref = trim(task.taskReferenceName);
      if (ref) refs.add(ref);
    }
    if (isObject(task.decisionCases)) {
      Object.values(task.decisionCases).forEach((caseTasks) => {
        if (Array.isArray(caseTasks)) {
          collectScriptTaskRefs(caseTasks).forEach((ref) => refs.add(ref));
        }
      });
    }
    if (Array.isArray(task.defaultCase)) {
      collectScriptTaskRefs(task.defaultCase).forEach((ref) => refs.add(ref));
    }
    return refs;
  }, new Set<string>());

const rewriteScriptOutputReferences = (value: any, scriptRefs: Set<string>): any => {
  if (!scriptRefs.size) return clone(value);
  if (typeof value === "string") {
    let nextValue = value;
    scriptRefs.forEach((ref) => {
      nextValue = nextValue.replaceAll(
        `\${${ref}.output.result}`,
        `\${${ref}.output.result.output}`
      );
    });
    return nextValue;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteScriptOutputReferences(item, scriptRefs));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteScriptOutputReferences(item, scriptRefs)]));
  }
  return clone(value);
};

const normalizeScriptOutputReferences = (tasks: JsonMap[]) =>
  rewriteScriptOutputReferences(tasks, collectScriptTaskRefs(tasks));

const buildNestedWorkflowTasks = (nodes: JsonMap[], edges: JsonMap[]) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoingBySource = new Map<string, JsonMap[]>();
  const incomingTargets = new Set<string>();
  edges.forEach((edge) => {
    const source = trim(edge.source);
    const target = trim(edge.target);
    if (!source || !target) return;
    outgoingBySource.set(source, [...(outgoingBySource.get(source) || []), edge]);
    incomingTargets.add(target);
  });

  const buildBranch = (nodeId: string, visited = new Set<string>()): JsonMap[] => {
    if (!nodeId || visited.has(nodeId)) return [];
    const node = nodeById.get(nodeId);
    const task = buildTaskFromNode(node);
    if (!task || !node) return [];

    const nextVisited = new Set(visited).add(nodeId);
    const outgoing = outgoingBySource.get(nodeId) || [];
    if (node.type !== "SWITCH_ACTION") {
      const nextTasks = dedupeSequentialTaskEdges(outgoing).flatMap((edge) => buildBranch(edge.target, nextVisited));
      return [task, ...nextTasks];
    }

    const cfg = isObject(node.data?.config) ? node.data.config : {};
    const edgesByHandle = new Map<string, JsonMap[]>();
    dedupeSwitchTaskEdges(outgoing).forEach((edge) => {
      const handleId = normalizeSwitchHandleId(edge.sourceHandle);
      edgesByHandle.set(handleId, [...(edgesByHandle.get(handleId) || []), edge]);
    });

    const handledCaseHandles = new Set<string>();
    const decisionCases: JsonMap = {};
    const rawCases = Array.isArray(cfg.cases) ? cfg.cases : [];
    rawCases.forEach((caseData: JsonMap, index: number) => {
      if (!isObject(caseData)) return;
      const handleId = caseData.id || `case-${index}`;
      handledCaseHandles.add(handleId);
      decisionCases[getCaseValue(caseData, index)] = (edgesByHandle.get(handleId) || []).flatMap((edge) =>
        buildBranch(edge.target, nextVisited)
      );
    });

    edgesByHandle.forEach((handleEdges, handleId) => {
      if (handleId === "default" || handledCaseHandles.has(handleId)) return;
      decisionCases[handleId] = handleEdges.flatMap((edge) => buildBranch(edge.target, nextVisited));
    });

    return [
      {
        ...task,
        decisionCases,
        defaultCase: (edgesByHandle.get("default") || []).flatMap((edge) => buildBranch(edge.target, nextVisited)),
      },
    ];
  };

  const startNode = nodes.find((node) => isStartNode(node));
  const startEdges = outgoingBySource.get(startNode?.id || START_NODE_ID) || [];
  if (startEdges.length) {
    return normalizeScriptOutputReferences(
      uniquifyWorkflowTaskReferences(
        dedupeSequentialTaskEdges(startEdges).flatMap((edge) => buildBranch(edge.target, new Set([startNode?.id || START_NODE_ID])))
      )
    );
  }

  return normalizeScriptOutputReferences(
    uniquifyWorkflowTaskReferences(
      nodes
        .filter((node) => !isStartNode(node) && !isScopeNode(node) && !incomingTargets.has(node.id))
        .flatMap((node) => buildBranch(node.id))
    )
  );
};

const readableTextColor = (background: string) => {
  const hexValue = trim(background).replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hexValue)) return "#ffffff";
  const red = parseInt(hexValue.slice(0, 2), 16);
  const green = parseInt(hexValue.slice(2, 4), 16);
  const blue = parseInt(hexValue.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? "#0f172a" : "#ffffff";
};

const edgeTitle = (edge: JsonMap) => {
  const data = isObject(edge.data) ? edge.data : {};
  return trim(data.note || edge.title || (typeof edge.label === "string" ? edge.label : ""));
};
const edgeBackgroundColor = (edge: JsonMap) => {
  const labelBgStyle = isObject(edge.labelBgStyle) ? edge.labelBgStyle : {};
  const style = isObject(edge.style) ? edge.style : {};
  return edge.backgroundColor || labelBgStyle.fill || style.stroke || "#38bdf8";
};
const edgeTextColor = (edge: JsonMap) => {
  const labelStyle = isObject(edge.labelStyle) ? edge.labelStyle : {};
  return edge.color || labelStyle.color || labelStyle.fill || readableTextColor(edgeBackgroundColor(edge));
};

const normalizeActionSourceHandle = (sourceNode: JsonMap | undefined, sourceHandle: unknown) => {
  if (!sourceHandle && isStartNode(sourceNode)) return "workflow-entry-point";
  if (!sourceHandle) return null;
  const handle = trim(sourceHandle);
  const sourceData = isObject(sourceNode?.data) ? sourceNode.data : {};
  const nodeType = trim(sourceNode?.type || sourceData.kind).toUpperCase();
  if (["JEXL_ACTION", "SCRIPT_ACTION"].includes(nodeType) && ["httpResult", "jexlResult"].includes(handle)) {
    return "scriptResult";
  }
  if (nodeType === "DATABASE_ACTION" && ["databaseResult", "databaseOutput"].includes(handle)) {
    return "query-output";
  }
  return handle;
};

const normalizeActionTargetHandle = (targetNode: JsonMap | undefined, targetHandle: unknown) => {
  if (targetHandle) return trim(targetHandle);
  const targetData = isObject(targetNode?.data) ? targetNode.data : {};
  const nodeType = trim(targetNode?.type || targetData.kind).toUpperCase();
  if (nodeType === "DATABASE_ACTION") return "query-input";
  if (nodeType === "TERMINATE") return "terminate-input";
  if (nodeType === "REDIS_ACTION") return "target";
  return null;
};

const normalizeEdges = (edges: JsonMap[], nodes: JsonMap[], idMap: Map<string, string>) => {
  const seenRoutes = new Set<string>();
  const nodesById = new Map(nodes.map((node) => [trim(node.id), node]));
  return edges
    .map((edge) => ({
      id: createUuid(),
      source: mapNodeId(idMap, edge.source),
      target: mapNodeId(idMap, edge.target),
      sourceHandle: normalizeActionSourceHandle(nodesById.get(trim(edge.source)), edge.sourceHandle),
      targetHandle: normalizeActionTargetHandle(nodesById.get(trim(edge.target)), edge.targetHandle),
      title: edgeTitle(edge),
      color: edgeTextColor(edge),
      backgroundColor: edgeBackgroundColor(edge),
    }))
    .filter((edge) => {
      if (!edge.source || !edge.target) return false;
      const routeKey = `${edge.source}::${edge.sourceHandle || ""}::${edge.target}::${edge.targetHandle || ""}`;
      if (seenRoutes.has(routeKey)) return false;
      seenRoutes.add(routeKey);
      return true;
    });
};

const normalizeNodes = (nodes: JsonMap[], idMap: Map<string, string>) =>
  nodes.map((node) => ({
    ...clone(node),
    id: mapNodeId(idMap, node.id),
    ...(node.parentId ? { parentId: mapNodeId(idMap, node.parentId) } : {}),
  }));

const extractWorkflowMetadata = (topology: JsonMap) => {
  const meta = isObject(topology.meta) ? topology.meta : {};
  const startNode = Array.isArray(topology.nodes) ? topology.nodes.find((node) => isStartNode(node)) : null;
  const startData = isObject(startNode?.data) ? startNode.data : {};
  const startConfig = isObject(startData.config) ? startData.config : {};
  const variables = typeof (meta.variables ?? topology.variables) === "string"
    ? parseJsonObject(meta.variables ?? topology.variables)
    : meta.variables ?? topology.variables ?? {};
  
  const rawInputs = isObject(topology._inputs) || Array.isArray(topology._inputs)
    ? topology._inputs
    : isObject(startConfig.inputParameters) || Array.isArray(startConfig.inputParameters)
      ? startConfig.inputParameters
      : {};

  const inputs = Array.isArray(rawInputs)
    ? rawInputs.reduce((acc: JsonMap, key: any) => {
        const trimmedKey = String(key || "").trim();
        if (trimmedKey) acc[trimmedKey] = "";
        return acc;
      }, {})
    : isObject(rawInputs)
      ? rawInputs
      : {};

  return {
    name: meta.workflowName || meta.name || topology.name || startConfig.name || startData.name || "Untitled",
    version: asNumber(meta.version ?? topology.version ?? startConfig.version, 1),
    description: meta.description || topology.description || startConfig.description || "",
    timeoutPolicy: topology.timeoutPolicy || meta.timeoutPolicy || startConfig.timeoutPolicy || "ALERT_ONLY",
    timeoutSeconds: asNumber(topology.timeoutSeconds ?? meta.timeoutSeconds ?? startConfig.timeoutSeconds, 0),
    variables: isObject(variables) ? clone(variables) : {},
    _inputs: clone(inputs),
  };
};

const buildContext = (workflow: JsonMap) => {
  const context: JsonMap = {
    workflow: {
      name: workflow.name,
      version: workflow.version,
      timeoutSeconds: workflow.timeoutSeconds,
      timeoutPolicy: workflow.timeoutPolicy,
      input: clone(workflow._inputs || {}),
    },
  };
  const addTaskRefs = (tasks: JsonMap[]) => {
    tasks.forEach((task) => {
      const ref = trim(task.taskReferenceName);
      if (ref) context[ref] = { output: { result: {} } };
      if (isObject(task.decisionCases)) {
        Object.values(task.decisionCases).forEach((branch) => {
          if (Array.isArray(branch)) addTaskRefs(branch);
        });
      }
      if (Array.isArray(task.defaultCase)) addTaskRefs(task.defaultCase);
    });
  };
  addTaskRefs(workflow.tasks || []);
  return context;
};

export const createDefaultTopologyJson = () => JSON.stringify(DEFAULT_WORKFLOW_INPUT, null, 2);

export const formatJson = (value: any) => JSON.stringify(value, null, 2);

export const convertTopologyToWorkflow = (topology: JsonMap) => {
  if (!isObject(topology) || !Array.isArray(topology.nodes) || !Array.isArray(topology.edges)) {
    throw new Error("Input must be old topology JSON with nodes and edges arrays.");
  }

  const idMap = buildNodeIdMap(topology.nodes);
  const normalizedNodes = normalizeNodes(topology.nodes, idMap);
  const normalizedEdges = normalizeEdges(topology.edges, topology.nodes, idMap);
  const metadata = extractWorkflowMetadata(topology);
  const workflow: JsonMap = {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    ownerEmail: OWNER_EMAIL,
    timeoutPolicy: metadata.timeoutPolicy,
    _inputs: metadata._inputs,
    timeoutSeconds: metadata.timeoutSeconds,
    variables: metadata.variables,
    _builderSchemaVersion: 2,
    tasks: buildNestedWorkflowTasks(normalizedNodes, normalizedEdges),
    edges: normalizedEdges,
    schemaVersion: 2,
    restartable: false,
    metadata: {},
  };
  workflow.context = buildContext(workflow);
  return workflow;
};
