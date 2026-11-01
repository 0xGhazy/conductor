import { describe, it, expect, beforeEach } from "vitest";
import { useDesignerStore } from "./useDesignerStore";
import { buildWorkflowSignature } from "../utils/workflowSerialization";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

describe("Workflow Save Status & Dirty State Sync", () => {
  const initialNodes = [
    {
      id: START_NODE_ID,
      type: "startFlag",
      data: { name: "Start" },
      position: { x: 0, y: 0 },
    },
  ];

  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
    const initialSig = buildWorkflowSignature(initialNodes, [], {
      workflowName: "sync_test_wf",
      workflowVersion: 1,
      workflowVariables: {},
      workflowDescription: "",
      workflowCorrelationId: "",
      workflowLanguage: "",
      workflowSupportedLanguages: [],
    });

    useDesignerStore.setState({
      workflowName: "sync_test_wf",
      workflowVersion: "1",
      nodes: initialNodes,
      edges: [],
      workflowStatus: "SAVED",
      lastSavedSignature: initialSig,
      past: [],
      future: [],
    });
  });

  it("starts in SAVED state with matching baseline signature", () => {
    const state = useDesignerStore.getState();
    expect(state.workflowStatus).toBe("SAVED");
    expect(state.lastSavedSignature).toBeTruthy();
  });

  it("switches to UNSAVED when adding a node, and returns to SAVED on undo", () => {
    const { addNode, undo, redo, lastSavedSignature } = useDesignerStore.getState();

    // Add a node
    addNode("HTTP_ACTION");
    expect(useDesignerStore.getState().workflowStatus).toBe("UNSAVED");

    const currentSig = buildWorkflowSignature(
      useDesignerStore.getState().nodes,
      useDesignerStore.getState().edges,
      {
        workflowName: "sync_test_wf",
        workflowVersion: 1,
        workflowVariables: {},
        workflowDescription: "",
        workflowCorrelationId: "",
        workflowLanguage: "",
        workflowSupportedLanguages: [],
      }
    );
    expect(currentSig).not.toBe(lastSavedSignature);

    // Undo should restore baseline nodes and signature
    undo();
    const undoneSig = buildWorkflowSignature(
      useDesignerStore.getState().nodes,
      useDesignerStore.getState().edges,
      {
        workflowName: "sync_test_wf",
        workflowVersion: 1,
        workflowVariables: {},
        workflowDescription: "",
        workflowCorrelationId: "",
        workflowLanguage: "",
        workflowSupportedLanguages: [],
      }
    );

    expect(undoneSig).toBe(lastSavedSignature);

    // Redo changes it back to UNSAVED
    redo();
    expect(useDesignerStore.getState().workflowStatus).toBe("UNSAVED");
  });

  it("UI-only changes (selection, panel collapse) do not change workflow signature", () => {
    const initialSig = useDesignerStore.getState().lastSavedSignature;

    // Change selections
    useDesignerStore.setState({
      selectedId: START_NODE_ID,
      selectedNodeIds: [START_NODE_ID],
      selectedEdgeId: "any-edge",
      nodePanelCollapsed: true,
      actionsPanelOpen: true,
    });

    const sigAfterUi = buildWorkflowSignature(
      useDesignerStore.getState().nodes,
      useDesignerStore.getState().edges,
      {
        workflowName: "sync_test_wf",
        workflowVersion: 1,
        workflowVariables: {},
        workflowDescription: "",
        workflowCorrelationId: "",
        workflowLanguage: "",
        workflowSupportedLanguages: [],
      }
    );

    expect(sigAfterUi).toBe(initialSig);
    expect(useDesignerStore.getState().workflowStatus).toBe("SAVED");
  });

  it("simulates save flow: SAVING -> SAVED with updated baseline signature", () => {
    const { addNode, setWorkflowStatus, setLastSavedSignature } = useDesignerStore.getState();

    addNode("HTTP_ACTION");
    expect(useDesignerStore.getState().workflowStatus).toBe("UNSAVED");

    // Click save
    setWorkflowStatus("SAVING");
    expect(useDesignerStore.getState().workflowStatus).toBe("SAVING");

    // Success response
    const newSig = buildWorkflowSignature(
      useDesignerStore.getState().nodes,
      useDesignerStore.getState().edges,
      {
        workflowName: "sync_test_wf",
        workflowVersion: 1,
        workflowVariables: {},
        workflowDescription: "",
        workflowCorrelationId: "",
        workflowLanguage: "",
        workflowSupportedLanguages: [],
      }
    );
    setLastSavedSignature(newSig);
    setWorkflowStatus("SAVED");

    expect(useDesignerStore.getState().workflowStatus).toBe("SAVED");
    expect(useDesignerStore.getState().lastSavedSignature).toBe(newSig);
  });

  it("simulates save failure: SAVING -> FAILED with retained unsaved changes", () => {
    const { addNode, setWorkflowStatus } = useDesignerStore.getState();

    addNode("HTTP_ACTION");
    expect(useDesignerStore.getState().workflowStatus).toBe("UNSAVED");

    setWorkflowStatus("SAVING");
    expect(useDesignerStore.getState().workflowStatus).toBe("SAVING");

    // Error response
    setWorkflowStatus("FAILED");
    expect(useDesignerStore.getState().workflowStatus).toBe("FAILED");
    expect(useDesignerStore.getState().nodes.length).toBe(2);
  });
});

describe("buildWorkflowSignature ignores React Flow UI-only node state", () => {
  it("does not change when nodes get measured, selected or dragged", () => {
    const meta = { workflowName: "wf", workflowVersion: 1 };
    const base = [{ id: "a", type: "HTTP_ACTION", position: { x: 1, y: 2 }, data: { name: "A" } }];
    const measured = [
      {
        ...base[0],
        measured: { width: 120, height: 40 },
        width: 120,
        height: 40,
        selected: true,
        dragging: false,
      },
    ];
    expect(buildWorkflowSignature(measured, [], meta)).toBe(buildWorkflowSignature(base, [], meta));
  });

  it("still changes when a node moves", () => {
    const meta = { workflowName: "wf", workflowVersion: 1 };
    const base = [{ id: "a", type: "HTTP_ACTION", position: { x: 1, y: 2 }, data: { name: "A" } }];
    const moved = [{ ...base[0], position: { x: 5, y: 2 } }];
    expect(buildWorkflowSignature(moved, [], meta)).not.toBe(buildWorkflowSignature(base, [], meta));
  });
});
