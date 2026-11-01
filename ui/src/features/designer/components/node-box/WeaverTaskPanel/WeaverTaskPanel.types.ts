import type { ReactNode } from "react";

export interface TaskRegistryItem {
  /** Unique task/node type identifier */
  type: string;

  /** Full display name of the task */
  name: string;

  /** Compact label displayed on the card (wraps/truncates to 2 lines) */
  shortName?: string;

  /** Task icon */
  icon: ReactNode;

  /** Category grouping (e.g. "QUICK ADD", "AGENTIC ORCHESTRATION") */
  category: string;

  /** Task description for tooltip & search */
  description: string;

  /** Search keywords for dynamic filtering */
  keywords?: string[];

  /** Whether the task is disabled / coming soon */
  disabled?: boolean;
}

export interface WeaverTaskPanelProps {
  /** Optional custom list of tasks (defaults to canonical task registry) */
  items?: TaskRegistryItem[];

  /** Callback fired when user clicks to add a task to the canvas */
  onAddNode?: (type: string) => void;

  /** Optional custom CSS class name */
  className?: string;
}
