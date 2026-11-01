import type { ReactNode, ComponentType } from "react";
import type { Node } from "@xyflow/react";

export type WeaverNodePanelTabId =
  | "configuration"
  | "json"
  | "result"
  | "logs"
  | string;

export interface WeaverNodePanelContext<TNode = Node> {
  node: TNode;
  readOnly: boolean;
  result?: any;
  logs?: any[];
  updateConfig: (patch: Record<string, any>) => void;
}

export type WeaverNodePanelTabRenderer<TNode = Node> =
  | "configuration"
  | "json"
  | "result"
  | "logs"
  | ComponentType<WeaverNodePanelContext<TNode>>;

export interface WeaverNodePanelTabDefinition<TNode = Node> {
  id: WeaverNodePanelTabId;
  label: ReactNode;
  icon?: ReactNode;
  render: WeaverNodePanelTabRenderer<TNode>;
  disabled?: boolean | ((context: WeaverNodePanelContext<TNode>) => boolean);
}

export interface WeaverNodeConfigProps<TNode = Node> {
  node: TNode;
  value: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  readOnly?: boolean;
  disabled?: boolean;
}

export interface WeaverNodeDefinition<TNode = Node> {
  type: string;
  label: ReactNode;
  icon?: ReactNode;
  description?: string;
  defaultTab?: WeaverNodePanelTabId;
  tabs: WeaverNodePanelTabDefinition<TNode>[];
  ConfigurationComponent?: ComponentType<WeaverNodeConfigProps<TNode>>;
  serializeForJson?: (
    node: TNode,
    context?: WeaverNodePanelContext<TNode> & { edges?: any[] }
  ) => unknown;
  validate?: (
    node: TNode,
    context?: any
  ) => import("@/features/designer/validation/types").WorkflowValidationIssue[];
}

