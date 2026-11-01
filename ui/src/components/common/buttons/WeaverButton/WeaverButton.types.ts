import React from "react";
import type { ButtonProps as MuiButtonProps } from "@mui/material/Button";

/**
 * Managed button modes supported by WeaverButton.
 * - 'default': Standard MUI button behavior without async state management.
 * - 'save': Managed async save action with automatic loading spinner and duplicate click prevention.
 * - 'update': Managed async update action with automatic loading spinner and duplicate click prevention.
 * - 'delete': Press-and-hold confirmation (~1.5s) before invoking async delete action.
 */
export type WeaverButtonMode = "default" | "save" | "update" | "delete";

/**
 * Internal interaction state for press-and-hold and async lifecycle.
 */
export type WeaverButtonInteractionState = "idle" | "holding" | "loading";

export interface WeaverButtonProps
  extends Omit<MuiButtonProps, "startIcon" | "endIcon"> {
  /**
   * Managed action mode for the button.
   * @default 'default'
   */
  mode?: WeaverButtonMode;

  /**
   * Custom icon element to display.
   * If omitted, sensible default icons are provided for 'save', 'update', and 'delete' modes.
   */
  icon?: React.ReactNode;

  /**
   * Placement of the icon or loading spinner relative to button label.
   * @default 'start'
   */
  iconPosition?: "start" | "end";

  /**
   * Async or synchronous action handler for managed modes ('save', 'update', 'delete').
   * If a Promise is returned, the button displays a loading spinner and prevents duplicate
   * clicks until the Promise resolves or rejects.
   */
  onAction?: () => void | Promise<void>;

  /**
   * Controlled loading state (e.g. from TanStack mutation or external state).
   * Overrides or combines with internal async lifecycle: effectiveLoading = loading ?? internalLoading.
   */
  loading?: boolean;

  /**
   * Custom label or element to display while the action is loading.
   * If omitted, the button's original children are retained to avoid layout shifts.
   */
  loadingLabel?: React.ReactNode;

  /**
   * Required press-and-hold duration in milliseconds for 'delete' mode before action executes.
   * @default 1500
   */
  holdDuration?: number;

  /**
   * Custom label to display while actively pressing and holding the button in 'delete' mode.
   * If omitted, the button's original children are retained.
   */
  holdLabel?: React.ReactNode;

  /**
   * Whether to render the bottom progress strip in 'delete' mode.
   * @default false
   */
  showHoldBar?: boolean;

  /**
   * Callback fired when a valid press-and-hold sequence begins.
   */
  onHoldStart?: () => void;

  /**
   * Callback fired when an active press-and-hold sequence is cancelled before completion.
   */
  onHoldCancel?: () => void;
}
