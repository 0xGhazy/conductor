import { useEffect } from "react";
import type { Node } from "@xyflow/react";
import { disposeWeaverModel } from "@/components/common/editors";
import { useDesignerStore, type DesignerState } from "@/features/designer/store/useDesignerStore";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import { buildWorkflowSignature } from "@/features/designer/utils/workflowSerialization";
import {
  createNodeIdMap,
  mapNodeId,
  resolveEdgeId,
} from "@/features/designer/utils/designerGraphUtils";
import { remapScopeNodeReferences } from "@/features/designer/services/scopeGraph";
import { resolveWorkflowVersionValue } from "@/features/designer/utils/workflowVersion";

/** Delay before re-computing the workflow signature after an edit. */
export const SAVE_STATUS_DEBOUNCE_MS = 250;

/** Monaco model keys used by designer editors (see NodeJsonTab / WorkflowNodeConfig). */
const designerModelKeysForNode = (nodeId: string) => [
  `node-json-${nodeId}`,
  `workflow-node-inputs-${nodeId}`,
];

const sameNodeIds = (a: Node[], b: Node[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id) return false;
  }
  return true;
};

/**
 * Normalizes legacy/non-UUID node and edge ids to UUIDs. Only runs when the set of node ids
 * changes (load, import, undo of those...), never on drags, measurements or config edits.
 */
function normalizeNodeIds() {
  const { nodes, setNodes, setEdges, setSelectedId, setSelectedNodeIds } =
    useDesignerStore.getState();
  const nodeIdMap = createNodeIdMap(nodes);
  const hasNodeIdsToNormalize = nodes.some((node) => {
    const id = String(node?.id || "").trim();
    return id && mapNodeId(nodeIdMap, id) !== id;
  });

  if (!hasNodeIdsToNormalize) return;

  setNodes((currentNodes) =>
    currentNodes.map((node): Node => {
      const nextId = mapNodeId(nodeIdMap, node.id);
      const nextParentId = node.parentId ? mapNodeId(nodeIdMap, node.parentId) : node.parentId;
      if (nextId === node.id && nextParentId === node.parentId) return node;
      return remapScopeNodeReferences(
        {
          ...node,
          id: nextId,
          parentId: nextParentId,
        } as Parameters<typeof remapScopeNodeReferences>[0],
        (id) => mapNodeId(nodeIdMap, id)
      ) as Node;
    })
  );

  setEdges((currentEdges) =>
    currentEdges.map((edge) => ({
      ...edge,
      id: resolveEdgeId(edge),
      source: mapNodeId(nodeIdMap, edge.source),
      target: mapNodeId(nodeIdMap, edge.target),
    }))
  );

  setSelectedId((currentId) => (currentId ? mapNodeId(nodeIdMap, currentId) : currentId));
  setSelectedNodeIds((currentIds) =>
    Array.isArray(currentIds) ? currentIds.map((id) => mapNodeId(nodeIdMap, id)) : currentIds
  );
}

const computeCurrentSignature = (state: DesignerState) =>
  buildWorkflowSignature(state.nodes, state.edges, {
    workflowName: state.workflowName,
    workflowVersion: resolveWorkflowVersionValue(state.workflowVersion),
    workflowVariables: state.workflowVariables,
    workflowDescription: state.workflowDescription,
    workflowCorrelationId: state.workflowCorrelationId,
    workflowLanguage: state.workflowLanguage,
    workflowSupportedLanguages: state.workflowSupportedLanguages,
  });

/** Flips SAVED / UNSAVED by comparing the (debounced) current signature with the saved one. */
function syncSaveStatus() {
  const state = useDesignerStore.getState();
  if (!state.lastSavedSignature) return;
  const signature = computeCurrentSignature(state);
  const { workflowStatus, setWorkflowStatus } = state;
  if (signature === state.lastSavedSignature) {
    if (workflowStatus !== "SAVED") setWorkflowStatus("SAVED");
  } else if (workflowStatus !== "UNSAVED" && workflowStatus !== "SAVING") {
    setWorkflowStatus("UNSAVED");
  }
}

const SIGNATURE_FIELDS = [
  "nodes",
  "edges",
  "workflowName",
  "workflowVersion",
  "workflowVariables",
  "workflowDescription",
  "workflowCorrelationId",
  "workflowLanguage",
  "workflowSupportedLanguages",
  "lastSavedSignature",
  "workflowStatus",
] as const satisfies ReadonlyArray<keyof DesignerState>;

/**
 * Designer page lifecycle effects that would otherwise re-run on every graph change in the page
 * component: node-id normalization, debounced save-status tracking, and session cleanup on leave
 * (store reset so the next visit does not first lay out the previous workflow, Monaco models).
 */
export function useDesignerSession() {
  useEffect(() => {
    let lastCheckedNodes: Node[] = useDesignerStore.getState().nodes;
    let signatureTimer: ReturnType<typeof setTimeout> | undefined;

    normalizeNodeIds();
    lastCheckedNodes = useDesignerStore.getState().nodes;
    syncSaveStatus();

    const unsubscribe = useDesignerStore.subscribe((state, prev) => {
      if (state.nodes !== prev.nodes && !sameNodeIds(state.nodes, lastCheckedNodes)) {
        lastCheckedNodes = state.nodes;
        normalizeNodeIds();
        lastCheckedNodes = useDesignerStore.getState().nodes;
      }

      if (SIGNATURE_FIELDS.some((key) => state[key] !== prev[key])) {
        if (signatureTimer) clearTimeout(signatureTimer);
        signatureTimer = setTimeout(() => {
          signatureTimer = undefined;
          syncSaveStatus();
        }, SAVE_STATUS_DEBOUNCE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (signatureTimer) clearTimeout(signatureTimer);

      const nodeIds = useDesignerStore.getState().nodes.map((node) => node.id);
      useDesignerStore.getState().resetDesignerSession();
      // Drop the finished/idle run of this workflow (keeping the user's execution options);
      // an in-flight run is left alone.
      const { status } = useWorkflowExecutionStore.getState();
      if (status !== "starting" && status !== "running" && status !== "paused") {
        useWorkflowExecutionStore.setState({
          status: "idle",
          hasStarted: false,
          workflowId: null,
          startTime: null,
          endTime: null,
          durationMs: null,
          taskStatusMap: {},
          isExpanded: false,
          isOptionsPopoverOpen: false,
          errorMessage: null,
        });
      }

      // Dispose the designer's keyed Monaco models once the editors themselves have unmounted.
      setTimeout(() => {
        const keys = new Set<string>(["workflow-node-inputs-draft"]);
        nodeIds.forEach((id) => designerModelKeysForNode(id).forEach((key) => keys.add(key)));
        keys.forEach((key) => disposeWeaverModel(key));
      }, 0);
    };
  }, []);
}
