import { useEffect, useRef } from "react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { createUuid } from "@/utils/uuid";
import { isEndNode, isStartNode } from "@/features/designer/utils/designerGraphUtils";
import { useWeaverNotification } from "@/components/common/notifications";
import { useHoldToConfirm } from "@/components/common/buttons/WeaverButton";

const DELETE_HOLD_KEYS = ["Delete", "Backspace"] as const;
export const DELETE_HOLD_DURATION_MS = 1500;

const isEditable = (el: HTMLElement | null): boolean => {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName || "").toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return true;
  return !!el.closest?.("input, textarea, [contenteditable='true'], .monaco-editor");
};

export function useDesignerKeyboardShortcuts({
  onSaveCurrentVersion,
  onSaveIncrementedVersion,
}: {
  onSaveCurrentVersion?: () => void;
  onSaveIncrementedVersion?: () => void;
}) {
  // Only the hold-delete flow needs to react to state; everything else is read via getState()
  // inside the (once-bound) listeners.
  const selectedId = useDesignerStore((s) => s.selectedId);
  const holdDeleteNodeId = useDesignerStore((s) => s.holdDeleteNodeId);

  const { error: showErrorNotification } = useWeaverNotification();
  const copiedNodeRef = useRef<any>(null);

  // Deleting a node requires holding Delete/Backspace; the node shows the progress.
  const deleteHold = useHoldToConfirm({
    keys: DELETE_HOLD_KEYS,
    duration: DELETE_HOLD_DURATION_MS,
    onHoldStart: () =>
      useDesignerStore.getState().setHoldDeleteNodeId(useDesignerStore.getState().selectedId),
    onHoldCancel: () => useDesignerStore.getState().setHoldDeleteNodeId(null),
    onConfirm: () => {
      const state = useDesignerStore.getState();
      const targetId = state.holdDeleteNodeId;
      state.setHoldDeleteNodeId(null);
      if (targetId && targetId === state.selectedId) {
        state.deleteSelectedNode((msg) => showErrorNotification(msg));
      }
    },
  });
  const { onKeyDown: onDeleteHoldKeyDown, onKeyUp: onDeleteHoldKeyUp } = deleteHold.handlers;
  const cancelDeleteHold = deleteHold.cancelHold;

  // Latest callbacks, read by the listeners below so they can be bound once.
  const latestRef = useRef({
    onSaveCurrentVersion,
    onSaveIncrementedVersion,
    onDeleteHoldKeyDown,
    onDeleteHoldKeyUp,
    cancelDeleteHold,
  });
  latestRef.current = {
    onSaveCurrentVersion,
    onSaveIncrementedVersion,
    onDeleteHoldKeyDown,
    onDeleteHoldKeyUp,
    cancelDeleteHold,
  };

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => latestRef.current.onDeleteHoldKeyUp(e);
    const handleBlur = () => latestRef.current.cancelDeleteHold();
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Abort the hold if the selection moves away from the node being deleted.
  useEffect(() => {
    if (holdDeleteNodeId && holdDeleteNodeId !== selectedId) {
      cancelDeleteHold();
    }
  }, [holdDeleteNodeId, selectedId, cancelDeleteHold]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const state = useDesignerStore.getState();
      const latest = latestRef.current;

      if (e.ctrlKey && key === "insert") {
        e.preventDefault();
        state.setActionsPanelOpen(true);
        return;
      }

      if (isMod && key === "s") {
        e.preventDefault();
        if (e.shiftKey) {
          latest.onSaveIncrementedVersion?.();
        } else {
          latest.onSaveCurrentVersion?.();
        }
        return;
      }

      const target = (e.target || document.activeElement) as HTMLElement | null;
      if (isEditable(target)) return;

      // Undo / Redo (Workflow level when canvas is active and not inside input/monaco)
      if (isMod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        return;
      }

      if (isMod && key === "y") {
        e.preventDefault();
        state.redo();
        return;
      }

      const { nodes, selectedId: currentSelectedId, selectedEdgeId } = state;

      if (key === "delete" || key === "backspace") {
        if (selectedEdgeId) {
          e.preventDefault();
          state.deleteSelectedEdge();
          return;
        }
        if (currentSelectedId) {
          e.preventDefault();
          const selNode = nodes.find((n) => n.id === currentSelectedId);
          if (selNode && !isStartNode(selNode) && !isEndNode(selNode)) {
            latest.onDeleteHoldKeyDown(e);
          }
        }
        return;
      }

      if (isMod && key === "c") {
        const selNode = nodes.find((n) => n.id === currentSelectedId);
        if (selNode && !isStartNode(selNode)) {
          copiedNodeRef.current = JSON.parse(JSON.stringify(selNode));
        }
        return;
      }

      if (isMod && key === "v") {
        if (!copiedNodeRef.current) return;
        e.preventDefault();
        state.takeSnapshot();
        const base = copiedNodeRef.current;
        const newId = createUuid();
        const nextNode = {
          ...base,
          id: newId,
          position: {
            x: (base.position?.x ?? 0) + 40,
            y: (base.position?.y ?? 0) + 40,
          },
        };
        state.setNodes((nds) => nds.concat(nextNode));
        state.setSelectedId(newId);
        state.setSelectedNodeIds([newId]);
        state.setSelectedEdgeId(null);
        state.setWorkflowStatus("UNSAVED");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
