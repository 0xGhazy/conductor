import type { CSSProperties, ElementType, MouseEvent, ReactNode } from "react";
import type { Position } from "@xyflow/react";

export interface WeaverTaskNodeContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

/** Props an icon component receives when passed as `icon={SomeIcon}`. */
export interface WeaverTaskNodeIconProps {
  size?: number;
  className?: string;
}

export type WeaverTaskExecutionStatus =
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "TIMED_OUT"
  | "SKIPPED"
  | "PAUSED"
  | "IN_PROGRESS"
  | "CANCELED"
  | string;

export interface WeaverTaskNodeProps {
  /** React Flow node id. */
  id: string;
  /** Main label shown next to the icon. */
  title: ReactNode;
  /** Task reference name shown under the title (also used by "Copy Reference"). */
  taskReferenceName?: string;
  /** Optional muted line under the reference name (e.g. "GET https://..."). */
  subtitle?: ReactNode;
  /** Optional informational description shown in hover tooltip after 300ms. */
  description?: ReactNode;
  /**
   * Either an icon component (`icon={Timer}`), rendered with the shared size/class,
   * or a ready element (`icon={<SiRedis color="#dc382d" />}`) rendered as-is.
   */
  icon?: ReactNode | ElementType<WeaverTaskNodeIconProps>;
  /** Accent color driving the card border and icon tint (`--action-node-color`). */
  color?: string;

  /** Extra class/style for the card itself. */
  className?: string;
  style?: CSSProperties;
  /** Extra class/style for the outer wrapper (card + handles + children). */
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;

  /** Execution Telemetry Mode properties */
  status?: WeaverTaskExecutionStatus;
  durationMs?: number;
  retryCount?: number;
  errorMessage?: string;
  renderStatusBadge?: (status: string) => ReactNode;

  /**
   * Read-only canvases (e.g. execution diagrams): hides the (+) output handle and the
   * right-click menu. Pair with `selected`, since selection no longer comes from the designer store.
   */
  readOnly?: boolean;
  /** Overrides the designer-store selection state when provided. */
  selected?: boolean;

  onDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  /** Items inserted between "Copy Reference" and "Delete". */
  contextMenuItems?: WeaverTaskNodeContextMenuItem[];

  hideTargetHandle?: boolean;
  targetHandleId?: string;
  targetHandlePosition?: Position;
  targetHandleStyle?: CSSProperties;
  /** Hides the (+) output handle, e.g. for terminal tasks. */
  hideSourceHandle?: boolean;
  sourceHandleId?: string;
  sourceHandlePosition?: Position;
  sourceHandleStyle?: CSSProperties;
  /** Replaces the default (+) output handle, e.g. for multi-branch tasks. */
  customHandles?: ReactNode;

  /** Rendered after the card, inside the wrapper (badges, overlays...). */
  children?: ReactNode;
}
