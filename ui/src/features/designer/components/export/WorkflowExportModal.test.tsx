import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Node, Edge } from "@xyflow/react";
import { WorkflowExportModal } from "./WorkflowExportModal";
import * as exportRasterizer from "@/features/designer/utils/exportRasterizer";

// Mock WeaverCodeEditor for deterministic test execution
vi.mock("@/components/common/editors", () => ({
  WeaverCodeEditor: ({ value, language, readOnly }: any) => (
    <div
      data-testid="mock-code-editor"
      data-language={language}
      data-readonly={String(readOnly)}
    >
      {value}
    </div>
  ),
}));

// Mock notifications
vi.mock("@/components/common/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/common/notifications")>()),
  useWeaverNotification: () => ({
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
  }),
}));

// Mock triggerFileDownload
vi.spyOn(exportRasterizer, "triggerFileDownload").mockImplementation(() => {});

describe("WorkflowExportModal", () => {
  const sampleNodes: Node[] = [
    {
      id: "start-node",
      type: "start",
      position: { x: 0, y: 0 },
      data: { name: "Start" },
    },
    {
      id: "http-node",
      type: "HTTP_ACTION",
      position: { x: 100, y: 150 },
      data: { name: "Http Action", config: { method: "GET", url: "https://example.com" } },
    },
  ];

  const sampleEdges: Edge[] = [
    {
      id: "edge-1",
      source: "start-node",
      target: "http-node",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders export modal with SVG, PDF, PNG, JPG, and JSON format buttons", () => {
    render(
      <WorkflowExportModal
        open={true}
        onClose={vi.fn()}
        nodes={sampleNodes}
        edges={sampleEdges}
        workflowName="Order_Processing"
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Export Workflow")).toBeInTheDocument();

    // Verify all 5 formats are present in the format grid
    expect(screen.getByRole("button", { name: /^SVG/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^PDF/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^PNG/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^JPG/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^JSON/i })).toBeInTheDocument();
  });

  it("switches to JSON format and displays WeaverCodeEditor read-only preview and details", () => {
    render(
      <WorkflowExportModal
        open={true}
        onClose={vi.fn()}
        nodes={sampleNodes}
        edges={sampleEdges}
        workflowName="Order_Processing"
        workflowVersion="2"
      />
    );

    const jsonFormatBtn = screen.getByRole("button", { name: /^JSON/i });
    fireEvent.click(jsonFormatBtn);

    // Code editor is rendered with json language and readOnly
    const editor = screen.getByTestId("mock-code-editor");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute("data-language", "json");
    expect(editor).toHaveAttribute("data-readonly", "true");
    expect(editor.textContent).toContain('"name": "Order_Processing"');

    // Specification details
    expect(screen.getByText("Workflow Summary")).toBeInTheDocument();
    expect(screen.getByText("Order_Processing")).toBeInTheDocument();
    expect(screen.getAllByText("v2").length).toBeGreaterThan(0);

    // Export button label
    expect(screen.getByRole("button", { name: /Export JSON/i })).toBeInTheDocument();
  });

  it("toggles JSON formatting between Formatted (2 Spaces) and Minified", () => {
    render(
      <WorkflowExportModal
        open={true}
        onClose={vi.fn()}
        nodes={sampleNodes}
        edges={sampleEdges}
        workflowName="Order_Processing"
        initialFormat="json"
      />
    );

    const editor = screen.getByTestId("mock-code-editor");
    expect(editor.textContent).toContain("\n");

    const minifiedBtn = screen.getByRole("button", { name: /Minified/i });
    fireEvent.click(minifiedBtn);

    expect(editor.textContent).not.toContain("\n  ");

    const formattedBtn = screen.getByRole("button", { name: /Formatted/i });
    fireEvent.click(formattedBtn);

    expect(editor.textContent).toContain("\n");
  });

  it("exports JSON file when clicking Export JSON", async () => {
    const handleClose = vi.fn();
    render(
      <WorkflowExportModal
        open={true}
        onClose={handleClose}
        nodes={sampleNodes}
        edges={sampleEdges}
        workflowName="Order_Processing"
        workflowVersion={3}
        initialFormat="json"
      />
    );

    const exportBtn = screen.getByRole("button", { name: /Export JSON/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportRasterizer.triggerFileDownload).toHaveBeenCalledWith(
        expect.any(Blob),
        "order_processing_v3.json"
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("respects initialFormat prop when opening modal", () => {
    render(
      <WorkflowExportModal
        open={true}
        onClose={vi.fn()}
        nodes={sampleNodes}
        edges={sampleEdges}
        workflowName="Order_Processing"
        initialFormat="json"
      />
    );

    expect(screen.getByTestId("mock-code-editor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export JSON/i })).toBeInTheDocument();
  });
});
