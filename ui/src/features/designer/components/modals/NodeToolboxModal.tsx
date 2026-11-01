import React, { useEffect, useMemo, useRef } from "react";
import Modal from "@mui/material/Modal";
import Backdrop from "@mui/material/Backdrop";
import Fade from "@mui/material/Fade";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { modalStyle } from "@/utils/modalStyle";
import {
  NODE_TOOLBOX_ITEMS,
  NODE_TOOLBOX_CATEGORY_ORDER,
  NODE_TOOLBOX_CATEGORY_STYLES,
  type NodeToolboxItem,
} from "@/features/designer/utils/nodeDefinitions";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useShallow } from "zustand/react/shallow";

interface IndexedToolboxItem extends NodeToolboxItem {
  toolboxIndex: number;
}

interface ToolboxSection {
  category: string;
  items: IndexedToolboxItem[];
}

const NodeToolboxModalBase: React.FC = () => {
  const {
    nodeToolboxOpen,
    nodeToolboxQuery,
    nodeToolboxSelectionIndex,
    setNodeToolboxOpen,
    setNodeToolboxQuery,
    setNodeToolboxSelectionIndex,
    addNode,
  } = useDesignerStore(
    useShallow((state) => ({
      nodeToolboxOpen: state.nodeToolboxOpen,
      nodeToolboxQuery: state.nodeToolboxQuery,
      nodeToolboxSelectionIndex: state.nodeToolboxSelectionIndex,
      setNodeToolboxOpen: state.setNodeToolboxOpen,
      setNodeToolboxQuery: state.setNodeToolboxQuery,
      setNodeToolboxSelectionIndex: state.setNodeToolboxSelectionIndex,
      addNode: state.addNode,
    }))
  );

  const nodeToolboxInputRef = useRef<HTMLInputElement>(null);

  const filteredNodeToolboxItems = useMemo(() => {
    const query = String(nodeToolboxQuery || "").trim().toLowerCase();
    if (!query) return NODE_TOOLBOX_ITEMS;
    return NODE_TOOLBOX_ITEMS.filter((item) => {
      const label = String(item.label || "").toLowerCase();
      const description = String(item.description || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();
      const type = String(item.type || "").toLowerCase();
      return (
        label.includes(query) ||
        description.includes(query) ||
        category.includes(query) ||
        type.includes(query)
      );
    });
  }, [nodeToolboxQuery]);

  const filteredNodeToolboxSections = useMemo<ToolboxSection[]>(() => {
    const grouped = new Map<string, ToolboxSection>();
    filteredNodeToolboxItems.forEach((item, index) => {
      const category = String(item.category || "Other");
      if (!grouped.has(category)) {
        grouped.set(category, {
          category,
          items: [],
        });
      }
      grouped.get(category)!.items.push({
        ...item,
        toolboxIndex: index,
      });
    });

    return Array.from(grouped.values()).sort((left, right) => {
      const leftOrder = NODE_TOOLBOX_CATEGORY_ORDER.indexOf(left.category);
      const rightOrder = NODE_TOOLBOX_CATEGORY_ORDER.indexOf(right.category);
      if (leftOrder === -1 && rightOrder === -1) {
        return left.category.localeCompare(right.category);
      }
      if (leftOrder === -1) return 1;
      if (rightOrder === -1) return -1;
      return leftOrder - rightOrder;
    });
  }, [filteredNodeToolboxItems]);

  useEffect(() => {
    if (!nodeToolboxOpen) return;
    setNodeToolboxSelectionIndex(0);
    const timer = setTimeout(() => {
      nodeToolboxInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [nodeToolboxOpen, setNodeToolboxSelectionIndex]);

  useEffect(() => {
    if (!nodeToolboxOpen) return;
    const handleToolboxKeyDown = (event: KeyboardEvent) => {
      const key = String(event.key || "").toLowerCase();
      if (key === "escape") {
        event.preventDefault();
        setNodeToolboxOpen(false);
        return;
      }
      if (key === "arrowdown") {
        event.preventDefault();
        if (filteredNodeToolboxItems.length === 0) return;
        setNodeToolboxSelectionIndex((prev) => (prev + 1) % filteredNodeToolboxItems.length);
        return;
      }
      if (key === "arrowup") {
        event.preventDefault();
        if (filteredNodeToolboxItems.length === 0) return;
        setNodeToolboxSelectionIndex((prev) =>
          prev <= 0 ? filteredNodeToolboxItems.length - 1 : prev - 1
        );
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        const selected =
          filteredNodeToolboxItems[nodeToolboxSelectionIndex] || filteredNodeToolboxItems[0];
        if (!selected || selected.disabled) return;
        addNode(selected.type, { x: 200, y: 200 });
        setNodeToolboxOpen(false);
      }
    };

    window.addEventListener("keydown", handleToolboxKeyDown);
    return () => window.removeEventListener("keydown", handleToolboxKeyDown);
  }, [
    nodeToolboxOpen,
    filteredNodeToolboxItems,
    nodeToolboxSelectionIndex,
    setNodeToolboxOpen,
    setNodeToolboxSelectionIndex,
    addNode,
  ]);

  return (
    <Modal
      aria-labelledby="designer-node-toolbox-title"
      open={nodeToolboxOpen}
      onClose={() => setNodeToolboxOpen(false)}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 220 } }}
    >
      <Fade in={nodeToolboxOpen}>
        <Box
          sx={{
            ...modalStyle,
            top: "12%",
            transform: "translate(-50%, 0)",
            width: 900,
            maxWidth: "95vw",
            p: 0,
            overflow: "hidden",
            backgroundColor: "var(--color-canvas-subtle, #ffffff)",
            color: "var(--color-fg-default, #111827)",
          }}
          className="designer-modal node-config-modal"
          onClick={(event) => event.stopPropagation()}
        >
          <Box
            sx={{
              p: 2,
              borderBottom: "1px solid var(--color-border-default, #e5e7eb)",
            }}
          >
            <Typography
              id="designer-node-toolbox-title"
              variant="subtitle1"
              sx={{ mb: 1 }}
            >
              Node Toolbox
            </Typography>
            <input
              ref={nodeToolboxInputRef}
              type="text"
              value={nodeToolboxQuery}
              onChange={(event) => setNodeToolboxQuery(event.target.value)}
              placeholder="Type to search nodes..."
              aria-label="Search nodes"
              style={{
                width: "100%",
                border: "1px solid var(--color-border-default, #d1d5db)",
                borderRadius: 8,
                padding: "10px 12px",
                outline: "none",
                background: "var(--color-canvas-default, #fff)",
                color: "var(--color-fg-default, #111827)",
                fontSize: 14,
              }}
            />
          </Box>
          <Box sx={{ maxHeight: "56vh", overflowY: "auto", p: 1 }}>
            {filteredNodeToolboxItems.length === 0 ? (
              <Box
                sx={{
                  px: 1.5,
                  py: 2,
                  color: "var(--color-fg-muted, #6b7280)",
                  fontSize: 13,
                }}
              >
                No nodes found.
              </Box>
            ) : (
              filteredNodeToolboxSections.map((section) => {
                const categoryStyle =
                  NODE_TOOLBOX_CATEGORY_STYLES[section.category] ||
                  NODE_TOOLBOX_CATEGORY_STYLES.default;
                return (
                  <Box key={section.category} sx={{ mb: 1.5 }}>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1.5,
                        background: categoryStyle.headerBackground,
                        color: categoryStyle.headerColor,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.25,
                        textTransform: "uppercase",
                      }}
                    >
                      {section.category}
                    </Box>
                    <Box sx={{ mt: 0.5 }}>
                      {section.items.map((item) => {
                        const isSelected =
                          item.toolboxIndex === nodeToolboxSelectionIndex;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            onMouseEnter={() =>
                              setNodeToolboxSelectionIndex(item.toolboxIndex)
                            }
                            onClick={() => {
                              if (item.disabled) return;
                              addNode(item.type);
                              setNodeToolboxOpen(false);
                            }}
                            disabled={Boolean(item.disabled)}
                            style={{
                              width: "100%",
                              border: "none",
                              borderRadius: 8,
                              background: isSelected
                                ? "color-mix(in oklab, var(--color-accent-emphasis, #2563eb) 18%, transparent)"
                                : "transparent",
                              color: item.disabled
                                ? "var(--color-fg-muted, #9ca3af)"
                                : "var(--color-fg-default, #111827)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: "11px 12px",
                              textAlign: "left",
                              cursor: item.disabled ? "not-allowed" : "pointer",
                              opacity: item.disabled ? 0.7 : 1,
                            }}
                          >
                            <Box
                              sx={{
                                minWidth: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 1,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: `1px solid ${categoryStyle.iconBorder}`,
                                  background: categoryStyle.iconBackground,
                                  color: categoryStyle.iconColor,
                                  flexShrink: 0,
                                }}
                              >
                                {item.icon}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {item.label}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: "var(--color-fg-muted, #6b7280)" }}
                                >
                                  {item.description}
                                </Typography>
                              </Box>
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{ color: "var(--color-fg-muted, #6b7280)" }}
                            >
                              {item.disabled ? "Coming soon" : item.category}
                            </Typography>
                          </button>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderTop: "1px solid var(--color-border-default, #e5e7eb)",
              display: "flex",
              justifyContent: "space-between",
              color: "var(--color-fg-muted, #6b7280)",
              fontSize: 12,
            }}
          >
            <span>Ctrl+Insert: Open toolbox</span>
            <span>Enter: Insert node | Esc: Close</span>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

export const NodeToolboxModal = React.memo(NodeToolboxModalBase);
NodeToolboxModal.displayName = "NodeToolboxModal";
