import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { NodeIdentityFields } from "./NodeIdentityFields";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";

const taskNode = (id: string, config: Record<string, unknown>, name = id): Node => ({
  id,
  type: "HTTP_ACTION",
  position: { x: 0, y: 0 },
  data: { name, config },
});

const inputByLabel = (label: string) =>
  screen.getByLabelText(label, { exact: false, selector: "input" }) as HTMLInputElement;

describe("NodeIdentityFields", () => {
  beforeEach(() => {
    useDesignerStore.getState().resetWorkflowState();
  });

  it("shows the node name and reference, and writes edits to the right keys", () => {
    const onChange = vi.fn();
    const node = taskNode("a", { name: "fetch_user" }, "Fetch User");
    render(<NodeIdentityFields node={node} value={node.data.config as Record<string, unknown>} onChange={onChange} />);

    expect(inputByLabel("Node Name").value).toBe("Fetch User");
    expect(inputByLabel("Task Reference Name").value).toBe("fetch_user");

    fireEvent.change(inputByLabel("Node Name"), { target: { value: "Load User" } });
    expect(onChange).toHaveBeenLastCalledWith({ nodeName: "Load User" });

    fireEvent.change(inputByLabel("Task Reference Name"), { target: { value: "load_user" } });
    expect(onChange).toHaveBeenLastCalledWith({
      name: "load_user",
      referenceName: "load_user",
      reference: "load_user",
      taskReferenceName: "load_user",
    });
  });

  it("flags a reference already used by another node (case-insensitive)", async () => {
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat(
        taskNode("a", { taskReferenceName: "Fetch_User" }),
        taskNode("b", { name: "fetch_user" })
      ),
    }));
    const node = useDesignerStore.getState().nodes.find((n) => n.id === "b")!;

    render(<NodeIdentityFields node={node} value={node.data.config as Record<string, unknown>} onChange={vi.fn()} />);

    expect(
      await screen.findByText(
        '"fetch_user" is already used as a task reference name in this workflow.',
        {},
        { timeout: 2000 }
      )
    ).toBeInTheDocument();
  });

  it("accepts a reference that only the node itself uses", async () => {
    useDesignerStore.setState((s) => ({
      nodes: s.nodes.concat(taskNode("a", { name: "fetch_user" })),
    }));
    const node = useDesignerStore.getState().nodes.find((n) => n.id === "a")!;

    render(<NodeIdentityFields node={node} value={node.data.config as Record<string, unknown>} onChange={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 600));
    await waitFor(() => {
      expect(screen.queryByText(/already used as a task reference name/)).toBeNull();
    });
  });
});
