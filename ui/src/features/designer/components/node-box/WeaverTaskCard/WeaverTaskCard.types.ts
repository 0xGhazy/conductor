import type { ReactNode } from "react";

export interface WeaverTaskCardProps {
  /** Unique task/node type identifier (e.g. "HTTP_ACTION", "SWITCH_ACTION") */
  type: string;

  /** Full display name of the task */
  name: string;

  /** Compact label displayed on the card (wraps or truncates to 2 lines) */
  shortName?: string;

  /** Icon displayed in the center of the card */
  icon: ReactNode;

  /** Informational description shown in the tooltip */
  description?: string;

  /** Category grouping */
  category?: string;

  /** Whether the task is currently disabled / coming soon */
  disabled?: boolean;

  /** Callback fired when user clicks to add the task to canvas */
  onAdd?: (type: string) => void;

  /** Callback fired when user clicks a disabled / coming soon task */
  onDisabledClick?: (item: { type: string; name: string }) => void;

  /** Optional custom CSS class name */
  className?: string;
}
