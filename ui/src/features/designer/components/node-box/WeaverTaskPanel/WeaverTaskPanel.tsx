import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { WeaverTextField } from "@/components/common/fields/WeaverTextField/WeaverTextField";
import { WeaverTaskCategory } from "../WeaverTaskCategory";
import { WeaverTaskCard } from "../WeaverTaskCard";
import { DEFAULT_TASK_REGISTRY } from "./taskRegistry";
import type { WeaverTaskPanelProps, TaskRegistryItem } from "./WeaverTaskPanel.types";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import styles from "./WeaverTaskPanel.module.css";

const CATEGORY_ORDER = ["QUICK ADD"];

export const WeaverTaskPanel: React.FC<WeaverTaskPanelProps> = ({
  items,
  onAddNode,
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const storeAddNode = useDesignerStore((state) => state.addNode);
  const pendingConnectionSource = useDesignerStore(
    (state) => state.pendingConnectionSource
  );
  const setPendingConnectionSource = useDesignerStore(
    (state) => state.setPendingConnectionSource
  );

  useEffect(() => {
    if (pendingConnectionSource) {
      searchInputRef.current?.focus();
    }
  }, [pendingConnectionSource]);

  const allItems = useMemo<TaskRegistryItem[]>(() => {
    if (items && items.length > 0) {
      return items;
    }
    return DEFAULT_TASK_REGISTRY;
  }, [items]);

  const handleAddNode = useCallback(
    (type: string) => {
      if (onAddNode) {
        onAddNode(type);
      } else {
        storeAddNode(type);
      }
    },
    [onAddNode, storeAddNode]
  );

  const handleDisabledClick = useCallback(
    (item: { type: string; name: string }) => {
      // User clicked a coming-soon task
      // Future actions can notify user or open request form
    },
    []
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allItems;

    return allItems.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const shortName = String(item.shortName || "").toLowerCase();
      const desc = String(item.description || "").toLowerCase();
      const type = String(item.type || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();
      const keywords = (item.keywords || []).map((k) => k.toLowerCase());

      return (
        name.includes(query) ||
        shortName.includes(query) ||
        desc.includes(query) ||
        type.includes(query) ||
        category.includes(query) ||
        keywords.some((kw) => kw.includes(query))
      );
    });
  }, [allItems, searchQuery]);

  const groupedCategories = useMemo(() => {
    const groups = new Map<string, TaskRegistryItem[]>();

    filteredItems.forEach((item) => {
      const category = item.category || "OTHER";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(item);
    });

    const categories = Array.from(groups.keys());
    return categories.sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a);
      const indexB = CATEGORY_ORDER.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    }).map((category) => ({
      category,
      items: groups.get(category)!,
    }));
  }, [filteredItems]);

  return (
    <aside
      className={`${styles.panelShell} ${className}`}
      aria-label="Weaver Nodes and Tasks Panel"
    >
      <div className={styles.searchContainer}>
        <WeaverTextField
          ref={searchInputRef}
          value={searchQuery}
          onChange={(value) => setSearchQuery(value)}
          placeholder="Search tasks..."
          clearable
          size="small"
          startAdornment={<Search size={16} className={styles.searchIcon} />}
          className={styles.searchInput}
          aria-label="Search tasks"
        />
      </div>

      <div className={styles.scrollContainer}>
        {groupedCategories.map(({ category, items: categoryItems }) => (
          <WeaverTaskCategory
            key={category}
            title={category}
            isQuickAdd={category === "QUICK ADD"}
          >
            {categoryItems.map((item) => (
              <WeaverTaskCard
                key={`${item.category}-${item.type}-${item.name}`}
                type={item.type}
                name={item.name}
                shortName={item.shortName}
                icon={item.icon}
                description={item.description}
                category={item.category}
                disabled={Boolean(item.disabled)}
                onAdd={handleAddNode}
                onDisabledClick={handleDisabledClick}
              />
            ))}
          </WeaverTaskCategory>
        ))}

        {groupedCategories.length === 0 ? (
          <div className={styles.emptyState}>
            <Search size={26} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>No tasks found</div>
            <div className={styles.emptyDescription}>
              No tasks matched &ldquo;{searchQuery}&rdquo;. Try searching for &ldquo;http&rdquo;, &ldquo;switch&rdquo;, or &ldquo;wait&rdquo;.
            </div>
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
