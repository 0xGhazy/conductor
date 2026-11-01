import { describe, it, expect, beforeEach } from "vitest";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

describe("Undo / Redo System", () => {
  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
    useDesignerStore.setState({
      workflowName: "test_history_wf",
      workflowVersion: "1",
      nodes: [
        {
          id: START_NODE_ID,
          type: "startFlag",
          data: { name: "Start" },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it("starts with empty history and disabled undo/redo", () => {
    const { past, future, canUndo, canRedo } = useDesignerStore.getState();
    expect(past.length).toBe(0);
    expect(future.length).toBe(0);
    expect(canUndo).toBe(false);
    expect(canRedo).toBe(false);
  });

  it("records history snapshot when adding a node and allows undoing it", () => {
    const { addNode, undo, redo } = useDesignerStore.getState();

    // Initial node count is 1 (Start node)
    expect(useDesignerStore.getState().nodes.length).toBe(1);

    // Add HTTP node
    const addedId = addNode("HTTP_ACTION");
    expect(addedId).toBeTruthy();
    expect(useDesignerStore.getState().nodes.length).toBe(2);
    expect(useDesignerStore.getState().canUndo).toBe(true);
    expect(useDesignerStore.getState().past.length).toBe(1);

    // Undo should restore back to 1 node
    undo();
    expect(useDesignerStore.getState().nodes.length).toBe(1);
    expect(useDesignerStore.getState().canUndo).toBe(false);
    expect(useDesignerStore.getState().canRedo).toBe(true);

    // Redo should restore the added node
    redo();
    expect(useDesignerStore.getState().nodes.length).toBe(2);
    expect(useDesignerStore.getState().canUndo).toBe(true);
    expect(useDesignerStore.getState().canRedo).toBe(false);
  });

  it("records history snapshot when deleting a node and restores it on undo", () => {
    const { addNode, deleteSelectedNode, undo } = useDesignerStore.getState();

    const addedId = addNode("HTTP_ACTION");
    expect(useDesignerStore.getState().nodes.length).toBe(2);

    // Select the added node and delete it
    useDesignerStore.setState({ selectedId: addedId });
    const deleted = deleteSelectedNode();
    expect(deleted).toBe(true);
    expect(useDesignerStore.getState().nodes.length).toBe(1);

    // Undo deletion
    undo();
    expect(useDesignerStore.getState().nodes.length).toBe(2);
    expect(useDesignerStore.getState().nodes.some((n) => n.id === addedId)).toBe(true);
  });

  it("records history snapshot when updating node config and reverts on undo", () => {
    const { addNode, updateNodeConfig, undo, redo } = useDesignerStore.getState();

    const addedId = addNode("HTTP_ACTION");
    expect(addedId).toBeTruthy();

    // Update config
    updateNodeConfig(addedId!, { url: "https://initial.com" });
    expect(useDesignerStore.getState().nodes.find((n) => n.id === addedId)?.data?.config?.url).toBe(
      "https://initial.com"
    );

    // Undo reverts back to empty or previous config
    undo();
    expect(
      useDesignerStore.getState().nodes.find((n) => n.id === addedId)?.data?.config?.url
    ).toBe("");

    // Redo reapplies config
    redo();
    expect(useDesignerStore.getState().nodes.find((n) => n.id === addedId)?.data?.config?.url).toBe(
      "https://initial.com"
    );
  });

  it("clears redo stack (future) when a new change is made after an undo", () => {
    const { addNode, undo } = useDesignerStore.getState();

    addNode("HTTP_ACTION");
    expect(useDesignerStore.getState().nodes.length).toBe(2);

    undo();
    expect(useDesignerStore.getState().nodes.length).toBe(1);
    expect(useDesignerStore.getState().canRedo).toBe(true);
    expect(useDesignerStore.getState().future.length).toBe(1);

    // Making a new change clears the future stack
    addNode("DATABASE_ACTION");
    expect(useDesignerStore.getState().canRedo).toBe(false);
    expect(useDesignerStore.getState().future.length).toBe(0);
  });

  it("limits maximum history size to avoid excessive memory consumption", () => {
    const { takeSnapshot } = useDesignerStore.getState();

    // Push 60 snapshots
    for (let i = 0; i < 60; i++) {
      takeSnapshot();
    }

    const { past } = useDesignerStore.getState();
    expect(past.length).toBeLessThanOrEqual(50);
  });

  it("clears history on resetWorkflowState or clearHistory", () => {
    const { addNode, clearHistory } = useDesignerStore.getState();
    addNode("HTTP_ACTION");
    expect(useDesignerStore.getState().past.length).toBeGreaterThan(0);

    clearHistory();
    expect(useDesignerStore.getState().past.length).toBe(0);
    expect(useDesignerStore.getState().future.length).toBe(0);
    expect(useDesignerStore.getState().canUndo).toBe(false);
  });
});
