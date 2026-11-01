import { memo, useState, useEffect, useMemo, type MouseEvent } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { WeaverTaskNode, resolveTaskReferenceName } from "@/features/designer/nodes/WeaverTaskNode";
import { ActionConfigModal } from "@/features/designer/nodes/ActionConfigModal";
import { useActionNodeModal } from "@/features/designer/hooks/useActionNodeModal";
import { useScopedParameterOptions } from "@/features/designer/hooks/useScopedSuggestions";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { WorkflowTranslationsModal } from "@/features/translations";
import {
  getActionNodeMeta,
  type ActionNodeMeta,
} from "./actionNodeRegistry";

type ParameterOption = string | { value?: string; label?: string; id?: string };

export interface UniversalActionNodeProps {
  id: string;
  data?: any;
  type?: string;
  /** Explicit suggestions; when omitted they are computed lazily while the config modal is open. */
  parameterOptions?: ParameterOption[];
  /** Explicit workflow identity; when omitted it is read from the designer store when needed. */
  workflowName?: string;
  workflowVersion?: number | string;
}

/**
 * Workflow name/version for config forms and the translations modal. Read from the store only
 * while `enabled`, so renaming the workflow does not re-render every node on the canvas.
 */
function useWorkflowIdentity(
  enabled: boolean,
  workflowName: string | undefined,
  workflowVersion: number | string | undefined
) {
  const storeName = useDesignerStore((state) =>
    enabled && workflowName === undefined ? state.workflowName : ""
  );
  const storeVersion = useDesignerStore((state) =>
    enabled && workflowVersion === undefined ? state.workflowVersion : ""
  );
  return {
    workflowName: workflowName ?? storeName ?? "",
    workflowVersion: workflowVersion ?? (storeVersion || 1),
  };
}

function StandardActionNode({
  id,
  data,
  meta,
  parameterOptions: parameterOptionsProp,
  workflowName: workflowNameProp,
  workflowVersion: workflowVersionProp,
  isLR,
}: Omit<UniversalActionNodeProps, "type"> & { meta: ActionNodeMeta; isLR: boolean }) {
  const setSelectedId = useDesignerStore((state) => state.setSelectedId);
  const setNodePanelCollapsed = useDesignerStore((state) => state.setNodePanelCollapsed);
  const pendingConnectionSource = useDesignerStore((state) => state.pendingConnectionSource);
  const setPendingConnectionSource = useDesignerStore((state) => state.setPendingConnectionSource);
  const setActionsPanelOpen = useDesignerStore((state) => state.setActionsPanelOpen);

  const [hoveredHandleId, setHoveredHandleId] = useState<string | null>(null);
  const [translationsModalOpen, setTranslationsModalOpen] = useState(false);

  const hasConfigModal = Boolean(meta.ConfigForm);

  const modal = useActionNodeModal({
    nodeId: id,
    data,
    fallbackNodeName: meta.label,
    generateDefaultReferenceName: meta.generateDefaultReferenceName,
    buildInitialDraft: meta.buildInitialDraft,
    validateDraft: meta.validateDraft,
    transformBeforeSave: meta.transformBeforeSave,
    serializeForJson: meta.serializeForJson,
    extractJsonUpdate: meta.extractJsonUpdate,
  });

  const lazyParameterOptions = useScopedParameterOptions(
    modal.open && parameterOptionsProp === undefined
  );
  const parameterOptions = parameterOptionsProp ?? lazyParameterOptions;
  const { workflowName, workflowVersion } = useWorkflowIdentity(
    modal.open || translationsModalOpen,
    workflowNameProp,
    workflowVersionProp
  );

  const handleDoubleClick = (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    if (hasConfigModal) {
      modal.handleOpen(e);
    } else {
      setSelectedId(id);
      setNodePanelCollapsed?.(false);
    }
  };

  const activeData = modal.draftData ?? data;
  const nodeTitle = meta.renderTitle ? meta.renderTitle(activeData) : activeData?.name || meta.label;
  const nodeSubtitle = meta.renderSubtitle ? meta.renderSubtitle(activeData) : undefined;
  const icon = data?.icon || meta.icon;
  const color = data?.color || meta.color;
  const className = typeof meta.className === "function" ? meta.className(activeData) : meta.className || "";
  const style = typeof meta.style === "function" ? meta.style({ data: activeData, isLR }) : meta.style;
  const taskRefName = hasConfigModal
    ? modal.referenceName || activeData?.config?.name || activeData?.config?.referenceName || ""
    : resolveTaskReferenceName(activeData?.config, meta.label.toLowerCase());

  const customHandles = meta.renderCustomHandles
    ? meta.renderCustomHandles({
        id,
        data: activeData,
        isLR,
        hoveredHandleId,
        setHoveredHandleId,
        pendingConnectionSource: pendingConnectionSource as string | null,
        setPendingConnectionSource,
        setActionsPanelOpen,
      })
    : undefined;

  const children = meta.renderChildren ? meta.renderChildren(activeData) : null;

  return (
    <>
      <WeaverTaskNode
        id={id}
        title={nodeTitle}
        taskReferenceName={taskRefName}
        subtitle={nodeSubtitle}
        description={activeData?.config?.description || activeData?.description || meta.description || undefined}
        icon={icon}
        color={color}
        className={className}
        style={style}
        targetHandleId={meta.targetHandleId}
        sourceHandleId={meta.sourceHandleId}
        hideSourceHandle={meta.hideSourceHandle || meta.isTerminal}
        customHandles={customHandles}
        onDoubleClick={handleDoubleClick}
      >
        {children}
      </WeaverTaskNode>

      {hasConfigModal && meta.ConfigForm ? (
        <ActionConfigModal
          open={modal.open}
          title={`${meta.label} Configuration`}
          nodeDisplayName={modal.draftData?.name || data?.name || `${meta.label} Node`}
          initialData={data}
          draftData={modal.draftData}
          modalWidth={meta.modalWidth || 950}
          onClose={modal.handleClose}
          onSave={modal.handleSave}
          jsonRepresentation={modal.jsonRepresentation as any}
          jsonReadOnly={!meta.extractJsonUpdate}
          onJsonChange={meta.extractJsonUpdate ? modal.handleJsonChange : undefined}
          parameterOptions={parameterOptions}
          className={`${meta.type.toLowerCase().replace(/_/g, "-")}-config-modal`}
        >
          <meta.ConfigForm
            data={modal.draftData ?? data}
            onChange={modal.handleConfigChange}
            validationErrors={modal.validationErrors}
            parameterOptions={parameterOptions}
            workflowName={workflowName}
            workflowVersion={workflowVersion}
            onOpenTranslationsModal={() => setTranslationsModalOpen(true)}
          />
        </ActionConfigModal>
      ) : null}

      {/* Translations CRUD Modal if triggered from Respond or any translation-aware node */}
      {translationsModalOpen ? (
        <WorkflowTranslationsModal
          open={translationsModalOpen}
          onClose={() => setTranslationsModalOpen(false)}
          workflowName={workflowName}
          workflowVersion={workflowVersion}
        />
      ) : null}
    </>
  );
}

/**
 * Universal Action Node Component.
 * Unifies all action tasks across the Weaver workflow canvas.
 */
function UniversalActionNodeBase({
  id,
  data,
  type,
  parameterOptions,
  workflowName,
  workflowVersion,
}: UniversalActionNodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const layoutDirection = useDesignerStore((state) => state.layoutDirection) ?? "TB";
  const isLR = layoutDirection === "LR";

  const meta: ActionNodeMeta = useMemo(
    () => getActionNodeMeta(type || data?.kind, data),
    [type, data]
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, layoutDirection, updateNodeInternals]);

  // If node definition has a full CustomNodeComponent, delegate directly
  if (meta.CustomNodeComponent) {
    const Component = meta.CustomNodeComponent;
    return (
      <Component
        id={id}
        data={data}
        parameterOptions={parameterOptions}
        workflowName={workflowName}
        workflowVersion={workflowVersion}
      />
    );
  }

  return (
    <StandardActionNode
      id={id}
      data={data}
      meta={meta}
      parameterOptions={parameterOptions}
      workflowName={workflowName}
      workflowVersion={workflowVersion}
      isLR={isLR}
    />
  );
}

export const UniversalActionNode = memo(UniversalActionNodeBase);
UniversalActionNode.displayName = "UniversalActionNode";

export default UniversalActionNode;
