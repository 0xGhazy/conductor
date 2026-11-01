import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { WeaverNotificationProvider } from "@/components/common/notifications";
import {
  DELETE_HOLD_DURATION_MS,
  useDesignerKeyboardShortcuts,
} from "@/features/designer/hooks/useDesignerKeyboardShortcuts";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";

const NODE_ID = "http-1";

function Harness() {
  useDesignerKeyboardShortcuts({});
  return null;
}

const renderHarness = () =>
  render(
    <WeaverNotificationProvider>
      <Harness />
    </WeaverNotificationProvider>
  );

const hasNode = () => useDesignerStore.getState().nodes.some((n) => n.id === NODE_ID);

describe("useDesignerKeyboardShortcuts - hold Delete to remove node", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDesignerStore.getState().resetWorkflowState();
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat({
        id: NODE_ID,
        type: "HTTP_ACTION",
        position: { x: 200, y: 150 },
        data: { name: "HTTP Task" },
      } as any),
      selectedId: NODE_ID,
      selectedNodeIds: [NODE_ID],
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not delete on a quick Delete press", () => {
    renderHarness();

    fireEvent.keyDown(window, { key: "Delete" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyUp(window, { key: "Delete" });
    act(() => {
      vi.advanceTimersByTime(DELETE_HOLD_DURATION_MS * 2);
    });

    expect(hasNode()).toBe(true);
    expect(useDesignerStore.getState().holdDeleteNodeId).toBeNull();
  });

  it("marks the node while holding and deletes it once the hold completes", () => {
    renderHarness();

    fireEvent.keyDown(window, { key: "Delete" });
    expect(useDesignerStore.getState().holdDeleteNodeId).toBe(NODE_ID);

    fireEvent.keyDown(window, { key: "Delete", repeat: true });
    act(() => {
      vi.advanceTimersByTime(DELETE_HOLD_DURATION_MS - 1);
    });
    expect(hasNode()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hasNode()).toBe(false);
    expect(useDesignerStore.getState().holdDeleteNodeId).toBeNull();
  });

  it("cancels the hold when the selection changes", () => {
    renderHarness();

    fireEvent.keyDown(window, { key: "Delete" });
    act(() => {
      useDesignerStore.getState().setSelectedId(null);
    });
    act(() => {
      vi.advanceTimersByTime(DELETE_HOLD_DURATION_MS * 2);
    });

    expect(hasNode()).toBe(true);
    expect(useDesignerStore.getState().holdDeleteNodeId).toBeNull();
  });
});
