import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowVersionDiffModal } from "./WorkflowVersionDiffModal";
import { ParameterDiffDrawer } from "./ParameterDiffDrawer";
import { DiffNode } from "./DiffNode";
import { ReactFlowProvider } from "@xyflow/react";

// Mock zustand stores
vi.mock("@/features/designer/store/useDesignerStore", () => {
  return {
    useDesignerStore: vi.fn((selector) => {
      const state = {
        workflowDiffModalOpen: true,
        setWorkflowDiffModalOpen: vi.fn(),
        workflowName: "order_fulfillment_flow",
        workflowVersion: "2",
        workflowVersions: [2, 1],
        themeMode: "light",
      };
      return selector ? selector(state) : state;
    }),
  };
});

// Mock notifications
vi.mock("@/components/common/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/common/notifications")>()),
  useWeaverNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock designer actions
const mockApplyLoadedWorkflowTopology = vi.fn();
vi.mock("@/features/designer/hooks/useDesignerActions", () => ({
  useDesignerActions: () => ({
    applyLoadedWorkflowTopology: mockApplyLoadedWorkflowTopology,
  }),
}));

// Mock API
vi.mock("@/features/designer/services/designerApi", () => ({
  fetchWorkflowJsonByName: vi.fn(async (name, version) => ({
    name,
    version: Number(version),
    tasks:
      Number(version) === 2
        ? [
            {
              name: "http_task",
              taskReferenceName: "fetch_order",
              type: "HTTP_ACTION",
              inputParameters: { url: "https://api.v2.com" },
            },
            {
              name: "new_validation",
              taskReferenceName: "validate_payment",
              type: "VALIDATION_ACTION",
            },
          ]
        : [
            {
              name: "http_task",
              taskReferenceName: "fetch_order",
              type: "HTTP_ACTION",
              inputParameters: { url: "https://api.v1.com" },
            },
          ],
  })),
}));

// Mock DiffJsonEditor
vi.mock("@/components/common/editors/DiffJsonEditor/DiffJsonEditor", () => ({
  default: ({ original, modified }: any) => (
    <div data-testid="monaco-diff-editor">
      <div data-testid="diff-original">{original}</div>
      <div data-testid="diff-modified">{modified}</div>
    </div>
  ),
}));

describe("WorkflowVersionDiffModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders comparison header, workflow name, and telemetry badges", async () => {
    render(<WorkflowVersionDiffModal open={true} onClose={vi.fn()} />);

    expect(screen.getByText("Version Comparison")).toBeInTheDocument();
    expect(screen.getByText("order_fulfillment_flow")).toBeInTheDocument();
    expect(screen.getByText("Visual DAG Diff")).toBeInTheDocument();
    expect(screen.getByText("JSON Diff")).toBeInTheDocument();

    await waitFor(() => {
      // Telemetry summary badges
      expect(screen.getByText(/Added/)).toBeInTheDocument();
      expect(screen.getByText(/Modified/)).toBeInTheDocument();
    });
  });

  it("switches to JSON Code Diff view when tab is clicked", async () => {
    render(<WorkflowVersionDiffModal open={true} onClose={vi.fn()} />);

    const jsonTabBtn = screen.getByText("JSON Diff");
    fireEvent.click(jsonTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId("monaco-diff-editor")).toBeInTheDocument();
    });
  });

  it("toggles locked viewports state", async () => {
    render(<WorkflowVersionDiffModal open={true} onClose={vi.fn()} />);

    const lockToggleBtn = screen.getByTitle(/Pan & Zoom Synchronized/);
    expect(lockToggleBtn).toBeInTheDocument();

    fireEvent.click(lockToggleBtn);
    expect(screen.getByText("Free Viewports")).toBeInTheDocument();
  });
});

describe("ParameterDiffDrawer", () => {
  it("renders modified parameter list with old and new values", () => {
    const selectedNode = {
      id: "node-1",
      taskReferenceName: "fetch_order",
      title: "Fetch Order Details",
      nodeType: "HTTP_ACTION",
      status: "modified" as const,
      parameterDiffs: [
        {
          key: "url",
          path: "url",
          oldValue: "https://api.v1.com",
          newValue: "https://api.v2.com",
          status: "modified" as const,
        },
      ],
      baseConfig: { url: "https://api.v1.com" },
      targetConfig: { url: "https://api.v2.com" },
    };

    render(
      <ParameterDiffDrawer
        selectedNode={selectedNode}
        baseVersion={1}
        targetVersion={2}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Fetch Order Details")).toBeInTheDocument();
    expect(screen.getByText("url")).toBeInTheDocument();
    expect(screen.getByText("https://api.v1.com")).toBeInTheDocument();
    expect(screen.getByText("https://api.v2.com")).toBeInTheDocument();
  });

  it("renders added task state and full config", () => {
    const selectedNode = {
      id: "node-2",
      taskReferenceName: "validate_payment",
      title: "Validate Payment",
      nodeType: "VALIDATION_ACTION",
      status: "added" as const,
      parameterDiffs: [],
      targetConfig: { schema: "PaymentSchema" },
    };

    render(
      <ParameterDiffDrawer
        selectedNode={selectedNode}
        baseVersion={1}
        targetVersion={2}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText(/This task was newly added in Version 2/i)
    ).toBeInTheDocument();
  });
});

describe("DiffNode", () => {
  it("renders node title, reference, and modified badge", () => {
    const onSelectNode = vi.fn();
    const data = {
      title: "Fetch Order",
      taskReferenceName: "fetch_order",
      diffStatus: "modified" as const,
      parameterDiffs: [
        { key: "url", path: "url", oldValue: "a", newValue: "b", status: "modified" as const },
      ],
      onSelectNode,
    };

    render(
      <ReactFlowProvider>
        <DiffNode id="node-1" type="HTTP_ACTION" data={data} />
      </ReactFlowProvider>
    );

    expect(screen.getByText("Fetch Order")).toBeInTheDocument();
    expect(screen.getByText("fetch_order")).toBeInTheDocument();
    expect(screen.getByText("● Modified (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onSelectNode).toHaveBeenCalledWith("node-1", data);
  });
});
