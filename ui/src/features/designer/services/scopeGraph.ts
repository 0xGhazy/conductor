export const SCOPE_NODE_TYPE = "SCOPE" as const;
export const SCOPE_NODE_VERSION = 1;

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 76;
const SCOPE_PADDING = 72;
const COLLAPSED_SCOPE_WIDTH = 240;
const COLLAPSED_SCOPE_HEIGHT = 88;
const MIN_EXPANDED_SCOPE_WIDTH = 280;
const MIN_EXPANDED_SCOPE_HEIGHT = 180;

export const SCOPE_COLOR_PRESETS = [
  {
    value: "#6366f1",
    label: "Indigo",
    cyan: "#06b6d4",
    indigo: "#6366f1",
    rose: "#ec4899",
    amber: "#f59e0b",
    green: "#22c55e",
  },
  {
    value: "#06b6d4",
    label: "Cyan",
    cyan: "#06b6d4",
    indigo: "#0ea5e9",
    rose: "#8b5cf6",
    amber: "#f59e0b",
    green: "#22c55e",
  },
  {
    value: "#22c55e",
    label: "Emerald",
    cyan: "#14b8a6",
    indigo: "#22c55e",
    rose: "#84cc16",
    amber: "#f59e0b",
    green: "#16a34a",
  },
  {
    value: "#ec4899",
    label: "Rose",
    cyan: "#f472b6",
    indigo: "#ec4899",
    rose: "#fb7185",
    amber: "#f97316",
    green: "#22c55e",
  },
  {
    value: "#f59e0b",
    label: "Amber",
    cyan: "#22d3ee",
    indigo: "#f59e0b",
    rose: "#f97316",
    amber: "#fbbf24",
    green: "#84cc16",
  },
  {
    value: "#8b5cf6",
    label: "Violet",
    cyan: "#38bdf8",
    indigo: "#8b5cf6",
    rose: "#d946ef",
    amber: "#f59e0b",
    green: "#22c55e",
  },
] as const;

export const DEFAULT_SCOPE_COLOR = SCOPE_COLOR_PRESETS[0].value;

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface ScopeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScopeMeta {
  id: string;
  name: string;
  color: string;
  version: number;
  childrenIds: string[];
  collapsed: boolean;
  parentScopeId: string | null;
  bounds: ScopeBounds;
  createdAt: string;
  focused?: boolean;
}

export interface ScopeNodeData extends Record<string, unknown> {
  kind: typeof SCOPE_NODE_TYPE;
  name: string;
  config: Record<string, unknown>;
  scope: ScopeMeta;
}

export interface WorkflowNode<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: string;
  position: WorkflowPosition;
  data?: TData;
  parentId?: string;
  extent?: "parent" | string;
  style?: Record<string, string | number>;
  width?: number;
  height?: number;
  hidden?: boolean;
  selected?: boolean;
  selectable?: boolean;
  draggable?: boolean;
  zIndex?: number;
}

const START_NODE_ID = "00000000-0000-0000-0000-000000000000";
const LEGACY_START_NODE_ID = "start";

const isStartNode = (node: WorkflowNode | null | undefined) =>
  node?.id === START_NODE_ID || node?.id === LEGACY_START_NODE_ID || node?.type === "startFlag";

export type ScopeWorkflowNode = WorkflowNode<ScopeNodeData> & {
  type: typeof SCOPE_NODE_TYPE;
};

export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
  animated?: boolean;
  markerEnd?: unknown;
  type?: string;
  label?: unknown;
}

export interface ScopeValidationResult {
  valid: boolean;
  message: string | null;
}

export interface CreateScopeParams {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeIds: string[];
  createId: () => string;
  scopeName?: string;
  scopeColor?: string;
}

export interface CreateScopeResult {
  ok: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  scopeId: string | null;
  error: string | null;
}

export interface DerivedScopeGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ScopeBreadcrumb {
  id: string;
  name: string;
}

const uniqueIds = (ids: string[]) =>
  Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getNodeSize = (node: WorkflowNode) => ({
  width: Math.max(
    1,
    toFiniteNumber(node.width ?? node.style?.width, DEFAULT_NODE_WIDTH)
  ),
  height: Math.max(
    1,
    toFiniteNumber(node.height ?? node.style?.height, DEFAULT_NODE_HEIGHT)
  ),
});

const createNodeMap = (nodes: WorkflowNode[]) =>
  new Map(nodes.map((node) => [node.id, node]));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeScopeColor = (color: unknown) => {
  const normalized = typeof color === "string" ? color.trim().toLowerCase() : "";
  const preset = SCOPE_COLOR_PRESETS.find((item) => item.value === normalized);
  return preset?.value ?? DEFAULT_SCOPE_COLOR;
};

export const getScopeColorPreset = (color: unknown = DEFAULT_SCOPE_COLOR) => {
  const normalized = normalizeScopeColor(color);
  return (
    SCOPE_COLOR_PRESETS.find((item) => item.value === normalized) ??
    SCOPE_COLOR_PRESETS[0]
  );
};

const getScopeData = (node: WorkflowNode | undefined): ScopeMeta | null => {
  if (!node || node.type !== SCOPE_NODE_TYPE) return null;
  const data = node.data as ScopeNodeData | undefined;
  const configScope = isRecord(data?.config) ? data?.config.scope : null;
  const scope = data?.scope ?? configScope;
  if (!isRecord(scope)) return null;

  const bounds = isRecord(scope.bounds) ? scope.bounds : {};
  return {
    id: String(scope.id || node.id),
    name: String(scope.name || data?.name || "Sub-Process"),
    color: normalizeScopeColor(scope.color),
    version: toFiniteNumber(scope.version, SCOPE_NODE_VERSION),
    childrenIds: Array.isArray(scope.childrenIds)
      ? scope.childrenIds.map((childId) => String(childId)).filter(Boolean)
      : [],
    collapsed:
      typeof scope.collapsed === "boolean" ? scope.collapsed : true,
    parentScopeId:
      scope.parentScopeId == null ? null : String(scope.parentScopeId),
    bounds: {
      x: toFiniteNumber(bounds.x, toFiniteNumber(node.position?.x, 0)),
      y: toFiniteNumber(bounds.y, toFiniteNumber(node.position?.y, 0)),
      width: Math.max(
        MIN_EXPANDED_SCOPE_WIDTH,
        toFiniteNumber(bounds.width, MIN_EXPANDED_SCOPE_WIDTH)
      ),
      height: Math.max(
        MIN_EXPANDED_SCOPE_HEIGHT,
        toFiniteNumber(bounds.height, MIN_EXPANDED_SCOPE_HEIGHT)
      ),
    },
    createdAt: String(scope.createdAt || ""),
    focused: Boolean(scope.focused),
  };
};

const withSyncedScopeData = (
  data: ScopeNodeData,
  scope: ScopeMeta
): ScopeNodeData => ({
  ...data,
  name: scope.name,
  scope,
  config: {
    ...(isRecord(data.config) ? data.config : {}),
    scope,
  },
});

const toScopeNodeData = (node: WorkflowNode, scope: ScopeMeta): ScopeNodeData => {
  const existingData = (node.data ?? {}) as Partial<ScopeNodeData>;
  return {
    ...existingData,
    kind: SCOPE_NODE_TYPE,
    name: scope.name,
    config: isRecord(existingData.config) ? existingData.config : {},
    scope,
  };
};

export const isScopeNode = (
  node: WorkflowNode | undefined
): node is ScopeWorkflowNode => Boolean(getScopeData(node));

export const getScopeNodeStyle = (scope: ScopeMeta) => {
  if (scope.collapsed) {
    return {
      width: COLLAPSED_SCOPE_WIDTH,
      height: COLLAPSED_SCOPE_HEIGHT,
    };
  }

  return {
    width: Math.max(MIN_EXPANDED_SCOPE_WIDTH, scope.bounds.width),
    height: Math.max(MIN_EXPANDED_SCOPE_HEIGHT, scope.bounds.height),
  };
};

export const hydrateScopeRuntimeNodes = (nodes: WorkflowNode[]) => {
  const scopeChildMap = new Map<string, string>();
  const scopeIds = new Set<string>();

  nodes.forEach((node) => {
    const scope = getScopeData(node);
    if (!scope) return;
    scopeIds.add(node.id);
    scope.childrenIds.forEach((childId) => {
      scopeChildMap.set(childId, node.id);
    });
  });

  return nodes.map((node) => {
    const scope = getScopeData(node);
    if (scope && node.type === SCOPE_NODE_TYPE) {
      const baseData = toScopeNodeData(node, scope);
      const syncedData = withSyncedScopeData(baseData, {
        ...scope,
        id: node.id,
      });

      return {
        ...node,
        data: syncedData,
        style: {
          ...(node.style ?? {}),
          ...getScopeNodeStyle(syncedData.scope),
        },
        selectable: node.selectable ?? true,
        draggable: node.draggable ?? true,
      };
    }

    const parentScopeId = scopeChildMap.get(node.id);
    if (!parentScopeId || scopeIds.has(node.id)) return node;

    return {
      ...node,
      parentId: node.parentId ?? parentScopeId,
      extent: node.extent ?? "parent",
      zIndex: node.zIndex ?? 1,
    };
  });
};

export const remapScopeNodeReferences = (
  node: WorkflowNode,
  mapId: (id: string | null | undefined) => string | null | undefined
) => {
  if (!isScopeNode(node)) return node;

  const scope = getScopeData(node);
  if (!scope) return node;
  const nextScope = {
    ...scope,
    id: String(mapId(scope.id) ?? scope.id),
    parentScopeId:
      scope.parentScopeId == null
        ? null
        : String(mapId(scope.parentScopeId) ?? scope.parentScopeId),
    childrenIds: scope.childrenIds.map((childId) =>
      String(mapId(childId) ?? childId)
    ),
  };

  return {
    ...node,
    data: withSyncedScopeData(toScopeNodeData(node, scope), nextScope),
  };
};

export const getAbsoluteNodePosition = (
  node: WorkflowNode,
  nodeMap: Map<string, WorkflowNode>
) => {
  const position = {
    x: toFiniteNumber(node.position?.x, 0),
    y: toFiniteNumber(node.position?.y, 0),
  };
  const visited = new Set<string>([node.id]);
  let parentId = node.parentId;

  while (parentId) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parentNode = nodeMap.get(parentId);
    if (!parentNode) break;
    position.x += toFiniteNumber(parentNode.position?.x, 0);
    position.y += toFiniteNumber(parentNode.position?.y, 0);
    parentId = parentNode.parentId;
  }

  return position;
};

export const calculateScopeBounds = (
  selectedNodes: WorkflowNode[],
  allNodes: WorkflowNode[],
  padding = SCOPE_PADDING
): ScopeBounds => {
  const nodeMap = createNodeMap(allNodes);
  const boxes = selectedNodes.map((node) => {
    const position = getAbsoluteNodePosition(node, nodeMap);
    const size = getNodeSize(node);
    return {
      minX: position.x,
      minY: position.y,
      maxX: position.x + size.width,
      maxY: position.y + size.height,
    };
  });

  const minX = Math.min(...boxes.map((box) => box.minX)) - padding;
  const minY = Math.min(...boxes.map((box) => box.minY)) - padding;
  const maxX = Math.max(...boxes.map((box) => box.maxX)) + padding;
  const maxY = Math.max(...boxes.map((box) => box.maxY)) + padding;

  return {
    x: minX,
    y: minY,
    width: Math.max(MIN_EXPANDED_SCOPE_WIDTH, maxX - minX),
    height: Math.max(MIN_EXPANDED_SCOPE_HEIGHT, maxY - minY),
  };
};

const buildChildIdsByParent = (nodes: WorkflowNode[]) => {
  const result = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (!node.parentId) return;
    const children = result.get(node.parentId) ?? [];
    children.push(node.id);
    result.set(node.parentId, children);
  });
  return result;
};

export const getScopeDescendantIds = (
  nodes: WorkflowNode[],
  scopeId: string
) => {
  const nodeMap = createNodeMap(nodes);
  const childIdsByParent = buildChildIdsByParent(nodes);
  const result = new Set<string>();
  const scope = getScopeData(nodeMap.get(scopeId));
  const queue = [
    ...(scope?.childrenIds ?? []),
    ...(childIdsByParent.get(scopeId) ?? []),
  ];

  while (queue.length > 0) {
    const childId = queue.shift();
    if (!childId || result.has(childId)) continue;
    result.add(childId);
    const childNode = nodeMap.get(childId);
    const childScope = getScopeData(childNode);
    if (childScope) {
      queue.push(...childScope.childrenIds);
    }
    queue.push(...(childIdsByParent.get(childId) ?? []));
  }

  return result;
};

const getAncestorScopeIds = (
  node: WorkflowNode,
  nodeMap: Map<string, WorkflowNode>
) => {
  const ancestors: string[] = [];
  const visited = new Set<string>([node.id]);
  let parentId = node.parentId;

  while (parentId) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parentNode = nodeMap.get(parentId);
    if (!parentNode) break;
    if (isScopeNode(parentNode)) {
      ancestors.push(parentNode.id);
    }
    parentId = parentNode.parentId;
  }

  return ancestors;
};

export const validateScopeSelection = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  selectedNodeIds: string[]
): ScopeValidationResult => {
  const selectedIds = uniqueIds(selectedNodeIds);
  if (selectedIds.length < 2) {
    return {
      valid: false,
      message: "Select at least two connected nodes to create a scope.",
    };
  }

  const nodeMap = createNodeMap(nodes);
  const selectedNodes = selectedIds
    .map((id) => nodeMap.get(id))
    .filter((node): node is WorkflowNode => Boolean(node));

  if (selectedNodes.length !== selectedIds.length) {
    return { valid: false, message: "Selection contains nodes that no longer exist." };
  }

  if (selectedNodes.some((node) => isStartNode(node))) {
    return { valid: false, message: "The Start node cannot be grouped into a scope." };
  }

  const parentScopeIds = new Set(selectedNodes.map((node) => node.parentId ?? ""));
  if (parentScopeIds.size > 1) {
    return {
      valid: false,
      message: "Selected nodes must belong to the same canvas or parent scope.",
    };
  }

  const selectedSet = new Set(selectedIds);
  for (const node of selectedNodes) {
    if (!isScopeNode(node)) continue;
    const descendants = getScopeDescendantIds(nodes, node.id);
    for (const descendantId of descendants) {
      if (selectedSet.has(descendantId)) {
        return {
          valid: false,
          message: "Select either a scope or its internal nodes, not both.",
        };
      }
    }
  }

  const adjacency = new Map<string, Set<string>>();
  selectedIds.forEach((id) => adjacency.set(id, new Set()));
  edges.forEach((edge) => {
    if (!selectedSet.has(edge.source) || !selectedSet.has(edge.target)) return;
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const visited = new Set<string>();
  const queue = [selectedIds[0]];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    adjacency.get(id)?.forEach((nextId) => {
      if (!visited.has(nextId)) queue.push(nextId);
    });
  }

  if (visited.size !== selectedIds.length) {
    return {
      valid: false,
      message: "Selected nodes must form one continuous connected sub-graph.",
    };
  }

  return { valid: true, message: null };
};

const updateParentScopeChildren = (
  node: WorkflowNode,
  selectedSet: Set<string>,
  scopeId: string
) => {
  if (!isScopeNode(node)) return node;
  const scope = getScopeData(node);
  if (!scope) return node;
  const nextChildren = scope.childrenIds.filter((childId) => !selectedSet.has(childId));
  if (nextChildren.includes(scopeId)) return node;
  return {
    ...node,
    data: withSyncedScopeData(toScopeNodeData(node, scope), {
      ...scope,
      childrenIds: [...nextChildren, scopeId],
    }),
  };
};

export const createScopeFromSelection = ({
  nodes,
  edges,
  selectedNodeIds,
  createId,
  scopeName,
  scopeColor,
}: CreateScopeParams): CreateScopeResult => {
  const validation = validateScopeSelection(nodes, edges, selectedNodeIds);
  if (!validation.valid) {
    return {
      ok: false,
      nodes,
      edges,
      scopeId: null,
      error: validation.message,
    };
  }

  const selectedIds = uniqueIds(selectedNodeIds);
  const selectedSet = new Set(selectedIds);
  const nodeMap = createNodeMap(nodes);
  const selectedNodes = selectedIds
    .map((id) => nodeMap.get(id))
    .filter((node): node is WorkflowNode => Boolean(node));
  const parentScopeId = selectedNodes[0]?.parentId ?? null;
  const parentNode = parentScopeId ? nodeMap.get(parentScopeId) : undefined;
  const parentPosition = parentNode
    ? getAbsoluteNodePosition(parentNode, nodeMap)
    : { x: 0, y: 0 };
  const bounds = calculateScopeBounds(selectedNodes, nodes);
  const scopeId = createId();
  const resolvedName =
    String(scopeName || "").trim() || `Sub-Process ${new Date().toLocaleTimeString()}`;
  const resolvedColor = normalizeScopeColor(scopeColor);

  const scopeMeta: ScopeMeta = {
    id: scopeId,
    name: resolvedName,
    color: resolvedColor,
    version: SCOPE_NODE_VERSION,
    childrenIds: selectedIds,
    collapsed: true,
    parentScopeId,
    bounds,
    createdAt: new Date().toISOString(),
  };

  const scopeNode: ScopeWorkflowNode = {
    id: scopeId,
    type: SCOPE_NODE_TYPE,
    position: {
      x: bounds.x - parentPosition.x,
      y: bounds.y - parentPosition.y,
    },
    parentId: parentScopeId ?? undefined,
    extent: parentScopeId ? "parent" : undefined,
    style: getScopeNodeStyle(scopeMeta),
    data: {
      kind: SCOPE_NODE_TYPE,
      name: resolvedName,
      config: {
        scope: scopeMeta,
      },
      scope: scopeMeta,
    },
    selectable: true,
    draggable: true,
    zIndex: 0,
  };

  const mappedNodes = nodes.map((node) => {
    if (parentScopeId && node.id === parentScopeId) {
      return updateParentScopeChildren(node, selectedSet, scopeId);
    }

    if (!selectedSet.has(node.id)) {
      return { ...node, selected: false };
    }

    const absolutePosition = getAbsoluteNodePosition(node, nodeMap);
    return {
      ...node,
      parentId: scopeId,
      extent: "parent",
      position: {
        x: absolutePosition.x - bounds.x,
        y: absolutePosition.y - bounds.y,
      },
      selected: false,
      zIndex: 1,
    };
  });

  const firstSelectedIndex = Math.min(
    ...mappedNodes
      .map((node, index) => (selectedSet.has(node.id) ? index : Number.POSITIVE_INFINITY))
      .filter((index) => Number.isFinite(index))
  );
  const insertIndex = Number.isFinite(firstSelectedIndex) ? firstSelectedIndex : mappedNodes.length;
  const nextNodes = [
    ...mappedNodes.slice(0, insertIndex),
    scopeNode,
    ...mappedNodes.slice(insertIndex),
  ];

  return {
    ok: true,
    nodes: nextNodes,
    edges,
    scopeId,
    error: null,
  };
};

export const toggleScopeCollapsed = (
  nodes: WorkflowNode[],
  scopeId: string,
  collapsed?: boolean
) =>
  nodes.map((node) => {
    if (!isScopeNode(node) || node.id !== scopeId) return node;
    const currentScope = getScopeData(node);
    if (!currentScope) return node;
    const nextScope = {
      ...currentScope,
      collapsed: collapsed ?? !currentScope.collapsed,
      focused: false,
    };
    return {
      ...node,
      style: getScopeNodeStyle(nextScope),
      data: withSyncedScopeData(toScopeNodeData(node, currentScope), nextScope),
    };
  });

const resolveVisibleEndpoint = ({
  nodeId,
  nodeMap,
  hiddenNodeIds,
  collapsedScopeIds,
}: {
  nodeId: string;
  nodeMap: Map<string, WorkflowNode>;
  hiddenNodeIds: Set<string>;
  collapsedScopeIds: Set<string>;
}) => {
  if (!hiddenNodeIds.has(nodeId)) return nodeId;

  const node = nodeMap.get(nodeId);
  if (!node) return null;

  let parentId = node.parentId;
  const visited = new Set<string>([nodeId]);
  while (parentId) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    if (collapsedScopeIds.has(parentId) && !hiddenNodeIds.has(parentId)) {
      return parentId;
    }
    const parentNode = nodeMap.get(parentId);
    parentId = parentNode?.parentId;
  }

  return null;
};

export const deriveVisibleScopeGraph = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  focusedScopeId: string | null = null
): DerivedScopeGraph => {
  const nodeMap = createNodeMap(nodes);
  const allowedIds = focusedScopeId
    ? new Set([focusedScopeId, ...getScopeDescendantIds(nodes, focusedScopeId)])
    : null;
  const collapsedScopeIds = new Set(
    nodes
      .filter((node) => isScopeNode(node))
      .filter((node) => node.id !== focusedScopeId && Boolean(getScopeData(node)?.collapsed))
      .map((node) => node.id)
  );

  const hiddenNodeIds = new Set<string>();
  nodes.forEach((node) => {
    if (allowedIds && !allowedIds.has(node.id)) {
      hiddenNodeIds.add(node.id);
      return;
    }

    const ancestors = getAncestorScopeIds(node, nodeMap);
    if (ancestors.some((scopeId) => collapsedScopeIds.has(scopeId))) {
      hiddenNodeIds.add(node.id);
    }
  });

  const visibleNodes = nodes
    .filter((node) => !hiddenNodeIds.has(node.id))
    .map((node) => {
      if (!isScopeNode(node)) return node;
      const currentScope = getScopeData(node);
      if (!currentScope) return node;
      const isFocusedScope = node.id === focusedScopeId;
      const scope = {
        ...currentScope,
        collapsed: isFocusedScope ? false : currentScope.collapsed,
        focused: isFocusedScope,
      };
      return {
        ...node,
        style: getScopeNodeStyle(scope),
        data: withSyncedScopeData(toScopeNodeData(node, currentScope), scope),
      };
    });

  const visibleEdges: WorkflowEdge[] = [];
  const seenEdgeIds = new Set<string>();

  edges.forEach((edge) => {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return;
    if (allowedIds && (!allowedIds.has(edge.source) || !allowedIds.has(edge.target))) {
      return;
    }

    const source = resolveVisibleEndpoint({
      nodeId: edge.source,
      nodeMap,
      hiddenNodeIds,
      collapsedScopeIds,
    });
    const target = resolveVisibleEndpoint({
      nodeId: edge.target,
      nodeMap,
      hiddenNodeIds,
      collapsedScopeIds,
    });

    if (!source || !target || source === target) return;

    const proxied = source !== edge.source || target !== edge.target;
    const edgeId = proxied
      ? `scope-proxy:${edge.id ?? `${edge.source}->${edge.target}`}:${source}->${target}`
      : edge.id ?? `${source}->${target}`;

    if (seenEdgeIds.has(edgeId)) return;
    seenEdgeIds.add(edgeId);

    visibleEdges.push({
      ...edge,
      id: edgeId,
      source,
      target,
      sourceHandle: source !== edge.source ? "scope-out" : edge.sourceHandle ?? null,
      targetHandle: target !== edge.target ? "scope-in" : edge.targetHandle ?? null,
      data: {
        ...(edge.data ?? {}),
        proxiedByScope: proxied,
        originalEdgeId: edge.id ?? null,
      },
      style: proxied
        ? {
            ...(edge.style ?? {}),
            strokeDasharray: "8 5",
          }
        : edge.style,
    });
  });

  return { nodes: visibleNodes, edges: visibleEdges };
};

export const getScopeBreadcrumbs = (
  nodes: WorkflowNode[],
  focusedScopeId: string | null
): ScopeBreadcrumb[] => {
  if (!focusedScopeId) return [];
  const nodeMap = createNodeMap(nodes);
  const focusedNode = nodeMap.get(focusedScopeId);
  if (!focusedNode || !isScopeNode(focusedNode)) return [];

  const breadcrumbs: ScopeBreadcrumb[] = [];
  let currentNode: WorkflowNode | undefined = focusedNode;
  const visited = new Set<string>();

  while (currentNode && isScopeNode(currentNode) && !visited.has(currentNode.id)) {
    const scope = getScopeData(currentNode);
    if (!scope) break;
    visited.add(currentNode.id);
    breadcrumbs.push({
      id: currentNode.id,
      name: scope.name,
    });
    currentNode = currentNode.parentId ? nodeMap.get(currentNode.parentId) : undefined;
  }

  return breadcrumbs.reverse();
};

export const getGroupSelectionState = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  selectedNodeIds: string[]
) => {
  const validation = validateScopeSelection(nodes, edges, selectedNodeIds);
  return {
    canGroup: validation.valid,
    message: validation.message,
  };
};
