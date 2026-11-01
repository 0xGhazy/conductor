import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { WorkflowSaveStatus } from "./WorkflowSaveStatus";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";

describe("WorkflowSaveStatus Component", () => {
  beforeEach(() => {
    useDesignerStore.setState({ workflowStatus: "SAVED" });
  });

  it("renders 'Saved' status by default", () => {
    render(<WorkflowSaveStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByTestId("workflow-save-status")).toHaveAttribute(
      "aria-label",
      "Workflow Save Status: Saved"
    );
  });

  it("renders 'Unsaved' status when workflowStatus is UNSAVED or MODIFIED", () => {
    useDesignerStore.setState({ workflowStatus: "UNSAVED" });
    const { rerender } = render(<WorkflowSaveStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved");

    useDesignerStore.setState({ workflowStatus: "MODIFIED" });
    rerender(<WorkflowSaveStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved");
  });

  it("renders 'Saving...' status when workflowStatus is SAVING", () => {
    useDesignerStore.setState({ workflowStatus: "SAVING" });
    render(<WorkflowSaveStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Saving...");
  });

  it("renders 'Save Failed' status when workflowStatus is FAILED", () => {
    useDesignerStore.setState({ workflowStatus: "FAILED" });
    render(<WorkflowSaveStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Save Failed");
  });
});
