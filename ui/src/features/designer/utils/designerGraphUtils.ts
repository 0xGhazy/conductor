import { createUuid } from "@/utils/uuid";
import { LEGACY_START_NODE_ID, START_NODE_ID, END_NODE_ID } from "@/features/designer/constants/workflowNodes";
export { START_NODE_ID, END_NODE_ID, LEGACY_START_NODE_ID };
import { isScopeNode } from "@/features/designer/services/scopeGraph";
import {
  normalizeCases,
  buildSwitchCaseHandles,
} from "@/features/designer/components/actions/switch/model/switchDto";

export const DRAG_TYPE = "application/x-node-type";

export const CASE_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
];

export const START_TIMEOUT_POLICIES: Record<string, string> = {
  TIME_OUT_WF: "Fail the workflow",
  ALERT_ONLY: "Mark timed out but keep running",
};

export const DEFAULT_START_TIMEOUT_SECONDS = 10;

export const BASE_EDGE_STYLE = {
  stroke: "#38bdf8",
  strokeWidth: 2,
  strokeDasharray: "6 4",
};

export const BASE_EDGE_MARKER = {
  type: "arrowclosed" as const,
  width: 15,
  height: 15,
  color: "#38bdf8",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PREFIXED_UUID_NODE_ID_PATTERN =
  /^.+_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export const isUuid = (value: unknown): boolean =>
  UUID_PATTERN.test(String(value || "").trim());

export const isStartNodeId = (value: unknown): boolean => {
  const id = String(value || "").trim();
  return id === START_NODE_ID || id === LEGACY_START_NODE_ID;
};

export const isEndNodeId = (value: unknown): boolean => {
  const id = String(value || "").trim().toLowerCase();
  return id === END_NODE_ID || id === "end" || id === "workflow-end-point" || id === "endflag";
};

export const isDesignerRootNodeId = (value: unknown): boolean => {
  return isStartNodeId(value) || isEndNodeId(value);
};

export const resolveNodeId = (value: unknown): string => {
  const id = String(value || "").trim();
  if (!id) return id;
  if (isStartNodeId(id)) return START_NODE_ID;
  if (isEndNodeId(id)) return END_NODE_ID;
  if (isUuid(id)) return id;
  const prefixedMatch = id.match(PREFIXED_UUID_NODE_ID_PATTERN);
  if (prefixedMatch?.[1]) return prefixedMatch[1];
  return createUuid();
};

export const isStartNode = (node: any): boolean =>
  isStartNodeId(node?.id) ||
  node?.type === "startFlag" ||
  node?.type === "START" ||
  node?.type === "start";

export const isEndNode = (node: any): boolean =>
  isEndNodeId(node?.id) || node?.type === "endFlag" || node?.type === "END";

export const isTerminateNodeType = (type: unknown): boolean =>
  type === "TERMINATE" ||
  type === "terminateAction" ||
  type === "RESPOND" ||
  type === "RESPOND_ACTION" ||
  type === "respondAction";

export interface PendingConnectionInfo {
  nodeId: string;
  handleId?: string;
}

export const parsePendingConnection = (
  source: unknown
): PendingConnectionInfo | null => {
  if (!source) return null;
  if (typeof source === "object" && source !== null && "nodeId" in source) {
    return source as PendingConnectionInfo;
  }
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return null;
    if (trimmed.includes("::")) {
      const [nodeId, handleId] = trimmed.split("::");
      return { nodeId, handleId: handleId || undefined };
    }
    return { nodeId: trimmed };
  }
  return null;
};

export const createNodeIdMap = (nodes: any[] = []): Map<string, string> => {
  const map = new Map<string, string>();
  (nodes || []).forEach((node) => {
    const id = String(node?.id || "").trim();
    if (!id || map.has(id)) return;
    map.set(id, resolveNodeId(id));
  });
  return map;
};

export const mapNodeId = (idMap: Map<string, string>, value: unknown): string =>
  idMap.get(String(value || "").trim()) ?? resolveNodeId(value);

export const buildEdgeId = (): string => createUuid();

export const resolveEdgeId = (edge: any = {}): string =>
  isUuid(edge?.id) ? edge.id : buildEdgeId();

export const buildEdgeRouteKey = (edge: any = {}): string =>
  JSON.stringify([
    edge.source || "",
    edge.sourceHandle || "",
    edge.target || "",
    edge.targetHandle || "",
  ]);

export const EDGE_LABEL_DEFAULT_BACKGROUND = "#38bdf8";

export const getReadableEdgeLabelTextColor = (backgroundColor: unknown = ""): string => {
  const hex = String(backgroundColor || "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? "#0f172a" : "#ffffff";
};

export const resolveEdgeTitle = (edge: any = {}): string =>
  String(
    edge?.data?.note ||
    edge.title ||
    (typeof edge.label === "string" ? edge.label : "") ||
    ""
  ).trim();

export const resolveEdgeBackgroundColor = (edge: any = {}): string =>
  edge.backgroundColor ||
  edge?.labelBgStyle?.fill ||
  edge?.style?.stroke ||
  EDGE_LABEL_DEFAULT_BACKGROUND;

export const resolveEdgeTextColor = (edge: any = {}): string =>
  edge.color ||
  edge?.labelStyle?.color ||
  edge?.labelStyle?.fill ||
  getReadableEdgeLabelTextColor(resolveEdgeBackgroundColor(edge));

export const toWorkflowEdgeDto = (edge: any = {}) => ({
  id: resolveEdgeId(edge),
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle || null,
  targetHandle: edge.targetHandle || null,
  title: resolveEdgeTitle(edge),
  color: resolveEdgeTextColor(edge),
  backgroundColor: resolveEdgeBackgroundColor(edge),
});

export const dedupeEdges = (edgesList: any[] = []): any[] => {
  const map = new Map<string, any>();
  (edgesList || []).forEach((edge) => {
    if (!edge?.source || !edge?.target) return;
    const id = resolveEdgeId(edge);
    map.set(buildEdgeRouteKey(edge), { ...edge, id });
  });
  return Array.from(map.values());
};

export const isJsonObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const formatJsonObject = (value: unknown): string =>
  JSON.stringify(isJsonObject(value) ? value : {}, null, 2);

export const inferInputType = (value: unknown): "Boolean" | "Number" | "Text" => {
  if (typeof value === "boolean") return "Boolean";
  if (typeof value === "number") return "Number";
  return "Text";
};

export const stringifyInputDefinitionValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
};

export const coerceInputDefinitionValue = (entry: any): any => {
  const rawValue = entry?.value;
  if (rawValue === null || rawValue === undefined || rawValue === "") return "";

  if (entry?.type === "Number") {
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : rawValue;
  }

  if (entry?.type === "Boolean") {
    return String(rawValue).trim().toLowerCase() === "true";
  }

  return rawValue;
};

export const inputDefinitionsToParameters = (definitions: any[] = []): Record<string, any> =>
  (Array.isArray(definitions) ? definitions : []).reduce((acc, entry) => {
    const name = String(entry?.name || "").trim();
    if (!name) return acc;
    acc[name] = coerceInputDefinitionValue(entry);
    return acc;
  }, {} as Record<string, any>);

export const normalizeStartInputs = (value: unknown): { value?: Record<string, any>; error?: string } => {
  if (!isJsonObject(value)) {
    return { error: "Start Inputs JSON must be an object." };
  }

  const normalized: Record<string, any> = {};
  const seenNames = new Set<string>();

  for (const [key, inputValue] of Object.entries(value)) {
    const name = String(key || "").trim();
    if (!name) {
      return { error: "Input names cannot be empty." };
    }
    if (seenNames.has(name)) {
      return { error: `Duplicate input name "${name}".` };
    }
    seenNames.add(name);
    normalized[name] = inputValue;
  }

  return { value: normalized };
};

export const parseStartInputsJson = (text: string | null | undefined): { value?: Record<string, any>; error?: string } => {
  const trimmedText = String(text ?? "").trim();
  if (!trimmedText) return { value: {} };

  try {
    return normalizeStartInputs(JSON.parse(trimmedText));
  } catch {
    return { error: "Start Inputs must be valid JSON." };
  }
};

export const normalizeStartVariables = (value: unknown): { value?: Record<string, any>; error?: string } => {
  if (!isJsonObject(value)) {
    return { error: "Start Variables JSON must be an object." };
  }

  const normalized: Record<string, any> = {};
  const seenNames = new Set<string>();

  for (const [key, variableValue] of Object.entries(value)) {
    const name = String(key || "").trim();
    if (!name) {
      return { error: "Variable names cannot be empty." };
    }
    if (seenNames.has(name)) {
      return { error: `Duplicate variable name "${name}".` };
    }
    seenNames.add(name);
    normalized[name] = variableValue;
  }

  return { value: normalized };
};

export const parseStartVariablesJson = (text: string | null | undefined): { value?: Record<string, any>; error?: string } => {
  const trimmedText = String(text ?? "").trim();
  if (!trimmedText) return { value: {} };

  try {
    return normalizeStartVariables(JSON.parse(trimmedText));
  } catch {
    return { error: "Start Variables must be valid JSON." };
  }
};

export const buildStartInputDefinitions = (inputParameters: unknown): any[] =>
  Object.entries(isJsonObject(inputParameters) ? inputParameters : {}).map(
    ([name, value]) => ({
      name,
      type: inferInputType(value),
      value: stringifyInputDefinitionValue(value),
      required: false,
    })
  );

export const buildStartInputsJsonText = ({
  inputDefinitions = [],
  inputParameters = {},
}: {
  inputDefinitions?: any[];
  inputParameters?: Record<string, any>;
} = {}): string => {
  const mergedParameters = inputDefinitionsToParameters(inputDefinitions);

  if (isJsonObject(inputParameters)) {
    Object.entries(inputParameters).forEach(([key, value]) => {
      const name = String(key || "").trim();
      if (!name) return;
      mergedParameters[name] = value;
    });
  }

  return formatJsonObject(mergedParameters);
};

export const getSwitchCaseLabel = (node: any, handleId: unknown): string | null => {
  if (!node || node.type !== "SWITCH_ACTION" || !handleId) return null;
  const cases =
    node?.data?.config?.cases ?? node?.data?.config?.config?.cases ?? [];
  for (let i = 0; i < cases.length; i++) {
    const caseData = cases[i] || {};
    const baseId = caseData.id || `case-${i}`;
    if (baseId === handleId) {
      return caseData.label || caseData.value || `case_${i + 1}`;
    }
  }
  if (handleId === "default") return "default";
  return null;
};

export const getSwitchCaseColor = (node: any, handleId: unknown): string | null => {
  if (!node || node.type !== "SWITCH_ACTION" || !handleId) return null;
  const cases =
    node?.data?.config?.cases ?? node?.data?.config?.config?.cases ?? [];

  if (handleId === "default") {
    return CASE_COLORS[(cases.length + 1) % CASE_COLORS.length];
  }

  for (let i = 0; i < cases.length; i++) {
    const caseData = cases[i] || {};
    const baseId = caseData.id || `case-${i}`;
    if (baseId === handleId) {
      return CASE_COLORS[i % CASE_COLORS.length];
    }
  }

  return null;
};

export const normalizeSwitchHandleId = (handleId: unknown): string => {
  const value = String(handleId || "").trim();
  return value || "default";
};

export const getSwitchCaseKey = (caseData: any, index: number): string =>
  typeof caseData?.value === "string" && caseData.value.trim()
    ? caseData.value.trim()
    : `case_${index + 1}`;

export const dedupeTaskTraversalEdges = (
  edgeList: any[] = [],
  keyBuilder: (edge: any) => string
): any[] => {
  const seen = new Set<string>();
  return (edgeList || []).filter((edge) => {
    const key = keyBuilder(edge);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const dedupeSequentialTaskEdges = (edgeList: any[] = []): any[] =>
  dedupeTaskTraversalEdges(edgeList, (edge) => edge?.target || "");

export const dedupeSwitchTaskEdges = (edgeList: any[] = []): any[] =>
  dedupeTaskTraversalEdges(
    edgeList,
    (edge) => `${normalizeSwitchHandleId(edge?.sourceHandle)}::${edge?.target || ""}`
  );

export const getSourceHandleIndex = (
  sourceNode: any,
  sourceHandle: string | null | undefined
): number => {
  if (!sourceNode) return 0;

  const nodeType = sourceNode.type;

  // 1. Switch action / switch node
  if (nodeType === "switch" || nodeType === "SWITCH_ACTION") {
    const cfg = (sourceNode.data as any)?.config ?? (sourceNode.data as any);
    const cases = normalizeCases(cfg);
    const handles = buildSwitchCaseHandles(sourceNode.id, cases);

    if (!sourceHandle) {
      const defIdx = handles.findIndex((h) => h.isDefault);
      return defIdx >= 0 ? defIdx : handles.length - 1;
    }

    const trimmed = String(sourceHandle).trim();
    const normalized = normalizeSwitchHandleId(trimmed);

    // Exact match on handle ID or key
    for (let i = 0; i < handles.length; i++) {
      if (
        handles[i].id === trimmed ||
        handles[i].key === trimmed ||
        handles[i].id === normalized
      ) {
        return i;
      }
    }

    // Match on case value or label
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const caseVal = String(c?.value ?? "").trim();
      const caseLabel = String(c?.label ?? "").trim();
      const baseId = c?.id || `case-${i}`;
      if (
        baseId === trimmed ||
        baseId === normalized ||
        (caseVal && caseVal === trimmed) ||
        (caseLabel && caseLabel === trimmed)
      ) {
        return i;
      }
    }

    if (normalized === "default" || trimmed === "default") {
      const defIdx = handles.findIndex((h) => h.isDefault);
      return defIdx >= 0 ? defIdx : handles.length - 1;
    }

    return 0;
  }

  // 2. ForEach action
  if (nodeType === "FOREACH_ACTION" || nodeType === "FOREACH") {
    const handleStr = String(sourceHandle || "").toLowerCase();
    if (handleStr.includes("loop") || handleStr === "loopbody") {
      return 0; // Loop body (left handle ~30%)
    }
    return 1; // Next / onComplete (right handle ~70%)
  }

  // 3. Conditional boolean branches
  if (sourceHandle) {
    const h = String(sourceHandle).toLowerCase();
    if (h === "true" || h === "success") return 0;
    if (h === "false" || h === "error") return 1;
  }

  return 0;
};

export const computeStyledEdges = (
  visibleScopeGraphEdges: any[] = [],
  visibleScopeGraphNodes: any[] = []
): any[] => {
  const visibleNodeMap = new Map<string, any>(
    visibleScopeGraphNodes.map((node) => [node.id, node])
  );

  // Group outgoing edges by source to resolve branch indices
  const outgoingBySource = new Map<string, any[]>();
  visibleScopeGraphEdges.forEach((e) => {
    if (!outgoingBySource.has(e.source)) {
      outgoingBySource.set(e.source, []);
    }
    outgoingBySource.get(e.source)!.push(e);
  });

  const branchIndexMap = new Map<string, { branchIndex: number; totalBranches: number }>();
  outgoingBySource.forEach((edges, sourceId) => {
    const srcNode = visibleNodeMap.get(sourceId);
    // Sort edges by handle order
    const sorted = [...edges].sort((a, b) => {
      const idxA = getSourceHandleIndex(srcNode, a.sourceHandle);
      const idxB = getSourceHandleIndex(srcNode, b.sourceHandle);
      return idxA - idxB;
    });
    sorted.forEach((edge, idx) => {
      branchIndexMap.set(edge.id, { branchIndex: idx, totalBranches: edges.length });
    });
  });

  return visibleScopeGraphEdges.map((edge) => {
    if (edge?.data?.isGhost || edge.id?.startsWith("ghost-edge-")) {
      return {
        ...edge,
        type: "weaverBranchEdge",
        animated: false,
        selectable: false,
        deletable: false,
        focusable: false,
        markerEnd: {
          type: "arrowclosed" as const,
          color: "#94a3b8",
          width: 12,
          height: 12,
        },
        style: {
          ...(edge.style || {}),
          stroke: "#94a3b8",
          strokeDasharray: "5 5",
          strokeOpacity: 0.65,
          strokeWidth: 2,
          pointerEvents: "none",
          cursor: "default",
        },
        data: {
          ...(edge.data || {}),
          isGhost: true,
          labelColor: "#94a3b8",
        },
      };
    }

    const sourceNode = visibleNodeMap.get(edge.source);
    const edgeNote = String(edge?.data?.note || "").trim();
    const branchInfo = branchIndexMap.get(edge.id) || { branchIndex: 0, totalBranches: 1 };

    const baseEdge = {
      ...edge,
      type: "weaverBranchEdge",
      animated: false,
      markerEnd: edge.markerEnd ?? BASE_EDGE_MARKER,
      style: {
        ...BASE_EDGE_STYLE,
        ...(edge.style || {}),
      },
      data: {
        ...(edge.data || {}),
        branchIndex: edge?.data?.branchIndex ?? branchInfo.branchIndex,
        totalBranches: edge?.data?.totalBranches ?? branchInfo.totalBranches,
      },
    };

    if (edge.sourceHandle === "true") {
      return {
        ...baseEdge,
        markerEnd: { ...BASE_EDGE_MARKER, color: "#22c55e" },
        style: {
          ...baseEdge.style,
          stroke: "#22c55e",
        },
        data: {
          ...baseEdge.data,
          labelColor: "#22c55e",
        },
      };
    } else if (edge.sourceHandle === "false") {
      return {
        ...baseEdge,
        markerEnd: { ...BASE_EDGE_MARKER, color: "#ef4444" },
        style: {
          ...baseEdge.style,
          stroke: "#ef4444",
        },
        data: {
          ...baseEdge.data,
          labelColor: "#ef4444",
        },
      };
    } else if (edge.sourceHandle === "success") {
      return {
        ...baseEdge,
        markerEnd: { ...BASE_EDGE_MARKER, color: "#22c55e" },
        style: {
          ...baseEdge.style,
          stroke: "#22c55e",
        },
        data: {
          ...baseEdge.data,
          labelColor: "#22c55e",
        },
      };
    } else if (edge.sourceHandle === "error") {
      return {
        ...baseEdge,
        markerEnd: { ...BASE_EDGE_MARKER, color: "#ef4444" },
        style: {
          ...baseEdge.style,
          stroke: "#ef4444",
        },
        data: {
          ...baseEdge.data,
          labelColor: "#ef4444",
        },
      };
    }

    if (sourceNode?.type === "SWITCH_ACTION" || sourceNode?.type === "switch") {
      const caseLabel = getSwitchCaseLabel(sourceNode, edge.sourceHandle);
      const caseColor = getSwitchCaseColor(sourceNode, edge.sourceHandle);
      if (caseLabel || caseColor) {
        const withCase = {
          ...baseEdge,
          label: caseLabel,
          markerEnd: caseColor
            ? { ...BASE_EDGE_MARKER, color: caseColor }
            : baseEdge.markerEnd,
          style: caseColor
            ? {
              ...baseEdge.style,
              stroke: caseColor,
            }
            : baseEdge.style,
          data: {
            ...baseEdge.data,
            labelColor: caseColor,
          },
        };
        if (edgeNote) {
          return {
            ...withCase,
            label: `${caseLabel || ""}${caseLabel ? " | " : ""}${edgeNote}`,
          };
        }
        return withCase;
      }
    }

    if (edgeNote) {
      return {
        ...baseEdge,
        label: edgeNote,
      };
    }

    return baseEdge;
  });
};

export const validateOrphanNodes = (
  nodesToCheck: any[] = [],
  edgesToCheck: any[] = []
): { valid: boolean; message: string | null } => {
  const orphanNodes = nodesToCheck.filter((node) => {
    if (isStartNode(node)) return false;
    if (isScopeNode(node)) return false;
    if (isEndNode(node)) return false;
    return !edgesToCheck.some((edge) => edge.target === node.id);
  });

  if (orphanNodes.length > 0) {
    const orphanNames = orphanNodes
      .map((n) => n.data?.name || n.id)
      .join(", ");
    return {
      valid: false,
      message: `The following node(s) have no incoming connections:\n\n${orphanNames}\n\nEvery node (except the start node) must have at least one incoming edge. Please connect these nodes before proceeding.`,
    };
  }

  return { valid: true, message: null };
};

export const getTerminalNodes = (
  nodes: any[] = [],
  edges: any[] = []
): any[] => {
  const nonEndNonScopeNodes = nodes.filter(
    (n) => !isEndNode(n) && !isScopeNode(n)
  );

  // Set of sources that have an outgoing edge to a non-end node
  const activeSources = new Set<string>();
  edges.forEach((e) => {
    if (
      e.target !== END_NODE_ID &&
      !isEndNodeId(e.target) &&
      !e.id?.startsWith("ghost-edge-") &&
      !e?.data?.isGhost
    ) {
      activeSources.add(e.source);
    }
  });

  // If there are task nodes (nodes other than Start, End, Scope):
  const taskNodes = nonEndNonScopeNodes.filter((n) => !isStartNode(n));

  if (taskNodes.length > 0) {
    return taskNodes.filter((node) => {
      if (isTerminateNodeType(node.type)) return true;
      return !activeSources.has(node.id);
    });
  }

  // If there are NO task nodes at all, but Start exists:
  const startNode = nonEndNonScopeNodes.find((n) => isStartNode(n));
  if (startNode && !activeSources.has(startNode.id)) {
    return [startNode];
  }

  return [];
};

export const createGhostEndEdges = (
  terminalNodes: any[],
  endNodeId: string = END_NODE_ID,
  isLR: boolean = false
): any[] => {
  return terminalNodes.map((node) => {
    let sourceHandle: string | undefined = undefined;
    if (isStartNode(node)) {
      sourceHandle = "workflow-entry-point";
    }

    return {
      id: `ghost-edge-${node.id}-${endNodeId}`,
      source: node.id,
      sourceHandle,
      target: endNodeId,
      targetHandle: "end-entry-point",
      type: "weaverBranchEdge",
      animated: false,
      selectable: false,
      deletable: false,
      focusable: false,
      data: {
        isGhost: true,
        labelColor: "#94a3b8",
      },
      style: {
        stroke: "#94a3b8",
        strokeDasharray: "5 5",
        strokeOpacity: 0.65,
        strokeWidth: 2,
        pointerEvents: "none",
      },
    };
  });
};

export const getMissingVariableKeys = (workflowVariables: Record<string, any> = {}): string[] => {
  return Object.entries(workflowVariables || {})
    .filter(([, value]) => value === "" || value === null || value === undefined)
    .map(([key]) => key);
};

export const formatDateTime = (value: unknown): string => {
  if (value == null || value === "") return "";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
