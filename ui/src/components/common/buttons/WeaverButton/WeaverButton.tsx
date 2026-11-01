import React, {
  forwardRef,
  useCallback,
  useState,
} from "react";
import MuiButton from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { WeaverButtonProps } from "./WeaverButton.types";
import { useHoldToConfirm } from "./useHoldToConfirm";
import { HoldProgress } from "./HoldProgress";
import styles from "./WeaverButton.module.css";

/**
 * Calculates matching CircularProgress size based on MUI button size.
 */
function getSpinnerSize(size?: "small" | "medium" | "large"): number {
  switch (size) {
    case "small":
      return 14;
    case "large":
      return 20;
    case "medium":
    default:
      return 16;
  }
}

/**
 * WeaverButton
 *
 * Canonical shared button component for the Weaver design system.
 * Extends MUI Button with managed modes for Save, Update, and Delete actions:
 * - 'default': Standard MUI Button.
 * - 'save' & 'update': Managed async actions with automatic loading spinners and duplicate-click prevention.
 * - 'delete': Press-and-hold confirmation (~1.5s) with visible progress feedback before invoking action.
 */
export const WeaverButton = forwardRef<HTMLButtonElement, WeaverButtonProps>(
  (
    {
      mode = "default",
      icon,
      iconPosition = "start",
      onAction,
      loading,
      loadingLabel,
      holdDuration = 1500,
      holdLabel,
      showHoldBar = false,
      onHoldStart,
      onHoldCancel,
      children,
      color,
      size = "medium",
      disabled = false,
      onClick,
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      className,
      style,
      type = "button",
      ...restProps
    },
    ref
  ) => {
    const [internalLoading, setInternalLoading] = useState<boolean>(false);

    // Combined effective loading state (controlled + internal)
    const effectiveLoading = Boolean(loading ?? internalLoading);

    // Determine default color based on mode if not explicitly supplied
    const resolvedColor =
      color ?? (mode === "delete" ? "error" : "primary");

    // Managed async execution helper
    const executeManagedAction = useCallback(async () => {
      if (!onAction || effectiveLoading || disabled) return;
      setInternalLoading(true);
      try {
        await onAction();
      } finally {
        setInternalLoading(false);
      }
    }, [onAction, effectiveLoading, disabled]);

    // Press-and-hold confirmation (Delete mode)
    const hold = useHoldToConfirm({
      duration: holdDuration,
      enabled: mode === "delete" && !disabled && !effectiveLoading,
      onHoldStart,
      onHoldCancel,
      onConfirm: () => {
        executeManagedAction().catch(() => {
          // Errors are handled by the consumer's onAction caller.
        });
      },
    });

    // Handle normal clicks
    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled || effectiveLoading) {
          return;
        }

        // Save & Update trigger on normal click
        if (mode === "save" || mode === "update") {
          try {
            await executeManagedAction();
          } catch {
            // Errors are handled by the consumer's onAction caller;
            // catching at the event boundary prevents unhandled promise rejections.
          }
        }

        // Note: Delete mode intentionally ignores normal quick-clicks.
      },
      [onClick, disabled, effectiveLoading, mode, executeManagedAction]
    );

    // Consumer handlers run first; preventDefault() opts out of the hold behavior.
    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (!event.defaultPrevented) hold.handlers.onPointerDown(event);
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerUp?.(event);
      hold.handlers.onPointerUp(event);
    };

    const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerLeave?.(event);
      hold.handlers.onPointerLeave(event);
    };

    const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(event);
      hold.handlers.onPointerCancel(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (!event.defaultPrevented) hold.handlers.onKeyDown(event);
    };

    const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyUp?.(event);
      hold.handlers.onKeyUp(event);
    };

    // Default icon resolution:
    // 1. Consumer-supplied icon
    // 2. Mode default icon
    // 3. None
    const resolvedIcon = (() => {
      if (icon !== undefined) return icon;
      switch (mode) {
        case "save":
          return <SaveRoundedIcon fontSize="small" />;
        case "update":
          return <EditRoundedIcon fontSize="small" />;
        case "delete":
          return <DeleteOutlineRoundedIcon fontSize="small" />;
        case "default":
        default:
          return undefined;
      }
    })();

    // Active displayed icon: when loading, spinner replaces the icon entirely
    const spinnerSize = getSpinnerSize(size);
    const activeIcon = effectiveLoading ? (
      <span className={styles.spinnerWrapper}>
        <CircularProgress size={spinnerSize} color="inherit" thickness={4} />
      </span>
    ) : (
      resolvedIcon
    );

    // Active label resolution:
    // When loading: loadingLabel ?? children
    // When holding in delete mode: holdLabel ?? children
    // Otherwise: children
    const activeContent = (() => {
      if (effectiveLoading && loadingLabel !== undefined) {
        return loadingLabel;
      }
      if (hold.isHolding && holdLabel !== undefined) {
        return holdLabel;
      }
      return children;
    })();

    // Combine classes
    const combinedClassName = [
      styles.root,
      hold.isHolding ? styles.holding : "",
      effectiveLoading ? styles.loading : "",
      className || "",
    ]
      .filter(Boolean)
      .join(" ");

    // Accessible description for delete hold requirement
    const accessibleDescription =
      mode === "delete"
        ? (restProps["aria-description"] ?? "Press and hold to delete")
        : restProps["aria-description"];

    return (
      <MuiButton
        ref={ref}
        type={type}
        color={resolvedColor}
        size={size}
        disabled={disabled || effectiveLoading}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        startIcon={iconPosition === "start" ? activeIcon : undefined}
        endIcon={iconPosition === "end" ? activeIcon : undefined}
        className={combinedClassName}
        style={style}
        aria-busy={effectiveLoading ? "true" : undefined}
        aria-description={accessibleDescription}
        {...restProps}
      >
        {/* Progress feedback for Delete press-and-hold */}
        {mode === "delete" && (
          <HoldProgress
            active={hold.isHolding}
            duration={holdDuration}
            showBar={showHoldBar}
          />
        )}

        <span className={styles.content}>{activeContent}</span>
      </MuiButton>
    );
  }
);

WeaverButton.displayName = "WeaverButton";

export default WeaverButton;
