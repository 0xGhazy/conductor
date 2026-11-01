import type { ReactElement } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { WeaverNotificationProvider } from "@/components/common/notifications";
import { WeaverTaskNode } from "@/features/designer/nodes/WeaverTaskNode";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";

const renderWithProviders = (ui: ReactElement) =>
  render(
    <WeaverNotificationProvider>
      <ReactFlowProvider>{ui}</ReactFlowProvider>
    </WeaverNotificationProvider>
  );

const selectNodes = (ids: string[]) =>
  act(() => {
    useDesignerStore.getState().setSelectedNodeIds(ids);
  });

describe("WeaverTaskNode selection trace", () => {
  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
  });

  it("shows the traveling light only on the selected node and moves it with the selection", () => {
    renderWithProviders(
      <>
        <div data-testid="node-a">
          <WeaverTaskNode id="a" title="A" taskReferenceName="a_ref" />
        </div>
        <div data-testid="node-b">
          <WeaverTaskNode id="b" title="B" taskReferenceName="b_ref" />
        </div>
      </>
    );
    const traceIn = (testId: string) =>
      within(screen.getByTestId(testId)).queryByTestId("selection-trace");

    expect(traceIn("node-a")).toBeNull();
    expect(traceIn("node-b")).toBeNull();

    selectNodes(["a"]);
    expect(traceIn("node-a")).toBeInTheDocument();
    expect(traceIn("node-b")).toBeNull();

    selectNodes(["b"]);
    expect(traceIn("node-a")).toBeNull();
    expect(traceIn("node-b")).toBeInTheDocument();

    selectNodes([]);
    expect(traceIn("node-a")).toBeNull();
    expect(traceIn("node-b")).toBeNull();
  });

  it("hides the trace while the node is being hold-deleted", () => {
    renderWithProviders(<WeaverTaskNode id="a" title="A" />);
    selectNodes(["a"]);
    expect(screen.getByTestId("selection-trace")).toBeInTheDocument();

    act(() => {
      useDesignerStore.getState().setHoldDeleteNodeId("a");
    });
    expect(screen.queryByTestId("selection-trace")).toBeNull();
  });
});
