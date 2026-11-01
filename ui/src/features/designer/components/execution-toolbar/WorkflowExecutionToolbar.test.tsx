import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WorkflowExecutionToolbar } from "./WorkflowExecutionToolbar";
import { ExecutionOptionsPopover } from "./components/ExecutionOptionsPopover";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";

vi.mock("@/features/designer/services/designerApi", () => ({
  pauseWorkflowExecution: vi.fn().mockResolvedValue({}),
  resumeWorkflowExecution: vi.fn().mockResolvedValue({}),
  terminateWorkflowExecution: vi.fn().mockResolvedValue({}),
  restartWorkflowExecution: vi.fn().mockResolvedValue({}),
  retryWorkflowExecution: vi.fn().mockResolvedValue({}),
  fetchWorkflowExecutionStatus: vi.fn().mockResolvedValue(null),
}));

describe("WorkflowExecutionToolbar HUD", () => {
  beforeEach(() => {
    useWorkflowExecutionStore.getState().resetExecution();
  });

  it("renders Floating Dynamic Island HUD in idle state with standalone Run button and disabled action controls (no READY label)", () => {
    render(<WorkflowExecutionToolbar />);

    // 1. In idle state, READY status badge is omitted per user request
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // 2. Standalone circular Run button is visible and enabled
    const runBtn = screen.getByRole("button", { name: /run workflow/i });
    expect(runBtn).toBeInTheDocument();
    expect(runBtn).not.toBeDisabled();

    // 3. Pause, Terminate, Restart, Retry buttons are appeared but disabled when not running
    const pauseBtn = screen.getByRole("button", { name: /pause execution/i });
    const terminateBtn = screen.getByRole("button", { name: /terminate execution/i });
    const restartBtn = screen.getByRole("button", { name: /restart execution/i });
    const retryBtn = screen.getByRole("button", { name: /retry execution/i });

    expect(pauseBtn).toBeInTheDocument();
    expect(pauseBtn).toBeDisabled();

    expect(terminateBtn).toBeInTheDocument();
    expect(terminateBtn).toBeDisabled();

    expect(restartBtn).toBeInTheDocument();
    expect(restartBtn).toBeDisabled();

    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toBeDisabled();

    // 4. Execution options toggle button is present
    const optionsBtn = screen.getByRole("button", { name: /open execution options/i });
    expect(optionsBtn).toBeInTheDocument();
  });

  it("handles execution lifecycle: run -> pause -> resume -> terminate -> restart -> reset", async () => {
    const handleExternalRun = vi.fn(() => {
      useWorkflowExecutionStore.getState().startExecution("test-wf-id");
      useWorkflowExecutionStore.getState().setExecutionStatus("running");
    });

    render(<WorkflowExecutionToolbar onRun={handleExternalRun} />);

    const runBtn = screen.getByRole("button", { name: /run workflow/i });

    // 1. Trigger Run
    await act(async () => {
      fireEvent.click(runBtn);
    });
    expect(handleExternalRun).toHaveBeenCalledTimes(1);
    expect(useWorkflowExecutionStore.getState().status).toBe("running");

    // In Running state: status is RUNNING, Pause and Terminate buttons are available and enabled
    expect(screen.getByRole("status").textContent).toMatch(/running/i);
    const pauseBtn = screen.getByRole("button", { name: /pause execution/i });
    const terminateBtn = screen.getByRole("button", { name: /terminate execution/i });
    expect(pauseBtn).not.toBeDisabled();
    expect(terminateBtn).not.toBeDisabled();

    // 2. Pause execution
    await act(async () => {
      fireEvent.click(pauseBtn);
    });
    expect(useWorkflowExecutionStore.getState().status).toBe("paused");
    expect(screen.getByRole("status").textContent).toMatch(/paused/i);
    const resumeBtn = screen.getByRole("button", { name: /resume execution/i });
    expect(resumeBtn).toBeInTheDocument();
    expect(resumeBtn).not.toBeDisabled();

    // 3. Resume execution
    await act(async () => {
      fireEvent.click(resumeBtn);
    });
    expect(useWorkflowExecutionStore.getState().status).toBe("running");

    // 4. Terminate execution
    const termBtnAfterResume = screen.getByRole("button", { name: /terminate execution/i });
    await act(async () => {
      fireEvent.click(termBtnAfterResume);
    });
    expect(useWorkflowExecutionStore.getState().status).toBe("terminated");

    // 5. In finished state: Restart and Reset buttons are enabled
    const restartBtn = screen.getByRole("button", { name: /restart execution/i });
    const resetBtn = screen.getByRole("button", { name: /reset to ready/i });
    expect(restartBtn).toBeInTheDocument();
    expect(restartBtn).not.toBeDisabled();
    expect(resetBtn).toBeInTheDocument();

    // 6. Reset back to idle
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    expect(useWorkflowExecutionStore.getState().status).toBe("idle");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens ExecutionOptionsDeck inline when options button is clicked, and collapses on Done or Esc", () => {
    render(<WorkflowExecutionToolbar />);

    const optionsBtn = screen.getByRole("button", { name: /open execution options/i });
    fireEvent.click(optionsBtn);

    // Deck strips rendered inline within the toolbar container
    expect(screen.getByRole("region", { name: "Execution Options" })).toBeInTheDocument();
    expect(screen.getByText("Mode")).toBeInTheDocument();
    expect(screen.getByText("Correlation ID")).toBeInTheDocument();

    // Clicking Done closes the deck
    const doneBtn = screen.getByRole("button", { name: /^done$/i });
    fireEvent.click(doneBtn);
    expect(screen.queryByRole("region", { name: "Execution Options" })).not.toBeInTheDocument();

    // Reopen and test Escape key collapses the deck
    fireEvent.click(optionsBtn);
    expect(screen.getByRole("region", { name: "Execution Options" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Execution Options" })).not.toBeInTheDocument();
  });

  it("updates options directly from the inline floating deck", () => {
    render(<WorkflowExecutionToolbar />);

    const optionsChevron = screen.getByRole("button", { name: /open execution options/i });
    fireEvent.click(optionsChevron);

    // Generate UUID from inline deck
    const uuidBtn = screen.getByRole("button", { name: /uuid/i });
    fireEvent.click(uuidBtn);
    expect(useWorkflowExecutionStore.getState().options.correlationId).toBeTruthy();

    // Toggle Mode to Sync
    const syncRadio = screen.getByRole("radio", { name: "Sync" });
    fireEvent.click(syncRadio);
    expect(useWorkflowExecutionStore.getState().options.executionMode).toBe("Sync");
    expect(screen.getByText(/pause at breakpoint/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wait seconds/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1s" })).not.toBeInTheDocument();

    // Reset Defaults (switches back to Async)
    const resetBtn = screen.getByRole("button", { name: /reset defaults/i });
    fireEvent.click(resetBtn);
    expect(useWorkflowExecutionStore.getState().options.executionMode).toBe("Async");
    expect(screen.queryByText(/pause at breakpoint/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1s" })).toBeInTheDocument();
  });

  describe("ExecutionOptionsPopover", () => {
    it("renders options with UUID generator and polling intervals in Async mode", () => {
      useDesignerStore.setState({
        nodes: [
          {
            id: "start",
            type: "start",
            position: { x: 0, y: 0 },
            data: { name: "Start", config: { timeoutSeconds: 30 } },
          },
          {
            id: "task-1",
            type: "HTTP_ACTION",
            position: { x: 100, y: 100 },
            data: { name: "Validate User", config: { taskReferenceName: "validate_user_ref" } },
          },
        ],
      });

      const handleClose = vi.fn();
      const div = document.createElement("div");
      document.body.appendChild(div);

      render(
        <ExecutionOptionsPopover
          open={true}
          anchorEl={div}
          onClose={handleClose}
        />
      );

      // Correlation ID UUID button
      expect(screen.getByRole("button", { name: /uuid/i })).toBeInTheDocument();

      // Mode toggles
      const asyncBtn = screen.getByRole("radio", { name: "Async" });
      const syncBtn = screen.getByRole("radio", { name: "Sync" });
      expect(asyncBtn).toBeInTheDocument();
      expect(syncBtn).toBeInTheDocument();

      // In Async mode, polling interval pills are present, wait & breakpoint are hidden
      expect(screen.getByRole("button", { name: "1s" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2s" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "5s" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "10s" })).toBeInTheDocument();
      expect(screen.queryByText(/pause at breakpoint/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/wait seconds/i)).not.toBeInTheDocument();

      // Generate UUID action
      fireEvent.click(screen.getByRole("button", { name: /uuid/i }));
      expect(useWorkflowExecutionStore.getState().options.correlationId).toBeTruthy();

      // Done button
      fireEvent.click(screen.getByRole("button", { name: /done/i }));
      expect(handleClose).toHaveBeenCalled();
    });

    it("switches to Sync mode where wait and pause at breakpoint appear and polling is hidden", () => {
      const handleClose = vi.fn();
      const div = document.createElement("div");
      document.body.appendChild(div);

      render(
        <ExecutionOptionsPopover
          open={true}
          anchorEl={div}
          onClose={handleClose}
        />
      );

      // Initially in Async mode
      expect(screen.getByRole("button", { name: "1s" })).toBeInTheDocument();
      expect(screen.queryByText(/pause at breakpoint/i)).not.toBeInTheDocument();

      // Switch to Sync
      const syncBtn = screen.getByRole("radio", { name: "Sync" });
      fireEvent.click(syncBtn);
      expect(useWorkflowExecutionStore.getState().options.executionMode).toBe("Sync");

      // In Sync mode, wait and breakpoint appear, polling is hidden
      expect(screen.getByText(/pause at breakpoint/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/wait seconds/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "1s" })).not.toBeInTheDocument();
    });
  });
});
