import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { buildScopedSuggestions } from "@/features/designer/utils/contextMap";
import { resolveWorkflowVersionValue } from "@/features/designer/utils/workflowVersion";

export type ScopedSuggestionsState = ReturnType<typeof buildScopedSuggestions>;

export type ScopedParameterOption = ScopedSuggestionsState["suggestions"][number];

const EMPTY_OPTIONS: ScopedParameterOption[] = [];

/**
 * Scoped context map / parameter suggestions for the currently selected node.
 * Only subscribes to the graph and computes while `enabled` (e.g. a config modal or the context
 * map viewer is open), so closed modals add no per-change work to the canvas.
 */
export function useScopedSuggestions(enabled: boolean): ScopedSuggestionsState | null {
  const inputs = useDesignerStore(
    useShallow((state) =>
      enabled
        ? {
            nodes: state.nodes,
            edges: state.edges,
            selectedId: state.selectedId,
            workflowName: state.workflowName,
            workflowVersion: state.workflowVersion,
            workflowVariables: state.workflowVariables,
          }
        : null
    )
  );

  return useMemo(() => {
    if (!inputs) return null;
    return buildScopedSuggestions({
      nodes: inputs.nodes as never[],
      edges: inputs.edges as never[],
      selectedNodeId: inputs.selectedId || "",
      workflowName: inputs.workflowName || "",
      workflowVersion: resolveWorkflowVersionValue(inputs.workflowVersion) as number,
      workflowVariables: inputs.workflowVariables ?? {},
    });
  }, [inputs]);
}

/** Parameter autocompletion options; empty (and free) while `enabled` is false. */
export function useScopedParameterOptions(enabled: boolean): ScopedParameterOption[] {
  const state = useScopedSuggestions(enabled);
  return state?.suggestions ?? EMPTY_OPTIONS;
}
