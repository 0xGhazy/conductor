import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeaverTaskPanel } from "./WeaverTaskPanel";
import { DEFAULT_TASK_REGISTRY } from "./taskRegistry";

describe("WeaverTaskPanel", () => {
  it("renders the search input and default categories", () => {
    render(<WeaverTaskPanel />);

    expect(screen.getByPlaceholderText("Search tasks...")).toBeInTheDocument();
    expect(screen.getByText("QUICK ADD")).toBeInTheDocument();
    expect(screen.queryByText("AGENTIC ORCHESTRATION")).not.toBeInTheDocument();
    expect(screen.queryByText("More tasks")).not.toBeInTheDocument();
  });

  it("renders key tasks from the reference design", () => {
    render(<WeaverTaskPanel />);

    // Quick Add tasks
    expect(screen.getByRole("button", { name: "HTTP Task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do While" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set Variable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wait" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sub Workflow" })).toBeInTheDocument();

    // Verify Agentic Orchestration tasks are not present
    expect(screen.queryByRole("button", { name: "Chat Completion" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate Image" })).not.toBeInTheDocument();
  });

  it("filters tasks dynamically by search query", () => {
    render(<WeaverTaskPanel />);
    const searchInput = screen.getByPlaceholderText("Search tasks...");

    fireEvent.change(searchInput, { target: { value: "Switch" } });

    expect(screen.getByRole("button", { name: "Switch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HTTP Task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Do While" })).not.toBeInTheDocument();
  });

  it("filters tasks by keywords (e.g. searching 'loop' matches 'Do While')", () => {
    render(<WeaverTaskPanel />);
    const searchInput = screen.getByPlaceholderText("Search tasks...");

    fireEvent.change(searchInput, { target: { value: "loop" } });

    expect(screen.getByRole("button", { name: "Do While" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HTTP Task" })).not.toBeInTheDocument();
  });

  it("displays empty state when no tasks match and clears search", () => {
    render(<WeaverTaskPanel />);
    const searchInput = screen.getByPlaceholderText("Search tasks...");

    fireEvent.change(searchInput, { target: { value: "nonexistentquery123" } });

    expect(screen.getByText("No tasks found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.queryByText("No tasks found")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HTTP Task" })).toBeInTheDocument();
  });

  it("calls onAddNode when an active task card is clicked", () => {
    const handleAdd = vi.fn();
    render(<WeaverTaskPanel onAddNode={handleAdd} />);

    const httpCard = screen.getByRole("button", { name: "HTTP Task" });
    fireEvent.click(httpCard);

    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith("HTTP_ACTION");
  });

  it("sets application/x-node-type on drag start for active tasks", () => {
    render(<WeaverTaskPanel />);
    const switchCard = screen.getByRole("button", { name: "Switch" });

    const setDataMock = vi.fn();
    fireEvent.dragStart(switchCard, {
      dataTransfer: {
        setData: setDataMock,
        effectAllowed: "none",
      },
    });

    expect(setDataMock).toHaveBeenCalledWith("application/x-node-type", "SWITCH_ACTION");
  });

  it("does not render 'More tasks' button", () => {
    render(<WeaverTaskPanel />);
    expect(screen.queryByRole("button", { name: "View more tasks" })).not.toBeInTheDocument();
  });
});
