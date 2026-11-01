import type { ReactNode } from "react";

export interface WeaverTaskCategoryProps {
  /** Category section title (e.g. "QUICK ADD", "AGENTIC ORCHESTRATION") */
  title: string;

  /** Whether this is the primary Quick Add section */
  isQuickAdd?: boolean;

  /** Card elements rendered inside the 6-column grid */
  children: ReactNode;

  /** Optional custom CSS class name */
  className?: string;
}
