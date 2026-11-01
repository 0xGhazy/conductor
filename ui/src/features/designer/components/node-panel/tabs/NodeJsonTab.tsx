import React, { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import type { WeaverNodePanelContext } from "../nodeDefinition.types";

export interface NodeJsonTabProps {
  node?: Node | null;
  context?: WeaverNodePanelContext;
  customSerializer?: (
    node: Node,
    context?: WeaverNodePanelContext & { edges?: Edge[] }
  ) => unknown;
}

export const NodeJsonTab: React.FC<NodeJsonTabProps> = ({
  node,
  context,
  customSerializer,
}) => {
  const storeNodes = useDesignerStore((state) => state.nodes);
  const storeEdges = useDesignerStore((state) => state.edges);

  const targetNodeId = node?.id || context?.node?.id;
  const liveNode =
    (targetNodeId ? storeNodes.find((n) => n.id === targetNodeId) : null) ||
    node ||
    context?.node;

  const jsonString = useMemo(() => {
    if (!liveNode) return "{}";
    try {
      if (customSerializer) {
        return JSON.stringify(
          customSerializer(liveNode, {
            ...(context || {
              node: liveNode,
              readOnly: true,
              updateConfig: () => {},
            }),
            node: liveNode,
            edges: storeEdges,
          }),
          null,
          2
        );
      }
      // Clean normalized Weaver representation without transient ReactFlow internal layout flags
      const cleaned = {
        id: liveNode.id,
        type: liveNode.type,
        name: liveNode.data?.name || liveNode.data?.kind || liveNode.type,
        config: liveNode.data?.config || {},
        position: liveNode.position,
        ...(liveNode.parentId ? { parentId: liveNode.parentId } : {}),
      };
      return JSON.stringify(cleaned, null, 2);
    } catch (e: any) {
      return `// Error serializing node JSON: ${e?.message || "Unknown error"}`;
    }
  }, [liveNode, customSerializer, context, storeEdges]);

  if (!liveNode) {
    return (
      <div style={{ padding: "16px", color: "var(--color-fg-muted, #667085)", fontSize: 13 }}>
        No node selected for JSON view.
      </div>
    );
  }

  return (
    <div
      key={liveNode.id}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "340px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <WeaverCodeEditor
        key={liveNode.id}
        modelKey={`node-json-${liveNode.id}`}
        language="json"
        value={jsonString}
        readOnly={true}
        height="100%"
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          folding: true,
          wordWrap: "on",
          fontSize: 12,
        }}
      />
    </div>
  );
};
