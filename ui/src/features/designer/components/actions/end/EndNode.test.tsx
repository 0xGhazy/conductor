import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { EndNode } from "./EndNode";

describe("EndNode", () => {
  it("renders the End node with 'End' title and target handle", () => {
    render(
      <ReactFlowProvider>
        <EndNode />
      </ReactFlowProvider>
    );

    expect(screen.getByText("End")).toBeInTheDocument();
    const handle = screen.getByLabelText("Workflow end point");
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveClass("end-node-handle-target");
  });

  it("has nodrag class and disabled attributes", () => {
    render(
      <ReactFlowProvider>
        <EndNode />
      </ReactFlowProvider>
    );

    const wrapper = screen.getByTitle("End");
    expect(wrapper).toHaveClass("nodrag");
  });
});
