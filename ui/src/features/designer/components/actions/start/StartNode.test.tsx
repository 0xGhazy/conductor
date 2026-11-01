import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { StartNode } from "./StartNode";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

describe("StartNode with (+) Handle Button", () => {
  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
  });

  it("renders the start node and the (+) handle button", () => {
    render(
      <ReactFlowProvider>
        <StartNode data={{ name: "Start" } as any} />
      </ReactFlowProvider>
    );

    expect(screen.getByText("Start")).toBeInTheDocument();
    const plusHandle = screen.getByLabelText("Add next node");
    expect(plusHandle).toBeInTheDocument();
    expect(plusHandle).toHaveClass("start-node-handle-plus");
  });

  it("renders 'Start' title and does NOT display workflow name", () => {
    render(
      <ReactFlowProvider>
        <StartNode data={{ name: "My Custom Workflow Name" } as any} />
      </ReactFlowProvider>
    );

    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.queryByText("My Custom Workflow Name")).not.toBeInTheDocument();
    const wrapper = screen.getByTitle("Start");
    expect(wrapper).toHaveClass("nodrag");
  });

  it("opens actions panel and sets pendingConnectionSource when (+) button is clicked", () => {
    useDesignerStore.setState({ actionsPanelOpen: false, pendingConnectionSource: null });

    render(
      <ReactFlowProvider>
        <StartNode data={{ name: "Start" } as any} />
      </ReactFlowProvider>
    );

    const plusHandle = screen.getByLabelText("Add next node");
    fireEvent.click(plusHandle);

    expect(useDesignerStore.getState().actionsPanelOpen).toBe(true);
    expect(useDesignerStore.getState().pendingConnectionSource).toBe(START_NODE_ID);
  });

  it("toggles off pendingConnectionSource when (+) button is clicked again", () => {
    useDesignerStore.setState({ pendingConnectionSource: START_NODE_ID });

    render(
      <ReactFlowProvider>
        <StartNode data={{ name: "Start" } as any} />
      </ReactFlowProvider>
    );

    const plusHandle = screen.getByLabelText("Add next node");
    fireEvent.click(plusHandle);

    expect(useDesignerStore.getState().pendingConnectionSource).toBeNull();
  });

  it("connects new node with start node and runs auto-layout when node is selected", () => {
    useDesignerStore.setState({ pendingConnectionSource: START_NODE_ID });

    // Select a node (e.g. HTTP_ACTION)
    const newNodeId = useDesignerStore.getState().addNode("HTTP_ACTION");
    expect(newNodeId).toBeTruthy();

    const state = useDesignerStore.getState();

    // 1. New node exists
    const httpNode = state.nodes.find((n) => n.id === newNodeId);
    expect(httpNode).toBeDefined();

    // 2. An edge is created connecting Start to the new node
    const edge = state.edges.find(
      (e) => e.source === START_NODE_ID && e.target === newNodeId
    );
    expect(edge).toBeDefined();
    expect(edge?.sourceHandle).toBe("workflow-entry-point");

    // 3. pendingConnectionSource is cleared
    expect(state.pendingConnectionSource).toBeNull();

    // 4. Node is positioned below the start node via auto-layout (Top to Bottom)
    const startNode = state.nodes.find((n) => n.id === START_NODE_ID);
    expect(startNode).toBeDefined();
    if (startNode && httpNode) {
      expect(httpNode.position.y).toBeGreaterThan(startNode.position.y);
    }
  });

  it("inserts new node between start and existing node when start already has an outgoing edge", () => {
    // Setup existing edge: Start -> NodeA
    const existingNodeId = "existing-node-1";
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat({
        id: existingNodeId,
        type: "DATABASE_ACTION",
        position: { x: 220, y: 300 },
        data: { name: "Database" },
      } as any),
      edges: [
        {
          id: "edge-start-db",
          source: START_NODE_ID,
          sourceHandle: "workflow-entry-point",
          target: existingNodeId,
        } as any,
      ],
      pendingConnectionSource: START_NODE_ID,
    }));

    // Add HTTP_ACTION via (+) handle selection
    const newNodeId = useDesignerStore.getState().addNode("HTTP_ACTION");
    expect(newNodeId).toBeTruthy();

    const state = useDesignerStore.getState();

    // Old direct edge from start to database should be replaced
    expect(
      state.edges.some((e) => e.source === START_NODE_ID && e.target === existingNodeId)
    ).toBe(false);

    // Edge 1: Start -> New Node
    expect(
      state.edges.some((e) => e.source === START_NODE_ID && e.target === newNodeId)
    ).toBe(true);

    // Edge 2: New Node -> Database
    expect(
      state.edges.some((e) => e.source === newNodeId && e.target === existingNodeId)
    ).toBe(true);
  });
});
