import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { WeaverNodeConfigurationPanel } from "./WeaverNodeConfigurationPanel";
import { registerNodeDefinition } from "../nodeDefinitionRegistry";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";

// Mock WeaverCodeEditor for deterministic jsdom test execution
vi.mock("@/components/common/editors", () => ({
  WeaverCodeEditor: ({ value, language }: any) => (
    <div data-testid="mock-code-editor" data-language={language}>
      {value}
    </div>
  ),
}));

// Mock databases API for Database config
vi.mock("@/features/databases/services/databasesApi", () => ({
  fetchDatasources: vi.fn().mockResolvedValue({ data: [] }),
}));

// Mock connections API for HTTP config
vi.mock("@/features/connections/services/connectionsApi", () => ({
  fetchConnections: vi.fn().mockResolvedValue([]),
}));

// Mock apiCollections API for HTTP config
vi.mock("@/features/collections/services/apiCollectionsApi", () => ({
  fetchCollections: vi.fn().mockResolvedValue([]),
  fetchCollectionEndpoints: vi.fn().mockResolvedValue([]),
}));

describe("WeaverNodeConfigurationPanel", () => {
  beforeEach(() => {
    useWorkflowExecutionStore.getState().resetExecution();
  });
  const startNode: Node = {
    id: "00000000-0000-0000-0000-000000000000",
    type: "startFlag",
    position: { x: 0, y: 0 },
    data: {
      name: "Start",
      config: {
        name: "My Workflow",
        timeoutSeconds: 15,
        timeoutPolicy: "TIME_OUT_WF",
      },
    },
  };

  const httpNode: Node = {
    id: "http-node-1",
    type: "HTTP_ACTION",
    position: { x: 100, y: 100 },
    data: {
      name: "HTTP",
      config: {
        name: "call_payment_api",
        method: "POST",
        url: "https://api.payments.com/charge",
        timeout: 5000,
      },
    },
  };

  const switchNode: Node = {
    id: "switch-node-1",
    type: "SWITCH_ACTION",
    position: { x: 200, y: 200 },
    data: {
      name: "Switch",
      config: {
        name: "check_role_switch",
        evaluatorType: "value-param",
        expression: "workflow.input.role",
        cases: [
          { id: "case-1", value: "admin", label: "Admin" },
          { id: "case-2", value: "user", label: "Standard User" },
        ],
      },
    },
  };

  it("renders empty state when no node is selected", () => {
    render(<WeaverNodeConfigurationPanel selectedNode={null} />);

    expect(screen.getByText("Select a node to inspect or configure it.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("renders header and node-defined tabs when START node is selected", () => {
    render(<WeaverNodeConfigurationPanel selectedNode={startNode} />);

    expect(screen.getByText("My Workflow")).toBeInTheDocument();
    expect(screen.getByText("Start Node")).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent("Configuration");
    expect(tabs[1]).toHaveTextContent("JSON");
    expect(screen.queryByText("Logs")).not.toBeInTheDocument();
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
  });

  it("renders HTTP node with 3 tabs by default when showLogs is false, and 4 tabs when showLogs is true", () => {
    const { rerender } = render(<WeaverNodeConfigurationPanel selectedNode={httpNode} />);

    expect(screen.getByText("call_payment_api")).toBeInTheDocument();
    expect(screen.getByText("HTTP Node")).toBeInTheDocument();

    let tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent("Configuration");
    expect(tabs[1]).toHaveTextContent("JSON");
    expect(tabs[2]).toHaveTextContent("Result");
    expect(screen.queryByText("Logs")).not.toBeInTheDocument();

    // Enable showLogs in execution store
    useWorkflowExecutionStore.getState().setOption("showLogs", true);
    rerender(<WeaverNodeConfigurationPanel selectedNode={httpNode} />);

    tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent("Configuration");
    expect(tabs[1]).toHaveTextContent("JSON");
    expect(tabs[2]).toHaveTextContent("Result");
    expect(tabs[3]).toHaveTextContent("Logs");
  });

  it("renders SWITCH node with 3 tabs: Configuration, JSON, and Result", () => {
    render(<WeaverNodeConfigurationPanel selectedNode={switchNode} />);

    expect(screen.getByText("check_role_switch")).toBeInTheDocument();
    expect(screen.getByText("Switch Node")).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent("Configuration");
    expect(tabs[1]).toHaveTextContent("JSON");
    expect(tabs[2]).toHaveTextContent("Result");
    expect(screen.queryByText("Logs")).not.toBeInTheDocument();
  });

  it("allows switching tabs and displays JSON tab content", () => {
    render(<WeaverNodeConfigurationPanel selectedNode={httpNode} />);

    const jsonTab = screen.getByRole("tab", { name: /json/i });
    fireEvent.click(jsonTab);

    expect(jsonTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("mock-code-editor")).toBeInTheDocument();
  });

  it("renders Result empty state when no execution result is present", () => {
    render(<WeaverNodeConfigurationPanel selectedNode={httpNode} />);

    const resultTab = screen.getByRole("tab", { name: /result/i });
    fireEvent.click(resultTab);

    expect(screen.getByText("No result available for this node.")).toBeInTheDocument();
  });

  it("renders Logs empty state when no execution logs match the node and showLogs is true", () => {
    useWorkflowExecutionStore.getState().setOption("showLogs", true);
    render(<WeaverNodeConfigurationPanel selectedNode={httpNode} />);

    const logsTab = screen.getByRole("tab", { name: /logs/i });
    fireEvent.click(logsTab);

    expect(screen.getByText("No logs available for this node.")).toBeInTheDocument();
  });

  it("supports collapsing and expanding the panel", () => {
    const { rerender } = render(
      <WeaverNodeConfigurationPanel selectedNode={httpNode} collapsed={false} />
    );

    expect(screen.getByText("call_payment_api")).toBeInTheDocument();

    // Rerender as collapsed
    rerender(<WeaverNodeConfigurationPanel selectedNode={httpNode} collapsed={true} />);

    expect(screen.queryByText("call_payment_api")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expand node configuration")).toBeInTheDocument();
  });

  it("calls onUpdateConfig with correct patch when a field changes", () => {
    const handleUpdate = vi.fn();
    render(
      <WeaverNodeConfigurationPanel
        selectedNode={httpNode}
        onUpdateConfig={handleUpdate}
      />
    );

    const urlInput = screen.getByLabelText(/url/i);
    fireEvent.change(urlInput, { target: { value: "https://api.payments.com/v2/new" } });

    expect(handleUpdate).toHaveBeenCalledWith(
      "http-node-1",
      expect.objectContaining({ url: "https://api.payments.com/v2/new" })
    );
  });

  it("renders unsupported node type message gracefully", () => {
    const unknownNode: Node = {
      id: "unknown-1",
      type: "COMPLETELY_UNSUPPORTED_TYPE_XYZ",
      position: { x: 0, y: 0 },
      data: { name: "Custom Experimental" },
    };

    render(<WeaverNodeConfigurationPanel selectedNode={unknownNode} />);

    expect(screen.getByText("Unsupported Node Type")).toBeInTheDocument();
    expect(screen.getByText("Configuration unavailable for this node type.")).toBeInTheDocument();
  });

  it("supports custom tab rendering function", () => {
    const customDef = {
      type: "CUSTOM_TAB_NODE",
      label: "Custom Tab Node",
      tabs: [
        {
          id: "custom-insights",
          label: "Insights",
          render: (context: any) => (
            <div data-testid="custom-insights-view">
              Insights for node: {context.node.id}
            </div>
          ),
        },
      ],
    };

    registerNodeDefinition(customDef as any);

    const customNode: Node = {
      id: "custom-node-99",
      type: "CUSTOM_TAB_NODE",
      position: { x: 0, y: 0 },
      data: { name: "Insights Worker" },
    };

    render(<WeaverNodeConfigurationPanel selectedNode={customNode} />);

    expect(screen.getByRole("tab", { name: /insights/i })).toBeInTheDocument();
    expect(screen.getByTestId("custom-insights-view")).toHaveTextContent("Insights for node: custom-node-99");
  });

  describe("Resizing behavior", () => {
    it("renders the resize handle on the leading edge", () => {
      render(<WeaverNodeConfigurationPanel selectedNode={httpNode} />);

      const handle = screen.getByRole("separator", {
        name: /resize node configuration panel/i,
      });
      expect(handle).toBeInTheDocument();
    });

    it("resizes the panel width when dragging the handle", () => {
      const handleWidthChange = vi.fn();
      render(
        <WeaverNodeConfigurationPanel
          selectedNode={httpNode}
          defaultWidth={380}
          onWidthChange={handleWidthChange}
        />
      );

      const handle = screen.getByRole("separator", {
        name: /resize node configuration panel/i,
      });

      // Pointer down at clientX: 500
      fireEvent.pointerDown(handle, { clientX: 500 });

      // Move left by 80px (clientX: 420) -> should increase width by 80px to 460px
      fireEvent(
        window,
        new MouseEvent("pointermove", { clientX: 420, bubbles: true })
      );

      expect(handleWidthChange).toHaveBeenCalledWith(460);

      // Release pointer
      fireEvent(
        window,
        new MouseEvent("pointerup", { clientX: 420, bubbles: true })
      );
    });

    it("resets panel width to default on double click", () => {
      const handleWidthChange = vi.fn();
      render(
        <WeaverNodeConfigurationPanel
          selectedNode={httpNode}
          defaultWidth={380}
          onWidthChange={handleWidthChange}
        />
      );

      const handle = screen.getByRole("separator", {
        name: /resize node configuration panel/i,
      });

      fireEvent.doubleClick(handle);

      expect(handleWidthChange).toHaveBeenCalledWith(380);
    });
  });
});
