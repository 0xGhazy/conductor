import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

/** Works with both React and native (e.g. window) keyboard events. */
export interface HoldKeyEvent {
  key: string;
  repeat: boolean;
  preventDefault: () => void;
}

export interface UseHoldToConfirmOptions {
  /** Called once the press has been held for `duration` ms. */
  onConfirm: () => void;
  /**
   * Required hold duration in milliseconds.
   * @default 1500
   */
  duration?: number;
  /** When false, new holds are ignored (e.g. disabled or loading). @default true */
  enabled?: boolean;
  /** `KeyboardEvent.key` values that start a hold. @default [" ", "Enter"] */
  keys?: readonly string[];
  onHoldStart?: () => void;
  onHoldCancel?: () => void;
}

export interface HoldToConfirmHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: HoldKeyEvent) => void;
  onKeyUp: (event: HoldKeyEvent) => void;
}

export interface UseHoldToConfirmResult {
  isHolding: boolean;
  cancelHold: () => void;
  /** Spread onto the element that should be pressed and held. */
  handlers: HoldToConfirmHandlers;
}

const DEFAULT_HOLD_KEYS = [" ", "Enter"] as const;

/**
 * Press-and-hold confirmation (pointer, or Space/Enter) shared by destructive actions
 * such as WeaverButton's `delete` mode. Pair with `HoldProgress` for visual feedback.
 */
export function useHoldToConfirm({
  onConfirm,
  duration = 1500,
  enabled = true,
  keys = DEFAULT_HOLD_KEYS,
  onHoldStart,
  onHoldCancel,
}: UseHoldToConfirmOptions): UseHoldToConfirmResult {
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);
  const isKeyDownRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      isHoldingRef.current = false;
      isKeyDownRef.current = false;
    };
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setIsHolding(false);
      onHoldCancel?.();
    }
    isKeyDownRef.current = false;
  }, [onHoldCancel]);

  const startHold = useCallback(() => {
    isHoldingRef.current = true;
    setIsHolding(true);
    onHoldStart?.();

    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      isHoldingRef.current = false;
      isKeyDownRef.current = false;
      setIsHolding(false);
      onConfirmRef.current();
    }, duration);
  }, [duration, onHoldStart]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      // Only respond to primary click (mouse left-button) or touch/pen
      if (event.button !== 0) return;
      if (isHoldingRef.current) return;
      startHold();
    },
    [enabled, startHold]
  );

  const onKeyDown = useCallback(
    (event: HoldKeyEvent) => {
      if (!enabled || !keys.includes(event.key)) return;
      // Prevent page scroll on Space key
      if (event.key === " ") {
        event.preventDefault();
      }
      // Ignore repeated keydown events caused by holding key down
      if (event.repeat || isKeyDownRef.current || isHoldingRef.current) return;
      isKeyDownRef.current = true;
      startHold();
    },
    [enabled, keys, startHold]
  );

  const onKeyUp = useCallback(
    (event: HoldKeyEvent) => {
      if (keys.includes(event.key)) {
        cancelHold();
      }
    },
    [keys, cancelHold]
  );

  return {
    isHolding,
    cancelHold,
    handlers: {
      onPointerDown,
      onPointerUp: cancelHold,
      onPointerLeave: cancelHold,
      onPointerCancel: cancelHold,
      onKeyDown,
      onKeyUp,
    },
  };
}
