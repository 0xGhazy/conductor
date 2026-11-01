import { createUuid } from "@/utils/uuid";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";
import { isScopeNode } from "@/features/designer/services/scopeGraph";
import {
  serializeHttpNodeForJson,
} from "@/features/designer/components/node-panel/definitions/http";
import { getUserProfile } from "@/features/auth";
import {
  exportTerminateActionData,
} from "@/features/designer/components/actions/terminate";
import {
  exportRespondTasks,
} from "@/features/designer/components/actions/respond";
import {
  exportDatabaseActionData,
} from "@/features/designer/components/actions/DatabaseActionNode";
import {
  exportJexlActionData,
} from "@/features/designer/components/actions/script";
import {
  exportValidationActionData,
} from "@/features/designer/components/actions/validation";
import {
  exportSwitchActionData,
} from "@/features/designer/components/actions/switch";
import {
  exportWaitActionData,
} from "@/features/designer/components/actions/wait";
import {
  exportForEachActionData,
} from "@/features/designer/components/actions/foreach";
import {
  exportRedisActionData,
} from "@/features/designer/components/actions/redis";
import {
  exportRuleEngineActionData,
} from "@/features/designer/components/actions/rule-engine";
import {
  isStartNode,
  isStartNodeId,
  isEndNode,
  END_NODE_ID,
  buildEdgeId,
  resolveEdgeId,
  getSwitchCaseKey,
  normalizeSwitchHandleId,
  dedupeSequentialTaskEdges,
  dedupeSwitchTaskEdges,
  DEFAULT_START_TIMEOUT_SECONDS,
} from "./designerGraphUtils";

export const replaceTaskReferenceAliases = (value: any, aliases: Map<string, string>): any => {
  if (!value || aliases.size === 0) return value;
  if (typeof value === "string") {
    let nextValue = value;
    aliases.forEach((nextRef, oldRef) => {
      if (!oldRef || !nextRef || oldRef === nextRef) return;
      nextValue = nextValue.split(`\${${oldRef}.`).join(`\${${nextRef}.`);
    });
    return nextValue;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceTaskReferenceAliases(item, aliases));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceTaskReferenceAliases(item, aliases),
      ])
    );
  }
  return value;
};

export const isStrippedNodeMetadataKey = (key: string): boolean =>
  key.startsWith("_") && !key.startsWith("__");

export const stripNodeMetadataFromTask = (task: any): any => {
  if (!task || typeof task !== "object") return task;

  if (Array.isArray(task)) {
    return task.map(stripNodeMetadataFromTask);
  }

  const nextTask = { ...task };

  for (const key of Object.keys(nextTask)) {
    if (isStrippedNodeMetadataKey(key)) {
      delete nextTask[key];
    }
  }

  if (
    nextTask.inputParameters &&
    typeof nextTask.inputParameters === "object" &&
    !Array.isArray(nextTask.inputParameters)
  ) {
    const nextInputParams = { ...nextTask.inputParameters };
    for (const key of Object.keys(nextInputParams)) {
      if (isStrippedNodeMetadataKey(key)) {
        delete nextInputParams[key];
      }
    }
    nextTask.inputParameters = nextInputParams;
  }

  if (nextTask.decisionCases && typeof nextTask.decisionCases === "object") {
    nextTask.decisionCases = Object.fromEntries(
      Object.entries(nextTask.decisionCases).map(([caseKey, caseTasks]) => [
        caseKey,
        Array.isArray(caseTasks)
          ? caseTasks.map(stripNodeMetadataFromTask)
          : stripNodeMetadataFromTask(caseTasks),
      ])
    );
  }

  if (Array.isArray(nextTask.defaultCase)) {
    nextTask.defaultCase = nextTask.defaultCase.map(stripNodeMetadataFromTask);
  }

  if (Array.isArray(nextTask.loopOver)) {
    nextTask.loopOver = nextTask.loopOver.map(stripNodeMetadataFromTask);
  }

  if (Array.isArray(nextTask.forkTasks)) {
    nextTask.forkTasks = nextTask.forkTasks.map((branch: any) =>
      Array.isArray(branch)
        ? branch.map(stripNodeMetadataFromTask)
        : stripNodeMetadataFromTask(branch)
    );
  }

  return nextTask;
};

export const uniquifyWorkflowTaskReferences = (
  tasks: any[] = [],
  counts = new Map<string, number>(),
  aliases = new Map<string, string>()
): any[] => {
  const activeAliases = new Map(aliases);
  return (tasks || []).map((task) => {
    const nextTask = replaceTaskReferenceAliases(task, activeAliases);
    const refName = String(nextTask?.taskReferenceName || "").trim();

    if (refName) {
      const count = counts.get(refName) || 0;
      counts.set(refName, count + 1);
      if (count > 0) {
        const nextRefName = `${refName}_${count}`;
        nextTask.taskReferenceName = nextRefName;
        activeAliases.set(refName, nextRefName);
      }
    }

    if (nextTask?.decisionCases && typeof nextTask.decisionCases === "object") {
      nextTask.decisionCases = Object.fromEntries(
        Object.entries(nextTask.decisionCases).map(([caseKey, caseTasks]) => [
          caseKey,
          uniquifyWorkflowTaskReferences(caseTasks as any[], counts, new Map(activeAliases)),
        ])
      );
    }
    if (Array.isArray(nextTask?.defaultCase)) {
      nextTask.defaultCase = uniquifyWorkflowTaskReferences(
        nextTask.defaultCase,
        counts,
        new Map(activeAliases)
      );
    }

    return nextTask;
  });
};

export const buildWorkflowTaskFromNode = (node: any): any => {
  if (!node || isStartNode(node) || isScopeNode(node) || isEndNode(node)) {
    return null;
  }

  let task: any = null;
  switch (node.type) {
    case "HTTP_ACTION":
    case "HTTPACTION":
    case "httpAction":
      task = serializeHttpNodeForJson(node);
      break;
    case "DATABASE_ACTION":
      task = exportDatabaseActionData(node.data, node.id, node.position);
      break;
    case "JEXL_ACTION":
    case "SCRIPT_ACTION":
      task = exportJexlActionData(node.data, node.id, node.position);
      break;
    case "VALIDATION_ACTION":
      task = exportValidationActionData(node.data, node.id, node.position);
      break;
    case "TERMINATE":
    case "terminateAction":
      task = exportTerminateActionData(node.data, node.id, node.position);
      break;
    case "RESPOND":
    case "RESPOND_ACTION":
    case "respondAction":
      task = exportRespondTasks(node.data, node.id, node.position);
      break;
    case "SWITCH_ACTION":
      task = exportSwitchActionData(node.data, node.id, node.position);
      break;
    case "WAIT_ACTION":
    case "DELAY_ACTION":
      task = exportWaitActionData(node.data, node.id, node.position);
      break;
    case "FOREACH_ACTION":
    case "FOREACH":
      task = exportForEachActionData(node.data, node.id, node.position);
      break;
    case "REDIS_ACTION":
      task = exportRedisActionData(node.data, node.id, node.position);
      break;
    case "RULE_ENGINE_ACTION":
      task = exportRuleEngineActionData(node.data, node.id, node.position);
      break;
    default:
      return null;
  }

  return stripNodeMetadataFromTask(task);
};


export const buildNestedWorkflowTasksFromGraph = (nodes: any[] = [], edges: any[] = []): any[] => {
  const nodeById = new Map<string, any>(nodes.map((node) => [node.id, node]));
  const outgoingBySource = new Map<string, any[]>();
  const incomingTargets = new Set<string>();

  edges.forEach((edge) => {
    if (!edge?.source || !edge?.target) return;
    if (!outgoingBySource.has(edge.source)) outgoingBySource.set(edge.source, []);
    outgoingBySource.get(edge.source)!.push(edge);
    incomingTargets.add(edge.target);
  });

  const buildBranch = (nodeId: string, visited = new Set<string>()): any[] => {
    if (!nodeId || visited.has(nodeId)) return [];

    const node = nodeById.get(nodeId);
    const task = buildWorkflowTaskFromNode(node);
    if (!task) return [];

    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);

    const outgoing = outgoingBySource.get(nodeId) || [];
    if (node.type === "FOREACH_ACTION" || node.type === "FOREACH") {
      const loopBodyEdges = outgoing.filter(
        (edge) =>
          edge.sourceHandle === "loopBody" ||
          edge.sourceHandle === "loop" ||
          edge.sourceHandle === "body"
      );
      const nextEdges = outgoing.filter(
        (edge) =>
          edge.sourceHandle === "next" ||
          edge.sourceHandle === "default" ||
          edge.sourceHandle === "onComplete"
      );

      let resolvedLoopEdges = loopBodyEdges;
      let resolvedNextEdges = nextEdges;
      if (loopBodyEdges.length === 0 && nextEdges.length === 0 && outgoing.length > 0) {
        if (task && Array.isArray((task as any).loopOver) && (task as any).loopOver.length > 0) {
          resolvedNextEdges = outgoing;
        } else {
          resolvedLoopEdges = [outgoing[0]];
          resolvedNextEdges = outgoing.slice(1);
        }
      }

      const loopBodyTasks = dedupeSequentialTaskEdges(resolvedLoopEdges).flatMap((edge) =>
        buildBranch(edge.target, nextVisited)
      );

      const nextTasks = dedupeSequentialTaskEdges(resolvedNextEdges).flatMap((edge) =>
        buildBranch(edge.target, nextVisited)
      );

      const compiledTask = {
        ...task,
        loopOver: loopBodyTasks.length > 0 ? loopBodyTasks : ((task as any)?.loopOver || []),
      };

      return [compiledTask, ...nextTasks];
    }

    if (node.type !== "SWITCH_ACTION") {
      const nextTasks = dedupeSequentialTaskEdges(outgoing).flatMap((edge) =>
        buildBranch(edge.target, nextVisited)
      );
      return Array.isArray(task) ? [...task, ...nextTasks] : [task, ...nextTasks];
    }

    const edgesByHandle = new Map<string, any[]>();
    dedupeSwitchTaskEdges(outgoing).forEach((edge) => {
      const handleId = normalizeSwitchHandleId(edge.sourceHandle);
      if (!edgesByHandle.has(handleId)) edgesByHandle.set(handleId, []);
      edgesByHandle.get(handleId)!.push(edge);
    });

    const cases =
      node?.data?.config?.cases ?? node?.data?.config?.config?.cases ?? [];
    const handledCaseHandles = new Set<string>();
    const decisionCases: Record<string, any[]> = {};

    cases.forEach((caseData: any, index: number) => {
      const handleId = caseData?.id || `case-${index}`;
      const caseKey = getSwitchCaseKey(caseData, index);
      handledCaseHandles.add(handleId);
      decisionCases[caseKey] = (edgesByHandle.get(handleId) || []).flatMap((edge) =>
        buildBranch(edge.target, nextVisited)
      );
    });

    edgesByHandle.forEach((handleEdges, handleId) => {
      if (handleId === "default" || handledCaseHandles.has(handleId)) return;
      decisionCases[handleId] = handleEdges.flatMap((edge) =>
        buildBranch(edge.target, nextVisited)
      );
    });

    const defaultCase = (edgesByHandle.get("default") || []).flatMap((edge) =>
      buildBranch(edge.target, nextVisited)
    );

    return [
      {
        ...task,
        decisionCases,
        defaultCase,
      },
    ];
  };

  const startNode = nodes.find((node) => isStartNode(node));
  const startNodeId = startNode?.id || START_NODE_ID;
  const startEdges = outgoingBySource.get(startNodeId) || [];
  const rawTasks =
    startEdges.length > 0
      ? uniquifyWorkflowTaskReferences(
          dedupeSequentialTaskEdges(startEdges).flatMap((edge) =>
            buildBranch(edge.target, new Set([startNodeId]))
          )
        )
      : uniquifyWorkflowTaskReferences(
          nodes
            .filter(
              (node) =>
                !isStartNode(node) &&
                !isScopeNode(node) &&
                !incomingTargets.has(node.id)
            )
            .flatMap((node) => buildBranch(node.id, new Set()))
        );

  return rawTasks.map(stripNodeMetadataFromTask);
};


export const isWorkflowDtoJson = (jsonData: any): boolean =>
  jsonData &&
  typeof jsonData === "object" &&
  Array.isArray(jsonData.tasks) &&
  !Array.isArray(jsonData.nodes);

export const stripTaskMetadataParameters = (inputParameters: Record<string, any> = {}): Record<string, any> =>
  Object.entries(inputParameters || {}).reduce((acc, [key, value]) => {
    if (!String(key).startsWith("_")) acc[key] = value;
    return acc;
  }, {} as Record<string, any>);

export const flattenWorkflowDtoTasks = (tasks: any[] = [], result: any[] = []): any[] => {
  (tasks || []).forEach((task) => {
    if (!task || typeof task !== "object") return;
    result.push(task);

    if (task.decisionCases && typeof task.decisionCases === "object") {
      Object.values(task.decisionCases).forEach((caseTasks) => {
        if (Array.isArray(caseTasks)) flattenWorkflowDtoTasks(caseTasks, result);
      });
    }

    if (Array.isArray(task.defaultCase)) {
      flattenWorkflowDtoTasks(task.defaultCase, result);
    }

    if (Array.isArray(task.loopOver)) {
      flattenWorkflowDtoTasks(task.loopOver, result);
    } else if (Array.isArray(task.body)) {
      flattenWorkflowDtoTasks(task.body, result);
    }
  });
  return result;
};

export const resolveWorkflowDtoTaskNodeType = (task: any = {}): string => {
  const taskName = String(task.name || "").trim().toLowerCase();
  const taskType = String(task.type || "").trim().toUpperCase();
  const refName = String(task.taskReferenceName || "").trim().toLowerCase();
  if (
    taskName === "respondworker" ||
    taskName === "respond" ||
    refName.startsWith("respond_")
  ) {
    return "RESPOND_ACTION";
  }
  if (taskType === "TERMINATE" || taskName === "terminate") return "TERMINATE";
  if (taskType === "SWITCH" || taskName === "switch") return "SWITCH_ACTION";
  if (taskType === "WAIT" || taskName === "wait") return "WAIT_ACTION";
  if (
    taskType === "FOREACH" ||
    taskName === "foreach" ||
    taskName === "weaver_foreach" ||
    refName.startsWith("foreach_")
  ) {
    return "FOREACH_ACTION";
  }
  if (taskName === "httpworker") return "HTTP_ACTION";
  if (taskName === "databaseworker") return "DATABASE_ACTION";
  if (taskName === "redisworker") return "REDIS_ACTION";
  if (taskName === "validationworker") return "VALIDATION_ACTION";
  if (taskName === "ruleengineworker") return "RULE_ENGINE_ACTION";
  if (taskName === "scriptworker") {
    return refName.startsWith("jexl_") || refName.startsWith("jexl_expr_")
      ? "JEXL_ACTION"
      : "SCRIPT_ACTION";
  }

  return "SCRIPT_ACTION";
};

export const resolveWorkflowDtoTaskNodeName = (task: any = {}, nodeType: string): string => {
  const namesByType: Record<string, string> = {
    HTTP_ACTION: "HTTP",
    DATABASE_ACTION: "Query",
    REDIS_ACTION: "Redis",
    VALIDATION_ACTION: "Validation",
    RULE_ENGINE_ACTION: "Rule Engine",
    JEXL_ACTION: "JEXL",
    SCRIPT_ACTION: "Script",
    SWITCH_ACTION: "Switch",
    WAIT_ACTION: "Wait",
    FOREACH_ACTION: "ForEach",
    FOREACH: "ForEach",
    TERMINATE: "Terminate",
    RESPOND: "Respond",
    RESPOND_ACTION: "Respond",
    respondAction: "Respond",
  };
  return task.name || namesByType[nodeType] || "Action";
};

export const getWorkflowDtoTaskRef = (task: any = {}): string =>
  String(
    task.taskReferenceName ||
    task.referenceName ||
    task.name ||
    ""
  ).trim();

export const parseWorkflowDtoNodePosition = (_task: any = {}, index = 0): { x: number; y: number } => {
  return {
    x: 440 + (index % 4) * 260,
    y: 160 + Math.floor(index / 4) * 170,
  };
};

export const resolveWorkflowDtoTaskNodeId = (_task: any = {}, usedIds = new Set<string>()): string => {
  let nodeId = createUuid();
  while (usedIds.has(nodeId)) {
    nodeId = createUuid();
  }
  usedIds.add(nodeId);
  return nodeId;
};

export const getFirstWorkflowDtoBranchRef = (tasks: any[] = []): string => {
  const firstTask = Array.isArray(tasks) ? tasks.find((item) => item && typeof item === "object") : null;
  return firstTask ? getWorkflowDtoTaskRef(firstTask) : "";
};

export const buildSwitchCasesFromWorkflowDto = (
  task: any = {},
  outgoingEdges: any[] = [],
  taskRefToNodeId = new Map<string, string>()
): any[] => {
  const decisionCaseKeys =
    task.decisionCases && typeof task.decisionCases === "object"
      ? Object.keys(task.decisionCases)
      : [];
  const caseEdges = outgoingEdges.filter(
    (edge) => normalizeSwitchHandleId(edge.sourceHandle) !== "default"
  );
  const seenHandles = new Set<string>();

  if (caseEdges.length > 0) {
    return caseEdges.reduce((cases, edge, index) => {
      const handleId = normalizeSwitchHandleId(edge.sourceHandle);
      if (!handleId || seenHandles.has(handleId)) return cases;
      seenHandles.add(handleId);
      const matchedCaseKey = decisionCaseKeys.find((caseKey) => {
        const branchRef = getFirstWorkflowDtoBranchRef(task.decisionCases?.[caseKey]);
        return branchRef && taskRefToNodeId.get(branchRef) === edge.target;
      });
      const value =
        matchedCaseKey ||
        decisionCaseKeys[index] ||
        String(edge.title || edge.label || handleId).trim() ||
        `case_${index + 1}`;
      cases.push({
        id: handleId,
        value,
        label: String(edge.title || edge.label || value).trim(),
      });
      return cases;
    }, [] as any[]);
  }

  return decisionCaseKeys.map((key, index) => ({
    id: `case-${index}`,
    value: key,
    label: key,
  }));
};

export const buildWorkflowDtoTaskConfig = (
  task: any = {},
  nodeType: string,
  outgoingEdges: any[] = [],
  taskRefToNodeId = new Map<string, string>()
): Record<string, any> => {
  const inputParameters = task.inputParameters || {};
  const refName = getWorkflowDtoTaskRef(task);
  const baseConfig: Record<string, any> = {
    ...stripTaskMetadataParameters(inputParameters),
    name: refName,
    referenceName: refName,
    reference: refName,
    taskReferenceName: refName,
    inputParameters,
  };

  if (nodeType === "TERMINATE") {
    return {
      ...baseConfig,
      status: inputParameters.terminationStatus || "COMPLETED",
      output: inputParameters.workflowOutput ?? {},
      reason: inputParameters.terminationReason || "Workflow terminated",
    };
  }

  if (nodeType === "RESPOND_ACTION" || nodeType === "RESPOND" || nodeType === "respondAction") {
    const wfOutput = inputParameters.workflowOutput || {};
    return {
      ...baseConfig,
      name: refName,
      referenceName: refName,
      reference: refName,
      taskReferenceName: refName,
      messageCode: wfOutput.responseCode || inputParameters.messageCode || "",
      languageCode: wfOutput.languageCode || inputParameters.languageCode || "${workflow.input._language}",
      previewText: wfOutput.message || inputParameters.previewText || "",
      terminationReason: inputParameters.terminationReason || "Workflow responded to client",
    };
  }

  if (nodeType === "VALIDATION_ACTION") {
    return {
      ...baseConfig,
      validationRules: inputParameters.rules || [],
      rules: inputParameters.rules || [],
    };
  }

  if (nodeType === "RULE_ENGINE_ACTION") {
    return {
      ...baseConfig,
      rules: inputParameters.rules || [],
    };
  }

  if (nodeType === "SWITCH_ACTION") {
    const evaluatorType = task.evaluatorType || "value-param";
    return {
      ...baseConfig,
      evaluatorType,
      expression: task.expression || "",
      inputParameters,
      cases: buildSwitchCasesFromWorkflowDto(task, outgoingEdges, taskRefToNodeId),
      decisionCases: task.decisionCases || {},
      defaultCase: task.defaultCase || [],
    };
  }

  if (nodeType === "WAIT_ACTION") {
    return {
      ...baseConfig,
      mode: inputParameters.mode || "DURATION",
      duration: inputParameters.duration || "1 minute",
      until: inputParameters.until || "",
    };
  }

  if (nodeType === "FOREACH_ACTION" || nodeType === "FOREACH") {
    return {
      ...baseConfig,
      collection: inputParameters.collection || inputParameters.collectionExpression || "${workflow.input.items}",
      collectionExpression: inputParameters.collectionExpression || inputParameters.collection || "${workflow.input.items}",
      itemVariable: inputParameters.itemVariable || "item",
      indexVariable: inputParameters.indexVariable || "index",
      executionMode: inputParameters.executionMode || "PARALLEL",
      errorStrategy: inputParameters.errorStrategy || "FAIL_FAST",
      maxIterations: inputParameters.maxIterations !== undefined ? Number(inputParameters.maxIterations) : 1000,
      preserveOrder: inputParameters.preserveOrder !== false,
      loopOver: Array.isArray(task.loopOver) ? task.loopOver : Array.isArray(task.body) ? task.body : [],
    };
  }

  if (nodeType === "SCRIPT_ACTION" || nodeType === "JEXL_ACTION") {
    return {
      ...baseConfig,
      expression: inputParameters.script || "",
      variables: inputParameters.variables || {},
      language: inputParameters.language || "JEXL",
      timeout: inputParameters.timeout || 30000,
    };
  }

  if (nodeType === "DATABASE_ACTION") {
    const dataSourceId = inputParameters.datasourceId || inputParameters.dataSourceId || "";
    const dataSourceName =
      inputParameters.dataSourceName ||
      inputParameters.datasourceName ||
      inputParameters.dataSource ||
      dataSourceId;
    const queryName =
      inputParameters.queryName ||
      inputParameters.query ||
      refName;
    return {
      ...baseConfig,
      datasourceId: dataSourceId,
      dataSourceId,
      dataSourceName,
      queryId: inputParameters.queryId || "",
      queryName,
      params: inputParameters.params || {},
    };
  }

  return baseConfig;
};

export const resolveWorkflowDtoDefaultSourceHandle = (nodeType: string): string | null => {
  if (nodeType === "DATABASE_ACTION") return "query-output";
  if (nodeType === "SCRIPT_ACTION" || nodeType === "JEXL_ACTION") return "scriptResult";
  if (nodeType === "HTTP_ACTION") return "httpResult";
  if (nodeType === "FOREACH_ACTION" || nodeType === "FOREACH") return "next";
  return null;
};

export const extractWorkflowImportMetadata = (jsonData: any = {}): {
  workflowName: string;
  version: any;
  description: string;
  correlationId: string;
  language: string;
  variables: Record<string, any>;
  inputs: Record<string, any>;
  timeoutSeconds: number;
  timeoutPolicy: string;
  workflowId: string;
  supportedLanguages: string[];
} => {
  const meta = jsonData?.meta || {};
  const startNode = Array.isArray(jsonData?.nodes)
    ? jsonData.nodes.find((node: any) => node?.type === "startFlag" || isStartNodeId(node?.id))
    : null;
  const startConfig = startNode?.data?.config || {};
  const topLevelVariables =
    jsonData?.variables && typeof jsonData.variables === "object"
      ? jsonData.variables
      : {};

  const rawInputs =
    jsonData?._inputs && typeof jsonData._inputs === "object"
      ? jsonData._inputs
      : jsonData?.inputParameters && typeof jsonData.inputParameters === "object"
        ? jsonData.inputParameters
        : startConfig.inputParameters && typeof startConfig.inputParameters === "object"
          ? startConfig.inputParameters
        : {};

  const parsedInputs = Array.isArray(rawInputs)
    ? rawInputs.reduce((acc, key) => {
        const trimmedKey = String(key || "").trim();
        if (trimmedKey) acc[trimmedKey] = "";
        return acc;
      }, {} as Record<string, any>)
    : rawInputs && typeof rawInputs === "object"
      ? rawInputs
      : {};

  const rawSupportedLanguages =
    meta.supported_languages ??
    meta.supportedLanguages ??
    jsonData.supported_languages ??
    jsonData.supportedLanguages ??
    jsonData.metadata?.supported_languages ??
    startConfig.supportedLanguages ??
    startConfig.supported_languages ??
    [];
  const supportedLanguages = Array.isArray(rawSupportedLanguages)
    ? rawSupportedLanguages.map((l: any) => String(l).trim()).filter(Boolean)
    : [];

  return {
    workflowName: meta.workflowName || meta.name || jsonData.name || startConfig.name || startNode?.data?.name || "",
    version: meta.version ?? jsonData.version ?? startConfig.version ?? 1,
    description: meta.description ?? jsonData.description ?? startConfig.description ?? "",
    correlationId: meta.correlationId ?? jsonData.correlationId ?? "",
    language:
      meta.default_language ??
      meta.defaultLanguage ??
      jsonData.metadata?.default_language ??
      jsonData.metadata?.defaultLanguage ??
      meta.language ??
      jsonData.language ??
      startConfig.language ??
      "",
    variables: meta.variables ?? topLevelVariables ?? startConfig.variables ?? {},
    inputs: parsedInputs,
    timeoutSeconds: (() => {
      const rawTimeout = jsonData.timeoutSeconds ?? meta.timeoutSeconds ?? startConfig.timeoutSeconds;
      const parsedTimeout = Number(rawTimeout);
      return Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : DEFAULT_START_TIMEOUT_SECONDS;
    })(),
    timeoutPolicy: jsonData.timeoutPolicy ?? meta.timeoutPolicy ?? startConfig.timeoutPolicy ?? "TIME_OUT_WF",
    workflowId: meta.workflowId || meta.id || jsonData.id || "",
    supportedLanguages,
  };
};

export const normalizeWorkflowDtoJsonToTopology = (jsonData: any = {}): any => {
  if (!isWorkflowDtoJson(jsonData)) return jsonData;

  const metadata = extractWorkflowImportMetadata(jsonData);
  const flatTasks = flattenWorkflowDtoTasks(jsonData.tasks);
  const isCompanionTerminate = (task: any) => {
    const taskName = String(task?.name || "").trim().toLowerCase();
    const taskType = String(task?.type || "").trim().toUpperCase();
    const refName = String(task?.taskReferenceName || "").trim().toLowerCase();
    const output = String(task?.inputParameters?.workflowOutput || "");

    return (
      (taskType === "TERMINATE" || taskName === "terminate") &&
      (refName.startsWith("terminate_respond_") || output.includes(".output}"))
    );
  };
  const filteredTasks = flatTasks.filter((task) => !isCompanionTerminate(task));
  const usedIds = new Set<string>([START_NODE_ID]);
  const taskRefToNodeId = new Map<string, string>();
  const taskNodeEntries = filteredTasks.map((task, index) => {
    const nodeType = resolveWorkflowDtoTaskNodeType(task);
    const nodeId = resolveWorkflowDtoTaskNodeId(task, usedIds);
    const taskRef = getWorkflowDtoTaskRef(task);
    if (taskRef) {
      taskRefToNodeId.set(taskRef, nodeId);
      if (nodeType === "RESPOND_ACTION") {
        taskRefToNodeId.set(`terminate_${taskRef}`, nodeId);
      }
    }
    return { task, index, nodeType, nodeId, taskRef };
  });

  const rawEdges = Array.isArray(jsonData.edges) ? jsonData.edges : [];
  const taskTypeByNodeId = new Map(taskNodeEntries.map(({ nodeId, nodeType }) => [nodeId, nodeType]));
  const resolveEndpointId = (value: unknown): string => {
    const raw = String(value || "").trim();
    if (!raw) return raw;
    if (isStartNodeId(raw)) return START_NODE_ID;
    return taskRefToNodeId.get(raw) || raw;
  };
  const resolveSourceHandle = (sourceId: string, sourceHandle: string | null) => {
    if (!sourceHandle && isStartNodeId(sourceId)) return "workflow-entry-point";
    if (!sourceHandle) return null;
    const nodeType = taskTypeByNodeId.get(sourceId);
    if (nodeType && ["JEXL_ACTION", "SCRIPT_ACTION"].includes(nodeType) && ["httpResult", "jexlResult"].includes(sourceHandle)) {
      return "scriptResult";
    }
    if (nodeType === "DATABASE_ACTION" && ["databaseResult", "databaseOutput"].includes(sourceHandle)) {
      return "query-output";
    }
    return sourceHandle;
  };
  const resolveTargetHandle = (targetId: string, targetHandle: string | null) => {
    if (targetHandle) return targetHandle;
    const nodeType = taskTypeByNodeId.get(targetId);
    if (nodeType === "DATABASE_ACTION") return "query-input";
    if (nodeType === "TERMINATE") return "terminate-input";
    if (nodeType === "RESPOND" || nodeType === "RESPOND_ACTION" || nodeType === "respondAction") return "respond-input";
    if (nodeType === "REDIS_ACTION") return "target";
    return null;
  };
  const normalizedEdges = rawEdges.map((edge: any) => ({
    ...edge,
    id: resolveEdgeId(edge),
    source: resolveEndpointId(edge.source),
    target: resolveEndpointId(edge.target),
    sourceHandle: resolveSourceHandle(resolveEndpointId(edge.source), edge.sourceHandle),
    targetHandle: resolveTargetHandle(resolveEndpointId(edge.target), edge.targetHandle),
    title: edge.title || "",
    color: edge.color || undefined,
    backgroundColor: edge.backgroundColor || undefined,
  }));
  const buildGeneratedWorkflowDtoEdges = (): any[] => {
    const generatedEdges: any[] = [];
    const appendEdge = (source: string, target: string, sourceHandle: string | null = null, targetHandle: string | null = null) => {
      // A Respond task's companion `terminate_<ref>` maps to the Respond node itself; never link a node to itself.
      if (!source || !target || source === target) return;
      generatedEdges.push({
        id: buildEdgeId(),
        source,
        target,
        sourceHandle,
        targetHandle: resolveTargetHandle(target, targetHandle),
        title: "",
      });
    };

    const buildSequenceEdges = (tasks: any[] = [], initialSourceId = START_NODE_ID, initialSourceHandle = "workflow-entry-point") => {
      let previousTask: any = null;
      let previousNodeId = initialSourceId;
      let previousSourceHandle = initialSourceHandle;

      (Array.isArray(tasks) ? tasks : []).forEach((task) => {
        const taskRef = getWorkflowDtoTaskRef(task);
        const nodeId = taskRefToNodeId.get(taskRef);
        if (!nodeId) return;

        appendEdge(previousNodeId, nodeId, previousSourceHandle, null);

        const nodeType = resolveWorkflowDtoTaskNodeType(task);
        if (nodeType === "SWITCH_ACTION") {
          const caseKeys =
            task.decisionCases && typeof task.decisionCases === "object"
              ? Object.keys(task.decisionCases)
              : [];
          caseKeys.forEach((caseKey, index) => {
            const branchTasks = Array.isArray(task.decisionCases?.[caseKey])
              ? task.decisionCases[caseKey]
              : [];
            buildSequenceEdges(branchTasks, nodeId, `case-${index}`);
          });

          const defaultTasks = Array.isArray(task.defaultCase) ? task.defaultCase : [];
          buildSequenceEdges(defaultTasks, nodeId, "default");
        }

        if (nodeType === "FOREACH_ACTION" || nodeType === "FOREACH") {
          const loopTasks = Array.isArray(task.loopOver)
            ? task.loopOver
            : Array.isArray(task.body)
              ? task.body
              : [];
          buildSequenceEdges(loopTasks, nodeId, "loopBody");
        }

        previousTask = task;
        previousNodeId = nodeId;
        previousSourceHandle = resolveWorkflowDtoDefaultSourceHandle(nodeType);
      });
    };

    buildSequenceEdges(jsonData.tasks);
    return generatedEdges;
  };
  const workflowDtoEdges =
    normalizedEdges.length > 0 ? normalizedEdges : buildGeneratedWorkflowDtoEdges();
  const outgoingEdgesBySource = new Map<string, any[]>();
  workflowDtoEdges.forEach((edge) => {
    if (!outgoingEdgesBySource.has(edge.source)) outgoingEdgesBySource.set(edge.source, []);
    outgoingEdgesBySource.get(edge.source)!.push(edge);
  });

  const taskNodes = taskNodeEntries.map(({ task, index, nodeType, nodeId }) => ({
    id: nodeId,
    type: nodeType,
    position: parseWorkflowDtoNodePosition(task, index),
    data: {
      kind: nodeType,
      name: resolveWorkflowDtoTaskNodeName(task, nodeType),
      config: buildWorkflowDtoTaskConfig(
        task,
        nodeType,
        outgoingEdgesBySource.get(nodeId) || [],
        taskRefToNodeId
      ),
    },
  }));

  const edges =
    workflowDtoEdges.length > 0
      ? workflowDtoEdges
      : taskNodes.map((node, index) => ({
        id: buildEdgeId(),
        source: index === 0 ? START_NODE_ID : taskNodes[index - 1]?.id,
        target: node.id,
        sourceHandle: index === 0 ? "workflow-entry-point" : null,
        targetHandle: null,
        title: "",
      })).filter((edge) => edge.source && edge.target);

  const hasStartEdge = edges.some((edge) => isStartNodeId(edge.source));
  const finalEdges =
    hasStartEdge || taskNodes.length === 0
      ? edges
      : [
        {
          id: buildEdgeId(),
          source: START_NODE_ID,
          target: taskNodes[0].id,
          sourceHandle: "workflow-entry-point",
          targetHandle: null,
          title: "",
        },
        ...edges,
      ];

  return {
    meta: {
      workflowName: metadata.workflowName,
      name: metadata.workflowName,
      version: metadata.version,
      description: metadata.description,
      correlationId: metadata.correlationId,
      language: metadata.language,
      supportedLanguages: metadata.supportedLanguages,
      supported_languages: metadata.supportedLanguages,
      variables: metadata.variables,
      id: metadata.workflowId || null,
    },
    nodes: [
      {
        id: START_NODE_ID,
        type: "startFlag",
        position: { x: 220, y: 140 },
        data: {
          name: metadata.workflowName || "Start",
          kind: "START_FLAG",
          config: {
            name: metadata.workflowName || "",
            version: metadata.version,
            description: metadata.description,
            language: metadata.language,
            supportedLanguages: metadata.supportedLanguages ?? [],
            timeoutSeconds: metadata.timeoutSeconds,
            timeoutPolicy: metadata.timeoutPolicy,
            inputParameters: metadata.inputs,
            variables: metadata.variables ?? {},
          },
        },
        draggable: false,
        selectable: true,
      },
      ...taskNodes,
      ...(taskNodes.some((n: any) => isEndNode(n))
        ? []
        : [
            {
              id: END_NODE_ID,
              type: "endFlag",
              position: { x: 220, y: 350 },
              data: {
                name: "End",
              },
              draggable: false,
              selectable: false,
            },
          ]),
    ],
    edges: finalEdges,
  };
};

export const extractWorkflowJsonDataFromResponse = (response: any): any => {
  const workflow = response?.data ?? response ?? null;
  if (!workflow) {
    throw new Error("Workflow JSON data not found in backend response.");
  }

  if (typeof workflow === "string") {
    try {
      const parsed = JSON.parse(workflow);
      const nestedSource = parsed?.jsonData ?? parsed?.json_data ?? null;
      if (nestedSource) {
        return typeof nestedSource === "string" ? JSON.parse(nestedSource) : nestedSource;
      }
      return parsed;
    } catch {
      throw new Error("Workflow JSON data not found in backend response.");
    }
  }

  const jsonSource = workflow?.jsonData ?? workflow?.json_data ?? null;
  if (jsonSource) {
    return typeof jsonSource === "string" ? JSON.parse(jsonSource) : jsonSource;
  }

  if (
    typeof workflow === "object" &&
    (Array.isArray(workflow.tasks) || typeof workflow.name === "string")
  ) {
    return workflow;
  }

  throw new Error("Workflow JSON data not found in backend response.");
};

const SIGNATURE_IGNORED_NODE_KEYS = [
  "selected",
  "dragging",
  "measured",
  "width",
  "height",
  "positionAbsolute",
  "internals",
  "resizing",
] as const;

export const buildWorkflowSignature = (
  signatureNodes: any[] = [],
  signatureEdges: any[] = [],
  signatureMeta: any = {}
): string => {
  // Selection/drag state and React Flow measurements are UI-only and must not mark the
  // workflow as modified (a freshly loaded workflow gets measured right after mount).
  const sortedNodes = [...(signatureNodes || [])]
    .map((node) => {
      const signatureNode = { ...node };
      for (const key of SIGNATURE_IGNORED_NODE_KEYS) delete signatureNode[key];
      return signatureNode;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const sortedEdges = [...(signatureEdges || [])]
    .map((edge) => {
      if (!edge || typeof edge !== "object" || !("selected" in edge)) return edge;
      const signatureEdge = { ...edge };
      delete signatureEdge.selected;
      return signatureEdge;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return JSON.stringify({
    nodes: sortedNodes,
    edges: sortedEdges,
    meta: signatureMeta,
  });
};

export const DEFAULT_WORKFLOW_OWNER_EMAIL = "conductor.wrapper@vodafone.com";

export const resolveCurrentLoginEmail = (explicitEmail?: string): string => {
  if (explicitEmail && typeof explicitEmail === "string" && explicitEmail.trim()) {
    return explicitEmail.trim();
  }
  try {
    const profile = getUserProfile();
    if (profile?.email && typeof profile.email === "string" && profile.email.trim()) {
      return profile.email.trim();
    }
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== "undefined") {
      const token =
        localStorage.getItem("cwIdToken") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("cwAccessToken") ||
        "";
      if (token) {
        const parts = token.split(".");
        if (parts.length >= 2) {
          const payloadStr = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
          const parsed = JSON.parse(payloadStr);
          if (parsed?.email && typeof parsed.email === "string" && parsed.email.trim()) {
            return parsed.email.trim();
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_WORKFLOW_OWNER_EMAIL;
};

export const buildExportPayload = ({
  nodes = [],
  edges = [],
  workflowName = "Untitled",
  workflowVersion = 1,
  workflowVariables = {},
  workflowDescription = "",
  workflowLanguage = "",
  workflowSupportedLanguages = [],
  workflowTasks = [],
  workflowTimeoutSeconds,
  timeoutSeconds: explicitTimeoutSeconds,
  workflowTimeoutPolicy,
  timeoutPolicy: explicitTimeoutPolicy,
  workflowOwnerEmail,
  ownerEmail: explicitOwnerEmail,
  workflowMaskedFields,
  maskedFields: explicitMaskedFields,
  workflowRestartable,
  restartable: explicitRestartable,
  workflowStatusListenerEnabled: explicitStatusListener,
  workflowInputParameters,
  inputParameters: explicitInputParameters,
  workflowOutputParameters,
  outputParameters: explicitOutputParameters,
  workflowInputTemplate,
  inputTemplate: explicitInputTemplate,
  workflowEnforceSchema,
  enforceSchema: explicitEnforceSchema,
}: {
  nodes?: any[];
  edges?: any[];
  workflowName?: string;
  workflowVersion?: string | number;
  workflowVariables?: Record<string, any>;
  workflowDescription?: string;
  workflowLanguage?: string;
  workflowSupportedLanguages?: string[];
  workflowTasks?: any[];
  workflowTimeoutSeconds?: number | string;
  timeoutSeconds?: number | string;
  workflowTimeoutPolicy?: string;
  timeoutPolicy?: string;
  workflowOwnerEmail?: string;
  ownerEmail?: string;
  workflowMaskedFields?: any[];
  maskedFields?: any[];
  workflowRestartable?: boolean;
  restartable?: boolean;
  workflowStatusListenerEnabled?: boolean;
  workflowInputParameters?: any[];
  inputParameters?: any[];
  workflowOutputParameters?: Record<string, any>;
  outputParameters?: Record<string, any>;
  workflowInputTemplate?: Record<string, any>;
  inputTemplate?: Record<string, any>;
  workflowEnforceSchema?: boolean;
  enforceSchema?: boolean;
  workflowContextMap?: any;
  randomizeIds?: boolean;
  devModeEnabled?: boolean;
} = {}): any => {
  const startNode = nodes.find((n) => isStartNode(n));
  const startConfig = startNode?.data?.config || {};

  const startLanguage = startConfig.language ?? workflowLanguage ?? "";
  const rawSupportedLanguages =
    startConfig.supportedLanguages ??
    workflowSupportedLanguages ??
    [];
  const startSupportedLanguages = Array.isArray(rawSupportedLanguages)
    ? rawSupportedLanguages.map((l: any) => String(l).trim()).filter(Boolean)
    : [];

  const startVariables =
    startConfig.variables &&
      typeof startConfig.variables === "object" &&
      !Array.isArray(startConfig.variables)
      ? startConfig.variables
      : {};
  const mergedVariables = {
    ...(workflowVariables ?? {}),
    ...startVariables,
  };

  const effectiveDefaultLang = (
    startLanguage || (startSupportedLanguages.length > 0 ? startSupportedLanguages[0] : "en")
  ).trim();

  const rawTimeout =
    explicitTimeoutSeconds ??
    workflowTimeoutSeconds ??
    startConfig.timeoutSeconds;
  const parsedTimeout = Number(rawTimeout);
  const timeoutSeconds =
    Number.isFinite(parsedTimeout) && parsedTimeout >= 0
      ? parsedTimeout
      : DEFAULT_START_TIMEOUT_SECONDS;

  const rawOwner =
    explicitOwnerEmail ??
    workflowOwnerEmail ??
    startConfig.ownerEmail;
  const ownerEmail = resolveCurrentLoginEmail(rawOwner);

  const timeoutPolicy =
    (typeof explicitTimeoutPolicy === "string" && explicitTimeoutPolicy.trim()) ||
    (typeof workflowTimeoutPolicy === "string" && workflowTimeoutPolicy.trim()) ||
    (typeof startConfig.timeoutPolicy === "string" && startConfig.timeoutPolicy.trim()) ||
    "TIME_OUT_WF";

  const rawMaskedFields =
    explicitMaskedFields ??
    workflowMaskedFields ??
    startConfig.maskedFields ??
    [];
  const maskedFields = Array.isArray(rawMaskedFields) ? rawMaskedFields : [];

  const restartable =
    explicitRestartable !== undefined
      ? Boolean(explicitRestartable)
      : workflowRestartable !== undefined
        ? Boolean(workflowRestartable)
        : startConfig.restartable !== undefined
          ? Boolean(startConfig.restartable)
          : false;

  const workflowStatusListenerEnabled =
    explicitStatusListener !== undefined
      ? Boolean(explicitStatusListener)
      : startConfig.workflowStatusListenerEnabled !== undefined
        ? Boolean(startConfig.workflowStatusListenerEnabled)
        : false;

  const rawInputParameters =
    explicitInputParameters ??
    workflowInputParameters ??
    startConfig.inputParameters ??
    startConfig.inputDefinitions ??
    [];
  const inputParameters = Array.isArray(rawInputParameters)
    ? rawInputParameters
    : typeof rawInputParameters === "object" && rawInputParameters !== null
      ? Object.keys(rawInputParameters)
      : [];

  const rawOutputParameters =
    explicitOutputParameters ??
    workflowOutputParameters ??
    startConfig.outputParameters ??
    {};
  const outputParameters =
    rawOutputParameters && typeof rawOutputParameters === "object" && !Array.isArray(rawOutputParameters)
      ? rawOutputParameters
      : {};

  const rawInputTemplate =
    explicitInputTemplate ??
    workflowInputTemplate ??
    startConfig.inputTemplate ??
    {};
  const inputTemplate =
    rawInputTemplate && typeof rawInputTemplate === "object" && !Array.isArray(rawInputTemplate)
      ? rawInputTemplate
      : {};

  const enforceSchema =
    explicitEnforceSchema !== undefined
      ? Boolean(explicitEnforceSchema)
      : workflowEnforceSchema !== undefined
        ? Boolean(workflowEnforceSchema)
        : startConfig.enforceSchema !== undefined
          ? Boolean(startConfig.enforceSchema)
          : true;

  const rawTasks =
    workflowTasks && workflowTasks.length > 0
      ? workflowTasks
      : buildNestedWorkflowTasksFromGraph(nodes, edges);
  const tasks = rawTasks.map(stripNodeMetadataFromTask);


  return {
    name: workflowName || "Untitled",
    version: Number(workflowVersion) || 1,
    description: workflowDescription || "",
    inputParameters,
    outputParameters,
    schemaVersion: 2,
    restartable,
    workflowStatusListenerEnabled,
    ownerEmail,
    timeoutPolicy,
    timeoutSeconds,
    variables: mergedVariables,
    inputTemplate,
    enforceSchema,
    metadata: {
      defaultLanguage: effectiveDefaultLang,
      supportedLanguages: startSupportedLanguages,
    },
    maskedFields,
    tasks,
  };
};


