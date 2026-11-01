import { describe, it, expect, beforeEach } from "vitest";
import type { Node } from "@xyflow/react";
import { useDesignerStore } from "./useDesignerStore";

const taskNode = (id: string, selected = false): Node => ({
  id,
  type: "HTTP_ACTION",
  position: { x: 0, y: 0 },
  data: { name: id },
  selected,
});

const selectedFlags = () =>
  Object.fromEntries(
    useDesignerStore
      .getState()
      .nodes.filter((n) => n.id === "a" || n.id === "b")
      .map((n) => [n.id, Boolean(n.selected)])
  );

describe("selection sync between selectedNodeIds and React Flow node flags", () => {
  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
    useDesignerStore.setState((s) => ({ nodes: s.nodes.concat(taskNode("a"), taskNode("b")) }));
  });

  it("clears a stale React Flow selection when the store selects another node", () => {
    // e.g. "a" was clicked earlier, then an action selected "b" through the store only
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.map((n) => (n.id === "a" ? { ...n, selected: true } : n)),
    }));

    useDesignerStore.getState().setSelectedNodeIds(["b"]);

    expect(selectedFlags()).toEqual({ a: false, b: true });
  });

  it("keeps multi-selection flags (Ctrl+click) and clears them all on deselect", () => {
    useDesignerStore.getState().setSelectedNodeIds(["a", "b"]);
    expect(selectedFlags()).toEqual({ a: true, b: true });

    useDesignerStore.getState().clearSelection();
    expect(selectedFlags()).toEqual({ a: false, b: false });
  });

  it("does not replace nodes when flags already match", () => {
    useDesignerStore.getState().setSelectedNodeIds(["a"]);
    const nodesBefore = useDesignerStore.getState().nodes;

    useDesignerStore.getState().setSelectedNodeIds(["a"]);

    expect(useDesignerStore.getState().nodes).toBe(nodesBefore);
  });
});
