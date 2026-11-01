import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { WorkflowValidationIndicator } from "./WorkflowValidationIndicator";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

describe("WorkflowValidationIndicator Component", () => {
  beforeEach(() => {
    useDesignerStore.setState({
      validationPanelOpen: false,
      workflowName: "valid_workflow",
      nodes: [
        {
          id: START_NODE_ID,
          type: "startFlag",
          data: { name: "Start" },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    });
  });

  it("renders 'Valid' when 0 errors and 0 warnings exist", () => {
    render(<WorkflowValidationIndicator />);
    const indicator = screen.getByTestId("workflow-validation-indicator");
    expect(indicator).toHaveTextContent("Valid");
    expect(indicator).toHaveAttribute("aria-label", "Workflow Validation: Valid");
  });

  it("renders error count when blocking errors exist", () => {
    // Missing workflow name causes an error
    useDesignerStore.setState({ workflowName: "" });

    render(<WorkflowValidationIndicator />);
    const indicator = screen.getByTestId("workflow-validation-indicator");
    expect(indicator).toHaveTextContent(/Error/);
  });

  it("toggles validationPanelOpen on click", () => {
    render(<WorkflowValidationIndicator />);
    const indicator = screen.getByTestId("workflow-validation-indicator");

    expect(useDesignerStore.getState().validationPanelOpen).toBe(false);
    fireEvent.click(indicator);
    expect(useDesignerStore.getState().validationPanelOpen).toBe(true);
    fireEvent.click(indicator);
    expect(useDesignerStore.getState().validationPanelOpen).toBe(false);
  });
});
