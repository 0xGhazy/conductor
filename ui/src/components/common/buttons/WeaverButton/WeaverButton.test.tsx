import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WeaverButton } from "./WeaverButton";

describe("WeaverButton Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ==========================================
  // 1. DEFAULT MODE & NATIVE PROPS
  // ==========================================
  describe("Default Mode & Native Props", () => {
    it("renders children correctly", () => {
      render(<WeaverButton>Click Me</WeaverButton>);
      expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
    });

    it("forwards native MUI Button props (variant, color, fullWidth)", () => {
      const { container } = render(
        <WeaverButton variant="outlined" color="secondary" fullWidth>
          Action
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /action/i });
      expect(btn).toHaveClass("MuiButton-outlined");
      expect(btn).toHaveClass("MuiButton-colorSecondary");
      expect(btn).toHaveClass("MuiButton-fullWidth");
    });

    it("handles native onClick in default mode", () => {
      const handleClick = vi.fn();
      render(<WeaverButton onClick={handleClick}>Click</WeaverButton>);
      const btn = screen.getByRole("button", { name: /click/i });

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not fire onClick when disabled", () => {
      const handleClick = vi.fn();
      render(
        <WeaverButton disabled onClick={handleClick}>
          Disabled
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /disabled/i });
      expect(btn).toBeDisabled();

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. ICON HANDLING
  // ==========================================
  describe("Icon Handling", () => {
    it("renders consumer-supplied icon in start position by default", () => {
      render(
        <WeaverButton icon={<span data-testid="custom-icon">ICON</span>}>
          With Icon
        </WeaverButton>
      );
      const icon = screen.getByTestId("custom-icon");
      expect(icon).toBeInTheDocument();
      // Icon should be inside startIcon slot
      expect(icon.closest(".MuiButton-startIcon")).toBeInTheDocument();
    });

    it("renders icon in end position when iconPosition='end'", () => {
      render(
        <WeaverButton
          icon={<span data-testid="custom-end-icon">END</span>}
          iconPosition="end"
        >
          Next
        </WeaverButton>
      );
      const icon = screen.getByTestId("custom-end-icon");
      expect(icon.closest(".MuiButton-endIcon")).toBeInTheDocument();
    });

    it("allows consumer icon to override default mode icons", () => {
      render(
        <WeaverButton
          mode="save"
          icon={<span data-testid="override-icon">OVERRIDE</span>}
        >
          Save
        </WeaverButton>
      );
      expect(screen.getByTestId("override-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("SaveRoundedIcon")).not.toBeInTheDocument();
    });

    it("provides sensible default icon for save, update, delete modes", () => {
      const { unmount: unmount1 } = render(<WeaverButton mode="save">Save</WeaverButton>);
      expect(screen.getByTestId("SaveRoundedIcon")).toBeInTheDocument();
      unmount1();

      const { unmount: unmount2 } = render(<WeaverButton mode="update">Update</WeaverButton>);
      expect(screen.getByTestId("EditRoundedIcon")).toBeInTheDocument();
      unmount2();

      render(<WeaverButton mode="delete">Delete</WeaverButton>);
      expect(screen.getByTestId("DeleteOutlineRoundedIcon")).toBeInTheDocument();
    });
  });

  // ==========================================
  // 3. SAVE & UPDATE MANAGED MODES
  // ==========================================
  describe("Save and Update Modes", () => {
    it("invokes onAction on click and displays spinner while running", async () => {
      let resolveAction: () => void = () => {};
      const onAction = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveAction = resolve;
        });
      });

      render(
        <WeaverButton mode="save" onAction={onAction}>
          Save Data
        </WeaverButton>
      );

      const btn = screen.getByRole("button", { name: /save data/i });
      expect(screen.getByTestId("SaveRoundedIcon")).toBeInTheDocument();

      // Click to start async save
      fireEvent.click(btn);
      expect(onAction).toHaveBeenCalledTimes(1);

      // Loading state active: spinner replaces icon, button disabled
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(screen.queryByTestId("SaveRoundedIcon")).not.toBeInTheDocument();
      expect(btn).toBeDisabled();

      // Duplicate click while running should be ignored
      fireEvent.click(btn);
      expect(onAction).toHaveBeenCalledTimes(1);

      // Resolve async action
      await act(async () => {
        resolveAction();
      });

      // Restores idle state: spinner gone, original icon restored, enabled
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.getByTestId("SaveRoundedIcon")).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it("restores idle state when onAction rejects", async () => {
      let rejectAction: (err: Error) => void = () => {};
      const onAction = vi.fn().mockImplementation(() => {
        return new Promise<void>((_, reject) => {
          rejectAction = reject;
        });
      });

      render(
        <WeaverButton mode="update" onAction={onAction}>
          Update Record
        </WeaverButton>
      );

      const btn = screen.getByRole("button", { name: /update record/i });
      fireEvent.click(btn);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Reject async action
      await act(async () => {
        rejectAction(new Error("Network failed"));
      });

      // Must reset loading even on error
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it("renders custom loadingLabel when provided", async () => {
      let resolveAction: () => void = () => {};
      const onAction = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveAction = resolve;
        });
      });

      render(
        <WeaverButton mode="save" onAction={onAction} loadingLabel="Saving changes...">
          Save
        </WeaverButton>
      );

      const btn = screen.getByRole("button", { name: /save/i });
      fireEvent.click(btn);

      expect(screen.getByText("Saving changes...")).toBeInTheDocument();

      await act(async () => {
        resolveAction();
      });

      expect(screen.getByText("Save")).toBeInTheDocument();
    });

    it("supports controlled loading prop", () => {
      const { rerender } = render(
        <WeaverButton mode="save" loading={false}>
          Save
        </WeaverButton>
      );
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

      rerender(
        <WeaverButton mode="save" loading={true}>
          Save
        </WeaverButton>
      );
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  // ==========================================
  // 4. DELETE MODE (PRESS-AND-HOLD)
  // ==========================================
  describe("Delete Mode (Press and Hold)", () => {
    it("defaults to color='error'", () => {
      render(<WeaverButton mode="delete">Delete</WeaverButton>);
      expect(screen.getByRole("button")).toHaveClass("MuiButton-colorError");
    });

    it("does NOT trigger onAction on quick click", () => {
      const onAction = vi.fn();
      render(
        <WeaverButton mode="delete" onAction={onAction}>
          Delete
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete/i });

      // Quick click (< 1500ms)
      fireEvent.pointerDown(btn, { button: 0 });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.pointerUp(btn);
      fireEvent.click(btn);

      expect(onAction).not.toHaveBeenCalled();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("cancels hold when pointer is released before duration", () => {
      const onAction = vi.fn();
      const onHoldStart = vi.fn();
      const onHoldCancel = vi.fn();

      render(
        <WeaverButton
          mode="delete"
          holdDuration={1500}
          onAction={onAction}
          onHoldStart={onHoldStart}
          onHoldCancel={onHoldCancel}
        >
          Delete
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete/i });

      fireEvent.pointerDown(btn, { button: 0 });
      expect(onHoldStart).toHaveBeenCalledTimes(1);

      // Advance halfway
      act(() => {
        vi.advanceTimersByTime(800);
      });

      // Release early
      fireEvent.pointerUp(btn);
      expect(onHoldCancel).toHaveBeenCalledTimes(1);

      // Advance past remaining time to verify timer was cleared
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onAction).not.toHaveBeenCalled();
    });

    it("cancels hold when pointer leaves or is cancelled", () => {
      const onAction = vi.fn();
      const onHoldCancel = vi.fn();

      render(
        <WeaverButton
          mode="delete"
          holdDuration={1500}
          onAction={onAction}
          onHoldCancel={onHoldCancel}
        >
          Delete
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete/i });

      fireEvent.pointerDown(btn, { button: 0 });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      fireEvent.pointerLeave(btn);
      expect(onHoldCancel).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(onAction).not.toHaveBeenCalled();
    });

    it("executes onAction exactly once when hold duration is reached", async () => {
      let resolveAction: () => void = () => {};
      const onAction = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveAction = resolve;
        });
      });

      render(
        <WeaverButton mode="delete" holdDuration={1500} onAction={onAction}>
          Delete Item
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete item/i });

      // Start hold
      fireEvent.pointerDown(btn, { button: 0 });

      // Advance full 1500ms
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(onAction).toHaveBeenCalledTimes(1);
      // Now in loading state
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Resolve async action
      await act(async () => {
        resolveAction();
      });

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it("displays custom holdLabel during hold phase", () => {
      render(
        <WeaverButton
          mode="delete"
          holdDuration={1500}
          holdLabel="Hold to confirm deletion..."
        >
          Delete Record
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete record/i });

      expect(screen.getByText("Delete Record")).toBeInTheDocument();

      fireEvent.pointerDown(btn, { button: 0 });
      expect(screen.getByText("Hold to confirm deletion...")).toBeInTheDocument();

      fireEvent.pointerUp(btn);
      expect(screen.getByText("Delete Record")).toBeInTheDocument();
    });
  });

  // ==========================================
  // 5. KEYBOARD ACCESSIBILITY FOR DELETE HOLD
  // ==========================================
  describe("Keyboard Support for Delete Hold", () => {
    it("initiates hold and triggers action via Space key hold", async () => {
      const onAction = vi.fn().mockResolvedValue(undefined);
      render(
        <WeaverButton mode="delete" holdDuration={1200} onAction={onAction}>
          Delete
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete/i });

      // Focus button and press Space
      btn.focus();
      fireEvent.keyDown(btn, { key: " " });

      // Key repeat event should NOT start another timer or crash
      fireEvent.keyDown(btn, { key: " ", repeat: true });

      // Advance full 1200ms
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("cancels Space key hold if key is released early", () => {
      const onAction = vi.fn();
      render(
        <WeaverButton mode="delete" holdDuration={1500} onAction={onAction}>
          Delete
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete/i });

      fireEvent.keyDown(btn, { key: " " });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      fireEvent.keyUp(btn, { key: " " });

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(onAction).not.toHaveBeenCalled();
    });

    it("initiates hold via Enter key", async () => {
      const onAction = vi.fn().mockResolvedValue(undefined);
      render(
        <WeaverButton mode="delete" holdDuration={1000} onAction={onAction}>
          Delete
        </WeaverButton>
      );
      const btn = screen.getByRole("button", { name: /delete/i });

      fireEvent.keyDown(btn, { key: "Enter" });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // 6. ACCESSIBILITY & CLEANUP
  // ==========================================
  describe("Accessibility and Cleanup", () => {
    it("sets aria-busy='true' while loading", () => {
      render(
        <WeaverButton mode="save" loading={true}>
          Save
        </WeaverButton>
      );
      const btn = screen.getByRole("button");
      expect(btn).toHaveAttribute("aria-busy", "true");
    });

    it("sets default aria-description for delete mode explaining hold requirement", () => {
      render(<WeaverButton mode="delete">Delete</WeaverButton>);
      const btn = screen.getByRole("button");
      expect(btn).toHaveAttribute("aria-description", "Press and hold to delete");
    });

    it("clears pending hold timers safely on unmount", () => {
      const onAction = vi.fn();
      const { unmount } = render(
        <WeaverButton mode="delete" holdDuration={1500} onAction={onAction}>
          Delete
        </WeaverButton>
      );
      const btn = screen.getByRole("button");

      fireEvent.pointerDown(btn, { button: 0 });
      unmount();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onAction).not.toHaveBeenCalled();
    });
  });
});
