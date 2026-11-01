import { useState, useMemo, useCallback, type MouseEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWeaverNotification } from "@/components/common/notifications";
import { isValidJavaVariableName } from "@/utils/validation";
import {
  type BaseActionConfig,
  type WeaverActionNodeData,
  getActionConfigReferenceName,
  mergeActionNodeData,
} from "@/features/designer/types/nodeData";

export interface UseActionNodeModalOptions<
  TConfig extends BaseActionConfig = BaseActionConfig,
  TData extends WeaverActionNodeData<TConfig> = WeaverActionNodeData<TConfig>
> {
  nodeId: string;
  data?: TData | null;
  fallbackNodeName?: string;
  generateDefaultReferenceName?: () => string;
  buildInitialDraft?: (data?: TData | null) => TData;
  validateDraft?: (draftData: TData) => Record<string, string> | null | undefined;
  transformBeforeSave?: (draftData: TData) => TData;
  serializeForJson?: (data: TData, nodeId: string, position?: any) => unknown;
  extractJsonUpdate?: (parsedJson: any) => Partial<TData>;
  onSaveSuccess?: (savedData: TData) => void;
}

export function useActionNodeModal<
  TConfig extends BaseActionConfig = BaseActionConfig,
  TData extends WeaverActionNodeData<TConfig> = WeaverActionNodeData<TConfig>
>({
  nodeId,
  data,
  fallbackNodeName = "Action",
  generateDefaultReferenceName,
  buildInitialDraft,
  validateDraft,
  transformBeforeSave,
  serializeForJson,
  extractJsonUpdate,
  onSaveSuccess,
}: UseActionNodeModalOptions<TConfig, TData>) {
  const { setNodes, getNode } = useReactFlow();
  const { error: showError } = useWeaverNotification();
  const [open, setOpen] = useState(false);
  const [draftData, setDraftData] = useState<TData | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const referenceName = useMemo(() => {
    const active = draftData ?? data;
    return getActionConfigReferenceName(active?.config);
  }, [draftData, data]);

  const handleOpen = useCallback(
    (e?: MouseEvent) => {
      if (e) e.stopPropagation();

      if (buildInitialDraft) {
        setDraftData(buildInitialDraft(data));
      } else {
        const existingRef = getActionConfigReferenceName(data?.config);
        const defaultRef =
          existingRef || (generateDefaultReferenceName ? generateDefaultReferenceName() : "");
        const cloned: TData = {
          ...(data ?? ({} as TData)),
          name: data?.name || fallbackNodeName,
          config: {
            ...(data?.config ?? ({} as TConfig)),
            ...(defaultRef
              ? {
                  name: defaultRef,
                  referenceName: defaultRef,
                  reference: defaultRef,
                }
              : {}),
          },
        };
        setDraftData(cloned);
      }

      setValidationErrors({});
      setOpen(true);
    },
    [data, buildInitialDraft, fallbackNodeName, generateDefaultReferenceName]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    setDraftData(null);
    setValidationErrors({});
  }, []);

  const handleConfigChange = useCallback(
    (patch: Partial<TData>) => {
      setValidationErrors((prev) => {
        if (!prev.referenceName) return prev;
        const nextCfg = patch.config as BaseActionConfig | undefined;
        const nextRef = String(nextCfg?.name ?? nextCfg?.referenceName ?? "").trim();
        if (nextRef && isValidJavaVariableName(nextRef)) {
          const nextErrors = { ...prev };
          delete nextErrors.referenceName;
          return nextErrors;
        }
        return prev;
      });

      setDraftData((prev) => mergeActionNodeData(prev ?? data, patch));
    },
    [data]
  );

  const handleSave = useCallback((): boolean => {
    const sourceData = draftData ?? data;
    if (!sourceData) return false;

    const refName = getActionConfigReferenceName(sourceData.config);
    const errors: Record<string, string> = {};

    if (!refName) {
      errors.referenceName = "Reference Name is required.";
    } else if (!isValidJavaVariableName(refName)) {
      errors.referenceName = "Reference Name must be a valid Java variable name.";
    }

    if (validateDraft) {
      const customErrors = validateDraft(sourceData);
      if (customErrors) {
        Object.assign(errors, customErrors);
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      showError("Please fix validation errors before saving.");
      return false;
    }

    setValidationErrors({});
    const dataToSave = transformBeforeSave ? transformBeforeSave(sourceData) : sourceData;

    setNodes((nodes) =>
      nodes.map((node) => (node.id === nodeId ? { ...node, data: dataToSave } : node))
    );

    if (onSaveSuccess) {
      onSaveSuccess(dataToSave);
    }

    handleClose();
    return true;
  }, [draftData, data, nodeId, validateDraft, transformBeforeSave, showError, setNodes, onSaveSuccess, handleClose]);

  const handleJsonChange = useCallback(
    (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== "object") return;

        if (extractJsonUpdate) {
          const patch = extractJsonUpdate(parsed);
          handleConfigChange(patch);
          return;
        }

        const nextRef = parsed.taskReferenceName || parsed.referenceName || referenceName;
        const nextName = parsed.name || (draftData ?? data)?.name || fallbackNodeName;

        handleConfigChange({
          name: nextName,
          config: {
            ...((draftData ?? data)?.config || ({} as TConfig)),
            name: nextRef,
            referenceName: nextRef,
            reference: nextRef,
          },
        } as Partial<TData>);
      } catch {
        // ignore invalid json during live typing
      }
    },
    [extractJsonUpdate, referenceName, draftData, data, fallbackNodeName, handleConfigChange]
  );

  // Serialized only while the modal is open: every canvas node owns one of these hooks.
  const jsonRepresentation = useMemo(() => {
    if (!serializeForJson || !open) return null;
    const currentNode = getNode(nodeId);
    return serializeForJson(draftData ?? (data as TData), nodeId, currentNode?.position);
  }, [open, serializeForJson, draftData, data, nodeId, getNode]);

  return {
    open,
    setOpen,
    draftData,
    setDraftData,
    validationErrors,
    setValidationErrors,
    referenceName,
    handleOpen,
    handleClose,
    handleConfigChange,
    handleSave,
    handleJsonChange,
    jsonRepresentation,
  };
}
