import React, { useMemo } from "react";
import type { ReactNode } from "react";
import { WeaverTaskPanel } from "./WeaverTaskPanel";
import type { TaskRegistryItem } from "./WeaverTaskPanel/WeaverTaskPanel.types";

export type NodeKind =
  | "START_FLAG"
  | "HTTP_ACTION"
  | "DATABASE_ACTION"
  | "JEXL_ACTION"
  | "SCRIPT_ACTION"
  | "WAIT_ACTION"
  | "FOREACH_ACTION"
  | "TERMINATE"
  | "RESPOND_ACTION"
  | "REGEX"
  | "SUBWORKFLOW_ACTION"
  | "SWITCH_ACTION"
  | "VALIDATION_ACTION"
  | "RULE_ENGINE_ACTION"
  | string;

export interface PaletteItemData {
  type: NodeKind;
  label: string;
  description?: string;
  icon?: ReactNode;
  category?: string;
  disabled?: boolean;
}

export interface NodePaletteProps {
  items?: PaletteItemData[];
  onAddNode?: (type: NodeKind) => void;
  className?: string;
}

export const DRAG_TYPE = "application/x-node-type";

/**
 * NodePalette component backwards-compatible wrapper around WeaverTaskPanel.
 */
export function NodePalette({ items, onAddNode, className }: NodePaletteProps) {
  const mappedItems = useMemo<TaskRegistryItem[] | undefined>(() => {
    if (!items || items.length === 0) return undefined;
    return items.map((item) => ({
      type: item.type,
      name: item.label,
      shortName: item.label,
      icon: item.icon,
      category: item.category || "QUICK ADD",
      description: item.description || "",
      disabled: item.disabled,
    }));
  }, [items]);

  return (
    <WeaverTaskPanel
      items={mappedItems}
      onAddNode={onAddNode}
      className={className}
    />
  );
}
