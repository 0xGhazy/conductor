import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { WeaverNotificationProvider } from "@/components/common/notifications";
import { WeaverTaskNode } from "@/features/designer/nodes/WeaverTaskNode";
import { TerminateActionNode } from "@/features/designer/components/actions/terminate";
import { SwitchActionNode } from "@/features/designer/components/actions/switch";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <WeaverNotificationProvider>
      <ReactFlowProvider>{ui}</ReactFlowProvider>
    </WeaverNotificationProvider>
  );
};

describe("Non-Terminal Nodes (+) Button and Auto-Rearrange", () => {
  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
  });

  it("renders the (+) handle button on WeaverTaskNode for non-terminal nodes", () => {
    renderWithProviders(
      <WeaverTaskNode
        id="http-1"
        title="HTTP Node"
        taskReferenceName="http_ref"
      />
    );

    const plusHandle = screen.getByLabelText("Add next node");
    expect(plusHandle).toBeInTheDocument();
    expect(plusHandle).toHaveClass("action-node-handle-plus");
  });

  it("does NOT render the (+) handle button on TerminateActionNode (terminal node)", () => {
    renderWithProviders(
      <TerminateActionNode
        id="term-1"
        data={{ name: "Terminate Workflow" } as any}
      />
    );

    expect(screen.queryByLabelText("Add next node")).not.toBeInTheDocument();
    expect(document.querySelector(".action-node-handle-plus")).toBeNull();
  });

  it("sets pendingConnectionSource and opens action panel when (+) handle is clicked on WeaverTaskNode", () => {
    useDesignerStore.setState({ actionsPanelOpen: false, pendingConnectionSource: null });

    renderWithProviders(
      <WeaverTaskNode
        id="http-1"
        title="HTTP Node"
        taskReferenceName="http_ref"
      />
    );

    const plusHandle = screen.getByLabelText("Add next node");
    fireEvent.click(plusHandle);

    expect(useDesignerStore.getState().actionsPanelOpen).toBe(true);
    expect(useDesignerStore.getState().pendingConnectionSource).toBe("http-1");
  });

  it("connects new node to the non-terminal source node and auto-rearranges top-to-bottom", () => {
    // Start with Start -> HTTP
    const httpNodeId = "http-1";
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat({
        id: httpNodeId,
        type: "HTTP_ACTION",
        position: { x: 200, y: 150 },
        data: { name: "HTTP Task" },
      } as any),
      edges: [
        {
          id: "edge-start-http",
          source: START_NODE_ID,
          sourceHandle: "workflow-entry-point",
          target: httpNodeId,
        } as any,
      ],
      pendingConnectionSource: httpNodeId,
    }));

    // Add Database node via (+) from HTTP
    const dbNodeId = useDesignerStore.getState().addNode("DATABASE_ACTION");
    expect(dbNodeId).toBeTruthy();

    const state = useDesignerStore.getState();

    // Verify Edge exists from HTTP -> Database
    const edge = state.edges.find((e) => e.source === httpNodeId && e.target === dbNodeId);
    expect(edge).toBeDefined();

    // Verify pending connection is reset
    expect(state.pendingConnectionSource).toBeNull();

    // Verify auto-rearrangement: Database node is placed below HTTP node
    const httpNode = state.nodes.find((n) => n.id === httpNodeId);
    const dbNode = state.nodes.find((n) => n.id === dbNodeId);
    expect(httpNode).toBeDefined();
    expect(dbNode).toBeDefined();
    if (httpNode && dbNode) {
      expect(dbNode.position.y).toBeGreaterThan(httpNode.position.y);
    }
  });

  it("splices new node between non-terminal source and its existing target", () => {
    // Setup chain: Start -> HTTP -> Database
    const httpNodeId = "http-1";
    const dbNodeId = "db-1";
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat([
        {
          id: httpNodeId,
          type: "HTTP_ACTION",
          position: { x: 200, y: 150 },
          data: { name: "HTTP Task" },
        } as any,
        {
          id: dbNodeId,
          type: "DATABASE_ACTION",
          position: { x: 200, y: 300 },
          data: { name: "Database" },
        } as any,
      ]),
      edges: [
        {
          id: "edge-start-http",
          source: START_NODE_ID,
          target: httpNodeId,
        } as any,
        {
          id: "edge-http-db",
          source: httpNodeId,
          target: dbNodeId,
        } as any,
      ],
      pendingConnectionSource: httpNodeId,
    }));

    // Add Wait node between HTTP and Database
    const waitNodeId = useDesignerStore.getState().addNode("WAIT_ACTION");
    expect(waitNodeId).toBeTruthy();

    const state = useDesignerStore.getState();

    // Direct edge from HTTP -> Database should be removed
    expect(
      state.edges.some((e) => e.source === httpNodeId && e.target === dbNodeId)
    ).toBe(false);

    // New chain: HTTP -> Wait -> Database
    expect(
      state.edges.some((e) => e.source === httpNodeId && e.target === waitNodeId)
    ).toBe(true);
    expect(
      state.edges.some((e) => e.source === waitNodeId && e.target === dbNodeId)
    ).toBe(true);

    // Verify vertical ordering: HTTP < Wait < Database
    const httpNode = state.nodes.find((n) => n.id === httpNodeId);
    const waitNode = state.nodes.find((n) => n.id === waitNodeId);
    const dbNode = state.nodes.find((n) => n.id === dbNodeId);
    expect(httpNode).toBeDefined();
    expect(waitNode).toBeDefined();
    expect(dbNode).toBeDefined();
    if (httpNode && waitNode && dbNode) {
      expect(waitNode.position.y).toBeGreaterThan(httpNode.position.y);
      expect(dbNode.position.y).toBeGreaterThan(waitNode.position.y);
    }
  });

  it("renders (+) buttons on each SwitchNode case and connects to the specific case branch", () => {
    const switchNodeId = "switch-1";
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat({
        id: switchNodeId,
        type: "SWITCH_ACTION",
        position: { x: 200, y: 150 },
        data: {
          name: "Switch",
          config: {
            cases: [
              { id: "case-a", value: "A", label: "Branch A" },
              { id: "case-b", value: "B", label: "Branch B" },
            ],
          },
        },
      } as any),
      pendingConnectionSource: null,
    }));

    renderWithProviders(
      <SwitchActionNode
        id={switchNodeId}
        data={
          {
            name: "Switch",
            config: {
              cases: [
                { id: "case-a", value: "A", label: "Branch A" },
                { id: "case-b", value: "B", label: "Branch B" },
              ],
            },
          } as any
        }
      />
    );

    // Check plus buttons exist for Branch A and Branch B
    const plusA = screen.getByLabelText("Add next node to Branch A");
    const plusB = screen.getByLabelText("Add next node to Branch B");
    expect(plusA).toBeInTheDocument();
    expect(plusB).toBeInTheDocument();

    // Click plus on Branch B
    fireEvent.click(plusB);
    expect(useDesignerStore.getState().pendingConnectionSource).toBe(`${switchNodeId}::case-b`);
    expect(useDesignerStore.getState().actionsPanelOpen).toBe(true);

    // Add HTTP Task to Branch B
    const newNodeId = useDesignerStore.getState().addNode("HTTP_ACTION");
    const state = useDesignerStore.getState();

    // Edge should connect SwitchNode (case-b) -> New Node
    const branchEdge = state.edges.find(
      (e) => e.source === switchNodeId && e.target === newNodeId && e.sourceHandle === "case-b"
    );
    expect(branchEdge).toBeDefined();
  });

  it("automatically rearrenges nodes after deleting a node", () => {
    // Setup chain: Start -> HTTP -> Database
    const httpNodeId = "http-1";
    const dbNodeId = "db-1";
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat([
        {
          id: httpNodeId,
          type: "HTTP_ACTION",
          position: { x: 200, y: 150 },
          data: { name: "HTTP Task" },
        } as any,
        {
          id: dbNodeId,
          type: "DATABASE_ACTION",
          position: { x: 200, y: 350 },
          data: { name: "Database" },
        } as any,
      ]),
      edges: [
        {
          id: "edge-start-http",
          source: START_NODE_ID,
          target: httpNodeId,
        } as any,
        {
          id: "edge-http-db",
          source: httpNodeId,
          target: dbNodeId,
        } as any,
      ],
      selectedId: dbNodeId,
    }));

    // Delete Database node
    const deleted = useDesignerStore.getState().deleteSelectedNode();
    expect(deleted).toBe(true);

    const state = useDesignerStore.getState();
    expect(state.nodes.some((n) => n.id === dbNodeId)).toBe(false);

    // Remaining nodes should be auto-arranged top-to-bottom
    const startNode = state.nodes.find((n) => n.id === START_NODE_ID);
    const httpNode = state.nodes.find((n) => n.id === httpNodeId);
    expect(startNode).toBeDefined();
    expect(httpNode).toBeDefined();
    if (startNode && httpNode) {
      expect(httpNode.position.y).toBeGreaterThan(startNode.position.y);
    }
  });
});
