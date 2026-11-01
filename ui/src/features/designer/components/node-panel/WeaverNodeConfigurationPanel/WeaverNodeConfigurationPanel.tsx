import React, { useState, useEffect, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import TuneIcon from "@mui/icons-material/Tune";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import type { Node } from "@xyflow/react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import { getNodeDefinition } from "../nodeDefinitionRegistry";
import type {
  WeaverNodePanelTabId,
  WeaverNodePanelContext,
} from "../nodeDefinition.types";
import type { WeaverNodeConfigurationPanelProps } from "./WeaverNodeConfigurationPanel.types";
import { NodeJsonTab, NodeResultTab, NodeLogsTab } from "../tabs";
import { isStartNode } from "@/features/designer/utils/designerGraphUtils";
import { StartNodeDefinition } from "../definitions/start";
import {
  buildExportPayload,
  buildNestedWorkflowTasksFromGraph,
} from "@/features/designer/utils/workflowSerialization";
import styles from "./WeaverNodeConfigurationPanel.module.css";

export const WeaverNodeConfigurationPanel: React.FC<
  WeaverNodeConfigurationPanelProps
> = ({
  selectedNode: controlledSelectedNode,
  onUpdateConfig,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  activeTab: controlledActiveTab,
  onTabChange,
  readOnly = false,
  defaultWidth = 380,
  minWidth = 280,
  maxWidth = 720,
  width: controlledWidth,
  onWidthChange,
  className = "",
}) => {
  const storeNodes = useDesignerStore((state) => state.nodes);
  const storeEdges = useDesignerStore((state) => state.edges);
  const storeSelectedId = useDesignerStore((state) => state.selectedId);
  const setNodes = useDesignerStore((state) => state.setNodes);
  const storeNodePanelCollapsed = useDesignerStore((state) => state.nodePanelCollapsed);
  const setStoreNodePanelCollapsed = useDesignerStore((state) => state.setNodePanelCollapsed);

  const workflowName = useDesignerStore((state) => state.workflowName);
  const workflowDescription = useDesignerStore((state) => state.workflowDescription);
  const workflowVersion = useDesignerStore((state) => state.workflowVersion);
  const workflowVariables = useDesignerStore((state) => state.workflowVariables);
  const workflowLanguage = useDesignerStore((state) => state.workflowLanguage);
  const workflowSupportedLanguages = useDesignerStore((state) => state.workflowSupportedLanguages);
  const setWorkflowName = useDesignerStore((state) => state.setWorkflowName);
  const setWorkflowDescription = useDesignerStore((state) => state.setWorkflowDescription);
  const setWorkflowVersion = useDesignerStore((state) => state.setWorkflowVersion);
  const setWorkflowVariables = useDesignerStore((state) => state.setWorkflowVariables);
  const setWorkflowLanguage = useDesignerStore((state) => state.setWorkflowLanguage);
  const setWorkflowSupportedLanguages = useDesignerStore((state) => state.setWorkflowSupportedLanguages);

  // Collapse state management
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed =
    controlledCollapsed !== undefined
      ? controlledCollapsed
      : storeNodePanelCollapsed !== undefined
      ? storeNodePanelCollapsed
      : internalCollapsed;

  const toggleCollapse = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else if (setStoreNodePanelCollapsed) {
      setStoreNodePanelCollapsed((prev) => !prev);
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  }, [onToggleCollapse, setStoreNodePanelCollapsed]);

  // Width & Resizing state
  const [internalWidth, setInternalWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("weaver_node_panel_width");
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage error
    }
    return defaultWidth;
  });

  const currentWidth = controlledWidth !== undefined ? controlledWidth : internalWidth;
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = currentWidth;
      const isRtl =
        document.dir === "rtl" || document.documentElement.dir === "rtl";

      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const rawWidth = isRtl ? startWidth + deltaX : startWidth - deltaX;
        const clamped = Math.min(
          Math.max(rawWidth, minWidth),
          Math.min(maxWidth, window.innerWidth - 100)
        );
        setInternalWidth(clamped);
        onWidthChange?.(clamped);
      };

      const onPointerUp = () => {
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);

        try {
          setInternalWidth((finalWidth) => {
            localStorage.setItem("weaver_node_panel_width", String(finalWidth));
            return finalWidth;
          });
        } catch {
          // Ignore localStorage error
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [currentWidth, minWidth, maxWidth, onWidthChange]
  );

  const handleResetWidth = useCallback(() => {
    setInternalWidth(defaultWidth);
    onWidthChange?.(defaultWidth);
    try {
      localStorage.setItem("weaver_node_panel_width", String(defaultWidth));
    } catch {
      // Ignore localStorage error
    }
  }, [defaultWidth, onWidthChange]);

  // Explicit empty state check (for tests passing selectedNode={null})
  const isExplicitEmpty = controlledSelectedNode === null;

  // Selected node resolution
  const selectedNode = useMemo(() => {
    if (controlledSelectedNode !== undefined) return controlledSelectedNode;
    if (!storeSelectedId) return null;
    return storeNodes.find((n) => n.id === storeSelectedId) || null;
  }, [controlledSelectedNode, storeSelectedId, storeNodes]);

  const existingStart = useMemo(
    () => storeNodes.find((n) => isStartNode(n)),
    [storeNodes]
  );

  // When no node is selected on the designer board, active context is the Workflow Configuration
  const isWorkflow = useMemo(() => {
    if (controlledSelectedNode !== undefined) {
      return false;
    }
    return !selectedNode;
  }, [controlledSelectedNode, selectedNode]);

  const workflowNode: Node = useMemo(() => {
    const startConfig = existingStart?.data?.config || {};
    return {
      id: existingStart?.id || "workflow-configuration",
      type: "START",
      position: existingStart?.position || { x: 0, y: 0 },
      data: {
        name: workflowName || startConfig.name || existingStart?.data?.name || "Workflow",
        config: {
          ...startConfig,
          name: workflowName || startConfig.name || "Workflow",
          version: workflowVersion || startConfig.version || 1,
          description: workflowDescription || startConfig.description || "",
          variables: workflowVariables ?? startConfig.variables ?? {},
          language: workflowLanguage ?? startConfig.language ?? "",
          supportedLanguages: workflowSupportedLanguages ?? startConfig.supportedLanguages ?? [],
        },
      },
    };
  }, [
    existingStart,
    workflowName,
    workflowVersion,
    workflowDescription,
    workflowVariables,
    workflowLanguage,
    workflowSupportedLanguages,
  ]);

  const activeNode = useMemo(() => {
    if (isExplicitEmpty) return null;
    if (isWorkflow) return workflowNode;
    return selectedNode;
  }, [isExplicitEmpty, isWorkflow, workflowNode, selectedNode]);

  // Node definition resolution
  const definition = useMemo(() => {
    if (isWorkflow) return StartNodeDefinition;
    return getNodeDefinition(activeNode);
  }, [isWorkflow, activeNode]);

  const showLogs = useWorkflowExecutionStore((state) => state.options.showLogs);

  // Tabs for currently selected node
  const tabs = useMemo(() => {
    const rawTabs = definition?.tabs || [];
    if (
      showLogs ||
      activeNode?.type === "DATABASE_ACTION" ||
      definition?.type === "DATABASE_ACTION" ||
      activeNode?.type === "REDIS_ACTION" ||
      definition?.type === "REDIS_ACTION"
    ) {
      return rawTabs;
    }
    return rawTabs.filter((t) => t.id !== "logs");
  }, [definition, showLogs, activeNode]);

  // Tab state management with preservation across node switches
  const [internalActiveTab, setInternalActiveTab] = useState<WeaverNodePanelTabId>("configuration");
  const currentActiveTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const setActiveTab = useCallback(
    (tabId: WeaverNodePanelTabId) => {
      if (onTabChange) {
        onTabChange(tabId);
      } else {
        setInternalActiveTab(tabId);
      }
    },
    [onTabChange]
  );

  // When selected node changes: preserve active tab if available, else fallback to defaultTab or tabs[0].id
  useEffect(() => {
    if (!definition || tabs.length === 0) return;

    const currentTabExists = tabs.some((t) => t.id === currentActiveTab);
    if (!currentTabExists) {
      const fallbackTab = definition.defaultTab || tabs[0].id;
      setActiveTab(fallbackTab);
    }
  }, [definition, tabs, currentActiveTab, setActiveTab]);

  // Centralized safe node update flow
  const handleUpdateConfig = useCallback(
    (patch: Record<string, any>) => {
      if (!activeNode) return;

      if (isWorkflow) {
        if (patch.name !== undefined) setWorkflowName(patch.name);
        if (patch.description !== undefined) setWorkflowDescription(patch.description);
        if (patch.version !== undefined) setWorkflowVersion(String(patch.version));
        if (patch.variables !== undefined) setWorkflowVariables(patch.variables);
        if (patch.language !== undefined) setWorkflowLanguage(patch.language);
        if (patch.supportedLanguages !== undefined) setWorkflowSupportedLanguages(patch.supportedLanguages);

        if (existingStart) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.id !== existingStart.id) return node;
              const currentConfig = node.data?.config || {};
              const nextConfig = { ...currentConfig, ...patch };
              return {
                ...node,
                data: {
                  ...node.data,
                  name: patch.name !== undefined ? patch.name : node.data?.name,
                  config: nextConfig,
                },
              };
            })
          );
        }
        if (onUpdateConfig && existingStart) {
          onUpdateConfig(existingStart.id, patch);
        }
        return;
      }

      if (onUpdateConfig) {
        onUpdateConfig(activeNode.id, patch);
        return;
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== activeNode.id) return node;

          const currentConfig = node.data?.config || {};
          const nextConfig = { ...currentConfig, ...patch };

          // Keep display name in sync if patch provides nodeName, label, or name (when not a referenceName update)
          const nextDisplayName =
            patch.nodeName !== undefined
              ? patch.nodeName
              : patch.label !== undefined
              ? patch.label
              : (patch.name !== undefined && !patch.referenceName && !patch.taskReferenceName)
              ? patch.name
              : node.data?.name;

          return {
            ...node,
            data: {
              ...node.data,
              name: nextDisplayName,
              config: nextConfig,
            },
          };
        })
      );
    },
    [
      activeNode,
      isWorkflow,
      existingStart,
      onUpdateConfig,
      setNodes,
      setWorkflowName,
      setWorkflowDescription,
      setWorkflowVersion,
      setWorkflowVariables,
      setWorkflowLanguage,
      setWorkflowSupportedLanguages,
    ]
  );

  // Context passed to custom tab renderers
  const panelContext: WeaverNodePanelContext = useMemo(
    () => ({
      node: activeNode!,
      readOnly,
      updateConfig: handleUpdateConfig,
    }),
    [activeNode, readOnly, handleUpdateConfig]
  );

  // Render tab content based on tab declaration
  const renderTabContent = () => {
    if (!activeNode || !definition) return null;

    const activeTabDef = tabs.find((t) => t.id === currentActiveTab);
    if (!activeTabDef) return null;

    if (activeTabDef.render === "configuration") {
      const ConfigComponent = definition.ConfigurationComponent;
      if (!ConfigComponent) {
        return (
          <Box sx={{ p: 3, color: "var(--color-fg-muted, #667085)", fontSize: 13 }}>
            Configuration component is not defined for this node type.
          </Box>
        );
      }
      return (
        <ConfigComponent
          key={activeNode.id}
          node={activeNode}
          value={activeNode.data?.config || {}}
          onChange={handleUpdateConfig}
          readOnly={readOnly}
          disabled={readOnly}
        />
      );
    }

    if (activeTabDef.render === "json") {
      return (
        <NodeJsonTab
          key={activeNode.id}
          node={activeNode}
          customSerializer={
            isWorkflow
              ? () => {
                  try {
                    const workflowTasks = buildNestedWorkflowTasksFromGraph(storeNodes, storeEdges);
                    return buildExportPayload({
                      nodes: storeNodes,
                      edges: storeEdges,
                      workflowName: workflowName || "workflow",
                      workflowVersion: workflowVersion ? Number(workflowVersion) || 1 : 1,
                      workflowVariables: workflowVariables ?? {},
                      workflowDescription: workflowDescription || "",
                      workflowLanguage: workflowLanguage || "",
                      workflowSupportedLanguages: workflowSupportedLanguages ?? [],
                      workflowTasks,
                    });
                  } catch {
                    return activeNode.data?.config || {};
                  }
                }
              : definition.serializeForJson
          }
          context={panelContext}
        />
      );
    }

    if (activeTabDef.render === "result") {
      return <NodeResultTab key={activeNode.id} node={activeNode} context={panelContext} />;
    }

    if (activeTabDef.render === "logs") {
      return <NodeLogsTab key={activeNode.id} node={activeNode} context={panelContext} />;
    }

    if (typeof activeTabDef.render === "function") {
      const CustomRenderer = activeTabDef.render;
      return <CustomRenderer {...panelContext} />;
    }

    return null;
  };

  // When panel is collapsed, render only the floating expand toggle
  if (isCollapsed) {
    return (
      <Tooltip title="Expand node configuration" placement="left">
        <button
          type="button"
          className={styles.expandToggle}
          onClick={toggleCollapse}
          aria-label="Expand node configuration"
        >
          <ChevronLeftIcon fontSize="small" />
        </button>
      </Tooltip>
    );
  }

  // Empty state when no node is selected and not in workflow mode
  if (!activeNode) {
    return (
      <aside
        className={`${styles.panel} ${isResizing ? styles.resizing : ""} ${className}`.trim()}
        style={{ width: `${currentWidth}px` }}
        role="region"
        aria-label="Node Configuration Panel"
      >
        <div
          className={`${styles.resizeHandle} ${isResizing ? styles.isResizing : ""}`}
          onPointerDown={handleResizeStart}
          onDoubleClick={handleResetWidth}
          title="Drag left or right to resize panel (double-click to reset)"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize node configuration panel"
        />
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerIconBadge}>
              <TuneIcon fontSize="small" />
            </div>
            <div className={styles.headerText}>
              <span className={styles.headerTitle}>Node Configuration</span>
              <span className={styles.headerSubtitle}>Workflow Editor</span>
            </div>
          </div>
          <Tooltip title="Collapse panel" placement="left">
            <button
              type="button"
              className={styles.collapseButton}
              onClick={toggleCollapse}
              aria-label="Collapse node configuration panel"
            >
              <ChevronRightIcon fontSize="small" />
            </button>
          </Tooltip>
        </div>

        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrapper}>
            <HelpOutlineIcon sx={{ fontSize: 32 }} />
          </div>
          <div className={styles.emptyTitle}>Node Configuration</div>
          <div className={styles.emptyDescription}>
            Select a node to inspect or configure it.
          </div>
        </div>
      </aside>
    );
  }

  // State when selected node has no registered definition
  if (!definition) {
    return (
      <aside
        className={`${styles.panel} ${isResizing ? styles.resizing : ""} ${className}`.trim()}
        style={{ width: `${currentWidth}px` }}
        role="region"
        aria-label="Node Configuration Panel"
      >
        <div
          className={`${styles.resizeHandle} ${isResizing ? styles.isResizing : ""}`}
          onPointerDown={handleResizeStart}
          onDoubleClick={handleResetWidth}
          title="Drag left or right to resize panel (double-click to reset)"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize node configuration panel"
        />
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerIconBadge}>
              <TuneIcon fontSize="small" />
            </div>
            <div className={styles.headerText}>
              <span className={styles.headerTitle}>
                {activeNode.data?.name || activeNode.type}
              </span>
              <span className={styles.headerSubtitle}>Unknown Node</span>
            </div>
          </div>
          <Tooltip title="Collapse panel" placement="left">
            <button
              type="button"
              className={styles.collapseButton}
              onClick={toggleCollapse}
              aria-label="Collapse node configuration panel"
            >
              <ChevronRightIcon fontSize="small" />
            </button>
          </Tooltip>
        </div>

        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Unsupported Node Type</div>
          <div className={styles.emptyDescription}>
            Configuration unavailable for this node type.
          </div>
        </div>
      </aside>
    );
  }

  const nodeDisplayName =
    activeNode.data?.config?.nodeName ||
    activeNode.data?.config?.name ||
    activeNode.data?.name ||
    definition.label;

  return (
    <aside
      className={`${styles.panel} ${isResizing ? styles.resizing : ""} ${className}`.trim()}
      style={{ width: `${currentWidth}px` }}
      role="region"
      aria-label="Node Configuration Panel"
    >
      <div
        className={`${styles.resizeHandle} ${isResizing ? styles.isResizing : ""}`}
        onPointerDown={handleResizeStart}
        onDoubleClick={handleResetWidth}
        title="Drag left or right to resize panel (double-click to reset)"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize node configuration panel"
      />
      {/* Sticky Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.headerIconBadge}>
            {isWorkflow ? <TuneIcon fontSize="small" /> : (definition.icon || <TuneIcon fontSize="small" />)}
          </div>
          <div className={styles.headerText}>
            <span className={styles.headerTitle} title={String(nodeDisplayName)}>
              {isWorkflow ? (workflowName || "Workflow Configuration") : nodeDisplayName}
            </span>
            <span className={styles.headerSubtitle}>
              {isWorkflow ? "Workflow Configurations" : `${definition.label} Node`}
            </span>
          </div>
        </div>
        <Tooltip title="Collapse panel" placement="left">
          <button
            type="button"
            className={styles.collapseButton}
            onClick={toggleCollapse}
            aria-label="Collapse node configuration panel"
          >
            <ChevronRightIcon fontSize="small" />
          </button>
        </Tooltip>
      </div>

      {/* Sticky Tabs from selected node definition */}
      {tabs.length > 0 && (
        <div className={styles.tabsContainer}>
          <div className={styles.tabList} role="tablist" aria-label="Node tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === currentActiveTab;
              const isDisabled =
                typeof tab.disabled === "function"
                  ? tab.disabled(panelContext)
                  : Boolean(tab.disabled);

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`node-tab-${tab.id}`}
                  aria-controls={`node-tabpanel-${tab.id}`}
                  aria-selected={isActive}
                  disabled={isDisabled}
                  className={`${styles.tabButton} ${
                    isActive ? styles.activeTab : ""
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon && (
                    <span style={{ display: "inline-flex", alignItems: "center" }}>
                      {tab.icon}
                    </span>
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div
        className={styles.contentArea}
        role="tabpanel"
        id={`node-tabpanel-${currentActiveTab}`}
        aria-labelledby={`node-tab-${currentActiveTab}`}
      >
        {renderTabContent()}
      </div>
    </aside>
  );
};
