import type { ReactNode, CSSProperties } from "react";

/**
 * Navigation item specification for WeaverRelatedList.
 */
export interface WeaverRelatedListItem {
  /** Unique identifier for the related section item */
  id: string;

  /** Display label for the navigation item */
  label: ReactNode;

  /** Target DOM element ID corresponding to the in-page section to navigate to */
  targetId: string;

  /** Optional icon prefix displayed next to the label */
  icon?: ReactNode;

  /** Whether the item is disabled and non-navigable */
  disabled?: boolean;
}

/**
 * Public component properties for WeaverRelatedList.
 */
export interface WeaverRelatedListProps {
  /** Array of related navigation items */
  items: WeaverRelatedListItem[];

  /** Section header title (default: "Related List") */
  title?: ReactNode;

  /** Whether the list uses sticky positioning on desktop (default: true) */
  sticky?: boolean;

  /** Controlled active item ID */
  activeItemId?: string;

  /** Uncontrolled initial active item ID (defaults to first item id) */
  defaultActiveItemId?: string;

  /** Callback fired when the active section changes via scroll or selection */
  onActiveItemChange?: (id: string) => void;

  /** Callback fired when an item is clicked */
  onItemClick?: (item: WeaverRelatedListItem) => void;

  /** Scroll behavior when navigating to a section (default: "smooth") */
  scrollBehavior?: ScrollBehavior;

  /** Optional top offset in pixels or CSS string for sticky positioning */
  stickyTop?: number | string;

  /** Additional custom CSS class */
  className?: string;

  /** Inline styles */
  style?: CSSProperties;
}
