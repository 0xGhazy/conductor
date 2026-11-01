import type { Node } from "@xyflow/react";
import type { WeaverNodePanelTabId } from "../nodeDefinition.types";

export interface WeaverNodeConfigurationPanelProps {
  /** Optional override for selected node; defaults to store.selectedId -> store.nodes */
  selectedNode?: Node | null;
  /** Optional override for node update handler */
  onUpdateConfig?: (nodeId: string, patch: Record<string, any>) => void;
  /** Whether panel is currently collapsed */
  collapsed?: boolean;
  /** Callback fired when collapse state changes */
  onToggleCollapse?: () => void;
  /** Controlled active tab ID */
  activeTab?: WeaverNodePanelTabId;
  /** Callback fired when active tab changes */
  onTabChange?: (tabId: WeaverNodePanelTabId) => void;
  /** Whether the panel is in read-only mode */
  readOnly?: boolean;
  /** Initial or default panel width in pixels @default 380 */
  defaultWidth?: number;
  /** Minimum panel width in pixels @default 280 */
  minWidth?: number;
  /** Maximum panel width in pixels @default 720 */
  maxWidth?: number;
  /** Controlled width in pixels */
  width?: number;
  /** Callback fired when width changes */
  onWidthChange?: (width: number) => void;
  /** Custom CSS class */
  className?: string;
}
