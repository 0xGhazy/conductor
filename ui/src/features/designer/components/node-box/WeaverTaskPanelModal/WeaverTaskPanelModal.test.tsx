import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeaverTaskPanelModal } from "./WeaverTaskPanelModal";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

describe("WeaverTaskPanelModal", () => {
  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
  });

  it("renders the modal when open is true", () => {
    render(
      <WeaverTaskPanelModal
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Add Task" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search tasks...")).toBeInTheDocument();
    expect(screen.getByLabelText("Close task panel")).toBeInTheDocument();
  });

  it("does not display modal content when open is false", () => {
    render(
      <WeaverTaskPanelModal
        open={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("heading", { name: "Add Task" })).not.toBeInTheDocument();
  });

  it("does not display 'Connecting to Start' badge when pendingConnectionSource is set", () => {
    useDesignerStore.setState({ pendingConnectionSource: START_NODE_ID });

    render(
      <WeaverTaskPanelModal
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("Connecting to Start")).not.toBeInTheDocument();
  });

  it("does not display 'Connecting to <NodeName>' badge when pendingConnectionSource is an action node", () => {
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat({
        id: "http-123",
        type: "HTTP_ACTION",
        data: { name: "Fetch Customer" },
        position: { x: 0, y: 0 },
      } as any),
      pendingConnectionSource: "http-123",
    }));

    render(
      <WeaverTaskPanelModal
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText(/Connecting to/)).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <WeaverTaskPanelModal
        open={true}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByLabelText("Close task panel");
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onAddNode and automatically closes the modal when a task card is selected", () => {
    const handleAddNode = vi.fn();
    const handleClose = vi.fn();

    render(
      <WeaverTaskPanelModal
        open={true}
        onClose={handleClose}
        onAddNode={handleAddNode}
      />
    );

    const httpTask = screen.getByRole("button", { name: "HTTP Task" });
    fireEvent.click(httpTask);

    expect(handleAddNode).toHaveBeenCalledWith("HTTP_ACTION");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
