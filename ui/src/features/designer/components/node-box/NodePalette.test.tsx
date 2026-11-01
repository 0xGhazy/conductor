import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodePalette } from "./NodePalette";

describe("NodePalette", () => {
  it("renders the Workflow node item in the palette", () => {
    render(<NodePalette />);
    const workflowItem = screen.getByTitle("Invoke another workflow as a sub-workflow");
    expect(workflowItem).toBeInTheDocument();
    expect(screen.getByText("Invoke another workflow as a sub-workflow")).toBeInTheDocument();
  });

  it("calls onAddNode with SUBWORKFLOW_ACTION when clicked", () => {
    const handleAdd = vi.fn();
    render(<NodePalette onAddNode={handleAdd} />);
    const workflowItem = screen.getByTitle("Invoke another workflow as a sub-workflow");
    fireEvent.click(workflowItem);
    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith("SUBWORKFLOW_ACTION");
  });

  it("sets correct drag data when dragged", () => {
    render(<NodePalette />);
    const workflowItem = screen.getByTitle("Invoke another workflow as a sub-workflow");
    const setDataMock = vi.fn();
    fireEvent.dragStart(workflowItem, {
      dataTransfer: {
        setData: setDataMock,
        effectAllowed: "none",
      },
    });
    expect(setDataMock).toHaveBeenCalledWith("application/x-node-type", "SUBWORKFLOW_ACTION");
  });
});
