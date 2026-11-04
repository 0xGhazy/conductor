import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { WorkflowDetail, WorkflowReferencedIds } from "../types/workflowTypes";

export const workflowSchema = {
  type: "object",
  required: ["name", "version", "tasks"],
  properties: {
    name: { type: "string" },
    version: { type: "integer" },
    description: { type: "string" },
    tasks: { type: "array" },
  },
  additionalProperties: true,
};

export const parseWorkflowDefinition = (workflow) => {
  if (workflow?.conductorDefinition) {
    try {
      const parsed = JSON.parse(workflow.conductorDefinition);
      if (typeof parsed?.variables === "string") {
        try {
          parsed.variables = JSON.parse(parsed.variables);
        } catch {
          parsed.variables = {};
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }
  return workflow || null;
};

export const parseVariablesPayload = (value) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

export const extractUsedWorkflows = (message) => {
  if (!message || typeof message !== "string") return [];
  const match = message.match(/\[\[([^\]]+)\]\]/);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
};

export const buildWorkflowRouteId = (workflow) => {
  if (workflow?.id) return String(workflow.id);
  const name = workflow?.name ?? workflow?.workflowName ?? "";
  if (!name) return "";
  const version = workflow?.version ?? "";
  if (version === "" || version == null) return name;
  return `${name}@${version}`;
};

export const parseWorkflowRouteId = (value) => {
  if (!value) return { id: "", name: "", version: null };
  const decoded = decodeURIComponent(value);
  if (!decoded.includes("@")) {
    return { id: decoded, name: "", version: null };
  }
  const [namePart, versionPart] = decoded.split("@");
  const name = (namePart || "").trim();
  if (!versionPart) return { id: decoded, name, version: null };
  const numeric = Number(versionPart);
  return {
    id: decoded,
    name,
    version: Number.isNaN(numeric) ? versionPart : numeric,
  };
};

export const normalizeWorkflows = (workflowsData) =>
  (workflowsData || []).map((wf) => {
    const definition = parseWorkflowDefinition(wf);
    const resolvedName = wf.workflowName || wf.name || definition?.name || "Unknown";
    const resolvedDescription =
      wf?.description ??
      wf?.workflowDescription ??
      definition?.description ??
      definition?.meta?.description ??
      "-";
    const normalizedDescription = String(resolvedDescription ?? "").trim();
    const isMissingDescription =
      normalizedDescription === "" ||
      normalizedDescription === "-" ||
      normalizedDescription.toLowerCase() === "null" ||
      normalizedDescription.toLowerCase() === "undefined";
    const fallbackDescription =
      String(resolvedName || "Workflow")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Workflow";
    const createdAt = wf.createdAt || (wf.createTime ? new Date(wf.createTime).toISOString() : undefined);
    const updatedAt = wf.updatedAt || (wf.updateTime ? new Date(wf.updateTime).toISOString() : undefined);
    return {
      ...wf,
      definition,
      name: resolvedName,
      version: wf.version ?? 1,
      description: isMissingDescription ? fallbackDescription : normalizedDescription,
      createdAt,
      updatedAt,
    };
  });

export const getLatestWorkflows = (normalizedWorkflows) => {
  const byName = new Map();
  normalizedWorkflows.forEach((wf) => {
    const existing = byName.get(wf.name);
    if (!existing || Number(wf.version) > Number(existing.version)) {
      byName.set(wf.name, wf);
    }
  });
  return Array.from(byName.values());
};

export const filterWorkflows = (workflows, search) => {
  if (!search?.trim()) return workflows;
  const q = search.toLowerCase();
  return workflows.filter(
    (wf) =>
      wf.name?.toLowerCase().includes(q) ||
      String(wf.version || "").includes(q) ||
      wf.description?.toLowerCase().includes(q)
  );
};

export const buildWorkflowPayload = (workflow: any) => {
  const definition = parseWorkflowDefinition(workflow) || {
    name: "",
    version: 1,
    tasks: [],
  };
  return {
    ...definition,
    successMessage: workflow?.successMessage ?? definition?.successMessage ?? "",
    failureMessage: workflow?.failureMessage ?? definition?.failureMessage ?? "",
  };
};

export const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || "").trim());

export const extractReferencedEntitiesFromTasks = (tasks: any[] = []): WorkflowReferencedIds => {
  const result: WorkflowReferencedIds = {
    queryIds: new Set<string>(),
    datasourceIds: new Set<string>(),
    connectionNames: new Set<string>(),
    scriptNames: new Set<string>(),
  };

  const visitTask = (task: any) => {
    if (!task) return;
    const taskName = String(task.name || "").toLowerCase();
    const type = String(task.type || "").toLowerCase();
    const input = task.inputParameters || {};

    // Database / Query
    if (taskName === "databaseworker" || type === "database" || input.queryId || input.datasourceId) {
      if (input.queryId) result.queryIds.add(String(input.queryId).trim());
      if (input.datasourceId) result.datasourceIds.add(String(input.datasourceId).trim());
      if (input.dataSourceId) result.datasourceIds.add(String(input.dataSourceId).trim());
    }

    // HTTP / Connection
    if (taskName === "httpworker" || type === "http" || input.connection) {
      if (input.connection && input.connection !== "--NONE--") {
        result.connectionNames.add(String(input.connection).trim());
      }
    }

    // Script
    if (taskName === "scriptworker" || type === "script" || input.scriptName || input.script) {
      if (input.scriptName) result.scriptNames.add(String(input.scriptName).trim());
    }

    // Recurse into nested blocks
    if (Array.isArray(task.tasks)) task.tasks.forEach(visitTask);
    if (Array.isArray(task.defaultCase)) task.defaultCase.forEach(visitTask);
    if (task.decisionCases && typeof task.decisionCases === "object") {
      Object.values(task.decisionCases).forEach((caseList: any) => {
        if (Array.isArray(caseList)) caseList.forEach(visitTask);
      });
    }
    if (Array.isArray(task.forkTasks)) {
      task.forkTasks.forEach((branch: any) => {
        if (Array.isArray(branch)) branch.forEach(visitTask);
      });
    }
  };

  tasks.forEach(visitTask);
  return result;
};

export const fetchWorkflowDetail = async (idOrName: string): Promise<WorkflowDetail> => {
  const trimmed = String(idOrName || "").trim();
  if (!trimmed) throw new Error("Workflow ID or name is required.");

  // Conductor looks workflows up by name (and optional version).
  const { name, version } = parseWorkflowRouteId(trimmed);
  const targetName = name || trimmed;
  const query = version != null ? `?version=${encodeURIComponent(String(version))}` : "";

  const res = await apiClient.get(
    `${config.apiBaseUrl}/api/metadata/workflow/${encodeURIComponent(targetName)}${query}`
  );
  const body = res?.data;
  const entity = body?.data ?? body;
  const parsed = parseWorkflowDefinition(entity) || {};

  return {
    id: entity.id,
    name: entity.name || entity.workflowName || parsed.name || targetName,
    workflowName: entity.workflowName || entity.name || parsed.name || targetName,
    description: entity.description ?? parsed.description ?? "",
    version: entity.version ?? parsed.version ?? (version ? Number(version) : 1),
    latest: entity.latest ?? true,
    createdAt: entity.createdAt || (entity.createTime ? new Date(entity.createTime).toISOString() : undefined),
    createdBy: entity.createdBy,
    updatedAt: entity.updatedAt || (entity.updateTime ? new Date(entity.updateTime).toISOString() : undefined),
    updatedBy: entity.updatedBy,
    conductorDefinition: entity.conductorDefinition,
    tasks: entity.tasks || parsed.tasks || [],
    variables: entity.variables || parsed.variables || {},
    inputs: entity.inputs || parsed.inputs || entity.inputParameters || parsed.inputParameters || {},
    inputParameters: entity.inputParameters || parsed.inputParameters || entity.inputs || parsed.inputs || {},
    timeoutPolicy: entity.timeoutPolicy || parsed.timeoutPolicy || "ALERT_ONLY",
    timeoutSeconds: entity.timeoutSeconds ?? parsed.timeoutSeconds ?? 0,
    supportedLanguages: entity.supportedLanguages || parsed.supportedLanguages || entity.workflowSupportedLanguages || [],
    language: entity.language || parsed.language || entity.workflowLanguage || "en",
    metadata: entity.metadata || parsed.metadata || {},
  };
};

export const updateWorkflowDetail = async (
  name: string,
  payload: {
    name: string;
    description?: string;
    version?: number;
    variables?: Record<string, any>;
    inputParameters?: Record<string, any>;
    timeoutPolicy?: string;
    timeoutSeconds?: number;
    supportedLanguages?: string[];
    language?: string;
  },
  currentWorkflow?: WorkflowDetail
): Promise<any> => {
  const targetName = String(name || payload.name).trim();
  const definition = currentWorkflow ? (parseWorkflowDefinition(currentWorkflow) || {}) : {};

  const fullPayload = {
    ...definition,
    name: targetName,
    description: payload.description ?? definition.description ?? "",
    version: payload.version ?? definition.version ?? 1,
    tasks: currentWorkflow?.tasks || definition.tasks || [],
    variables: payload.variables ?? currentWorkflow?.variables ?? definition.variables ?? {},
    inputParameters: payload.inputParameters ?? currentWorkflow?.inputParameters ?? definition.inputParameters ?? {},
    timeoutPolicy: payload.timeoutPolicy ?? currentWorkflow?.timeoutPolicy ?? definition.timeoutPolicy ?? "ALERT_ONLY",
    timeoutSeconds: payload.timeoutSeconds ?? currentWorkflow?.timeoutSeconds ?? definition.timeoutSeconds ?? 0,
    supportedLanguages: payload.supportedLanguages ?? currentWorkflow?.supportedLanguages ?? definition.supportedLanguages ?? [],
    language: payload.language ?? currentWorkflow?.language ?? definition.language ?? "en",
  };

  const res = await apiClient.put(`${config.apiBaseUrl}/api/metadata/workflow`, [fullPayload]);
  const data = res.data;
  if (data?.bulkErrorResults && Object.keys(data.bulkErrorResults).length > 0) {
    const errorMsg = Object.entries(data.bulkErrorResults)
      .map(([wf, err]) => `${wf}: ${err}`)
      .join(", ");
    throw new Error(errorMsg || "Failed to update workflow definition.");
  }
  return data;
};


