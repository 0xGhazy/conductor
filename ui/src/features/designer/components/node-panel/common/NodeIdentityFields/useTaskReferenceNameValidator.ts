import { useCallback } from "react";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import {
  isEndNode,
  isStartNode,
} from "@/features/designer/utils/designerGraphUtils";
import { SCOPE_NODE_TYPE } from "@/features/designer/services/scopeGraph";
import {
  TASK_REFERENCE_NAME_ERROR_MESSAGE,
  isValidTaskReferenceName,
} from "@/utils/validation";

/** Config keys different task types use to hold their task reference name. */
const REFERENCE_KEYS = ["taskReferenceName", "referenceName", "reference", "name"] as const;

export interface ReferenceNameValidation {
  valid: boolean;
  message?: string;
}

/**
 * Returns a validator for a node's Task Reference Name: required, valid pattern,
 * and unique (case-insensitive) across every other task node in the workflow.
 */
export function useTaskReferenceNameValidator(nodeId: string | undefined) {
  const nodes = useDesignerStore((state) => state.nodes);

  return useCallback(
    async (candidate: string): Promise<ReferenceNameValidation> => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return { valid: false, message: "Task reference name is required." };
      }
      if (!isValidTaskReferenceName(trimmed)) {
        return { valid: false, message: TASK_REFERENCE_NAME_ERROR_MESSAGE };
      }

      const normalized = trimmed.toLowerCase();
      const duplicate = nodes.some((other) => {
        if (other.id === nodeId || other.type === SCOPE_NODE_TYPE || isStartNode(other) || isEndNode(other)) {
          return false;
        }
        const config = (other.data?.config ?? {}) as Record<string, unknown>;
        return REFERENCE_KEYS.some(
          (key) => typeof config[key] === "string" && String(config[key]).trim().toLowerCase() === normalized
        );
      });

      if (duplicate) {
        return {
          valid: false,
          message: `"${trimmed}" is already used as a task reference name in this workflow.`,
        };
      }
      return { valid: true };
    },
    [nodes, nodeId]
  );
}
