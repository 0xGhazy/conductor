import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import styles from "./SelectionTrace.module.css";

export const SELECTION_TRACE_DURATION_MS = 2400;

/** Streak layers, longest first. Lengths are % of the perimeter (pathLength = 100). */
const STREAK_LAYERS = [
  { length: 24, className: styles.trail },
  { length: 10, className: styles.body },
  { length: 3, className: styles.head },
] as const;
const LONGEST_STREAK = STREAK_LAYERS[0].length;

interface TraceGeometry {
  radius: number;
  borderWidth: number;
}

const readGeometry = (target: HTMLElement | null): TraceGeometry => {
  if (!target) return { radius: 0, borderWidth: 0 };
  const computed = window.getComputedStyle(target);
  return {
    radius: parseFloat(computed.borderTopLeftRadius) || 0,
    borderWidth: parseFloat(computed.borderTopWidth) || 0,
  };
};

export interface SelectionTraceProps {
  /** Render and animate only while true (e.g. the node is selected). */
  active: boolean;
  /** Element whose border is traced; its radius and border width are read on activation. */
  targetRef: RefObject<HTMLElement | null>;
  /** Milliseconds per full loop. @default 2400 */
  duration?: number;
}

/**
 * A glowing light streak that travels clockwise along `targetRef`'s border.
 * Render it as a sibling of the target inside a `position: relative` container
 * that matches the target's border box. Never intercepts pointer events.
 */
export function SelectionTrace({
  active,
  targetRef,
  duration = SELECTION_TRACE_DURATION_MS,
}: SelectionTraceProps) {
  const [geometry, setGeometry] = useState<TraceGeometry | null>(null);

  useLayoutEffect(() => {
    if (active) {
      setGeometry(readGeometry(targetRef.current));
    }
  }, [active, targetRef]);

  if (!active || !geometry) return null;

  // Centre the stroke on the target's border line, following its rounded corners.
  const inset = geometry.borderWidth / 2;
  const rectProps = {
    x: inset,
    y: inset,
    rx: Math.max(0, geometry.radius - inset),
    pathLength: 100,
  };
  const rectSize: CSSProperties = {
    width: `calc(100% - ${geometry.borderWidth}px)`,
    height: `calc(100% - ${geometry.borderWidth}px)`,
  };

  return (
    <svg className={styles.trace} aria-hidden="true" focusable="false" data-testid="selection-trace">
      <rect {...rectProps} className={styles.track} style={rectSize} />
      {STREAK_LAYERS.map(({ length, className }) => (
        <rect
          key={length}
          {...rectProps}
          className={`${styles.streak} ${className}`}
          style={{
            ...rectSize,
            strokeDasharray: `${length} ${100 - length}`,
            animationDuration: `${duration}ms`,
            // Shift shorter layers forward so every layer's leading edge lines up with the head.
            animationDelay: `${(-duration * (LONGEST_STREAK - length)) / 100}ms`,
          }}
        />
      ))}
    </svg>
  );
}

export default SelectionTrace;
