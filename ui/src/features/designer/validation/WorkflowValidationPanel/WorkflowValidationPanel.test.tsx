import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { WorkflowValidationPanel } from "./WorkflowValidationPanel";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

describe("WorkflowValidationPanel Component", () => {
  beforeEach(() => {
    useDesignerStore.setState({
      validationPanelOpen: true,
      workflowName: "test_workflow",
      nodes: [
        {
          id: START_NODE_ID,
          type: "startFlag",
          data: { name: "Start" },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
      selectedId: null,
      selectedNodeIds: [],
    });
  });

  it("renders when panel is open and displays header", () => {
    render(<WorkflowValidationPanel />);
    expect(screen.getByRole("region", { name: "Workflow Validation Panel" })).toBeInTheDocument();
    expect(screen.getByText("Workflow Validation")).toBeInTheDocument();
  });

  it("displays empty state when no validation issues exist", () => {
    render(<WorkflowValidationPanel />);
    expect(screen.getByText("No Validation Issues")).toBeInTheDocument();
  });

  it("displays validation issues and updates summary counts", () => {
    // Add an invalid node (missing URL on HTTP action)
    useDesignerStore.setState({
      nodes: [
        {
          id: START_NODE_ID,
          type: "startFlag",
          data: { name: "Start" },
          position: { x: 0, y: 0 },
        },
        {
          id: "node-http-1",
          type: "HTTP_ACTION",
          data: { name: "fetch_data", config: { referenceName: "fetch_data", url: "" } },
          position: { x: 100, y: 100 },
        },
      ],
      edges: [{ id: "e1", source: START_NODE_ID, target: "node-http-1" }],
    });

    render(<WorkflowValidationPanel />);
    expect(screen.getByText(/is missing a request URL/i)).toBeInTheDocument();
    expect(screen.getByText(/errors/i)).toBeInTheDocument();
  });

  it("filters issues by search query", () => {
    useDesignerStore.setState({
      nodes: [
        {
          id: START_NODE_ID,
          type: "startFlag",
          data: { name: "Start" },
          position: { x: 0, y: 0 },
        },
        {
          id: "node-http-1",
          type: "HTTP_ACTION",
          data: { name: "fetch_data", config: { referenceName: "fetch_data", url: "" } },
          position: { x: 100, y: 100 },
        },
      ],
      edges: [{ id: "e1", source: START_NODE_ID, target: "node-http-1" }],
    });

    render(<WorkflowValidationPanel />);
    const searchInput = screen.getByLabelText("Search validation issues");

    fireEvent.change(searchInput, { target: { value: "nonexistent query" } });
    expect(screen.getByText("No Matching Issues")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "HTTP" } });
    expect(screen.getByText(/is missing a request URL/i)).toBeInTheDocument();
  });

  it("selects node and opens config panel on issue click", () => {
    const mockFitView = vi.fn();
    useDesignerStore.setState({
      flowInstance: { fitView: mockFitView, setCenter: vi.fn() },
      nodePanelCollapsed: true,
      nodes: [
        {
          id: START_NODE_ID,
          type: "startFlag",
          data: { name: "Start" },
          position: { x: 0, y: 0 },
        },
        {
          id: "node-http-1",
          type: "HTTP_ACTION",
          data: { name: "fetch_data", config: { referenceName: "fetch_data", url: "" } },
          position: { x: 100, y: 100 },
        },
      ],
      edges: [{ id: "e1", source: START_NODE_ID, target: "node-http-1" }],
    });

    render(<WorkflowValidationPanel />);
    const issueCard = screen.getByTestId("issue-card-HTTP_URL_REQUIRED");
    fireEvent.click(issueCard);

    expect(useDesignerStore.getState().selectedId).toBe("node-http-1");
    expect(useDesignerStore.getState().nodePanelCollapsed).toBe(false);
  });

  it("clusters issues under node headers and provides quick-fix action", () => {
    // Add a node missing task reference name
    useDesignerStore.setState({
      nodes: [
        {
          id: START_NODE_ID,
          type: "startFlag",
          data: { name: "Start" },
          position: { x: 0, y: 0 },
        },
        {
          id: "node-task-99",
          type: "HTTP_ACTION",
          data: { name: "send_alert", config: { referenceName: "", url: "https://example.com" } },
          position: { x: 100, y: 100 },
        },
      ],
      edges: [{ id: "e1", source: START_NODE_ID, target: "node-task-99" }],
    });

    render(<WorkflowValidationPanel />);

    // Node header is visible
    expect(screen.getByText(/send_alert \(HTTP_ACTION\)/i)).toBeInTheDocument();

    // Quick fix button is rendered
    const quickFixBtn = screen.getByRole("button", { name: /auto-generate reference name/i });
    expect(quickFixBtn).toBeInTheDocument();

    // Clicking quick-fix generates reference name
    fireEvent.click(quickFixBtn);
    const updatedNode = useDesignerStore.getState().nodes.find((n) => n.id === "node-task-99");
    expect(updatedNode?.data?.config?.referenceName).toBeTruthy();
  });

  it("toggles node grouping and maximize height", () => {
    render(<WorkflowValidationPanel />);

    const groupBtn = screen.getByRole("button", { name: /toggle node grouping/i });
    fireEvent.click(groupBtn);
    expect(groupBtn).toBeInTheDocument();

    const expandBtn = screen.getByRole("button", { name: /expand console height/i });
    fireEvent.click(expandBtn);
    expect(screen.getByRole("button", { name: /restore height/i })).toBeInTheDocument();
  });
});
