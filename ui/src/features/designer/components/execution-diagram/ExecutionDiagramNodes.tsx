import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { WeaverTaskNode } from "@/features/designer/nodes/WeaverTaskNode/WeaverTaskNode";
import { getActionNodeDisplayMeta } from "@/features/designer/components/actions/actionNodeMetadata";
import type { LayoutDirection } from "@/features/designer/utils/autoLayout";
import "@/features/designer/components/actions/start/StartNode.css";
import "@/features/designer/components/actions/end/EndNode.css";
import type { ExecutionDiagramNode } from "./WorkflowExecutionDiagram.types";
import styles from "./WorkflowExecutionDiagram.module.css";

const HIDDEN_HANDLE_STYLE = { opacity: 0, pointerEvents: "none" as const, width: 1, height: 1 };

/** Invisible handles at the ids the node's edges use, spread so branch edges fan out like the designer. */
function ReadOnlyHandles({
  sourceHandleIds,
  targetHandleIds,
  direction = "TB",
}: {
  sourceHandleIds: Array<string | null>;
  targetHandleIds: Array<string | null>;
  direction?: LayoutDirection;
}) {
  const isLR = direction === "LR";
  const targetPos = isLR ? Position.Left : Position.Top;
  const sourcePos = isLR ? Position.Right : Position.Bottom;

  return (
    <>
      {targetHandleIds.map((handleId) => (
        <Handle
          key={`target-${handleId ?? "default"}`}
          type="target"
          id={handleId ?? undefined}
          position={targetPos}
          isConnectable={false}
          style={HIDDEN_HANDLE_STYLE}
        />
      ))}
      {sourceHandleIds.map((handleId, index) => {
        const offsetPercent = ((index + 1) / (sourceHandleIds.length + 1)) * 100;
        const style = isLR
          ? { ...HIDDEN_HANDLE_STYLE, top: `${offsetPercent}%` }
          : { ...HIDDEN_HANDLE_STYLE, left: `${offsetPercent}%` };

        return (
          <Handle
            key={`source-${handleId ?? "default"}`}
            type="source"
            id={handleId ?? undefined}
            position={sourcePos}
            isConnectable={false}
            style={style}
          />
        );
      })}
    </>
  );
}

export const ExecutionTaskNode = memo(({ id, data }: NodeProps<ExecutionDiagramNode>) => {
  const meta = getActionNodeDisplayMeta(data.nodeType, data);
  const title = meta.renderTitle ? meta.renderTitle(data) : data.name || meta.label;
  const subtitle = meta.renderSubtitle ? meta.renderSubtitle(data) : undefined;
  const className = typeof meta.className === "function" ? meta.className(data) : meta.className || "";
  const isLR = data.direction === "LR";
  const style = typeof meta.style === "function" ? meta.style({ data, isLR }) : meta.style;
  const state = data.executionState;

  return (
    <WeaverTaskNode
      id={id}
      readOnly
      selected={data.selected}
      title={title}
      taskReferenceName={data.taskReferenceName}
      subtitle={subtitle}
      icon={meta.icon}
      color={meta.color}
      className={className}
      style={style}
      wrapperClassName={state ? styles.executedNode : styles.notExecutedNode}
      status={state?.status}
      durationMs={state?.durationMs}
      errorMessage={state?.errorMessage}
      hideTargetHandle
      customHandles={
        <ReadOnlyHandles
          sourceHandleIds={data.sourceHandleIds}
          targetHandleIds={data.targetHandleIds}
          direction={data.direction}
        />
      }
    />
  );
});
ExecutionTaskNode.displayName = "ExecutionTaskNode";

export const ExecutionStartNode = memo(({ data }: NodeProps<ExecutionDiagramNode>) => (
  <div className="start-node-wrapper" aria-label="Start Node" title="Start">
    <div className="start-node-circle">
      <span className="start-node-title">Start</span>
    </div>
    <ReadOnlyHandles
      sourceHandleIds={data.sourceHandleIds}
      targetHandleIds={[]}
      direction={data.direction}
    />
  </div>
));
ExecutionStartNode.displayName = "ExecutionStartNode";

export const ExecutionEndNode = memo(({ data }: NodeProps<ExecutionDiagramNode>) => (
  <div className="end-node-wrapper" aria-label="End Node" title="End">
    <ReadOnlyHandles
      sourceHandleIds={[]}
      targetHandleIds={data.targetHandleIds}
      direction={data.direction}
    />
    <div className="end-node-circle">
      <span className="end-node-title">End</span>
    </div>
  </div>
));
ExecutionEndNode.displayName = "ExecutionEndNode";

