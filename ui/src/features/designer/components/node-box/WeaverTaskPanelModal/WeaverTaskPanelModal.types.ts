import type { TaskRegistryItem } from "../WeaverTaskPanel/WeaverTaskPanel.types";

export interface WeaverTaskPanelModalProps {
  /** Controls whether the task panel popup is visible */
  open: boolean;

  /** Callback fired when the popup requests to close */
  onClose: () => void;

  /** Callback fired when a node type is selected */
  onAddNode?: (type: string) => void;

  /** Optional custom tasks (defaults to canonical task registry) */
  items?: TaskRegistryItem[];
}
