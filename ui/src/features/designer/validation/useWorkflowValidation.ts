import { useEffect, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useDesignerStore, type DesignerState } from "@/features/designer/store/useDesignerStore";
import { validateWorkflow } from "./workflowValidator";
import type { WorkflowValidationResult } from "./types";

/** Delay before re-validating after a structural edit (typing in configs, adding nodes...). */
export const VALIDATION_DEBOUNCE_MS = 200;

interface ValidationInputs {
  nodes: Node[];
  edges: Edge[];
  workflowName: string;
  workflowVersion: string;
  workflowVariables: DesignerState["workflowVariables"];
}

const selectInputs = (state: DesignerState): ValidationInputs => ({
  nodes: state.nodes,
  edges: state.edges,
  workflowName: state.workflowName,
  workflowVersion: state.workflowVersion,
  workflowVariables: state.workflowVariables,
});

/**
 * Position-agnostic node comparison: drag/measure/select changes create new node objects but
 * keep `data`, so they never invalidate the cached validation result.
 */
const sameNodes = (a: Node[], b: Node[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x.id !== y.id || x.type !== y.type || x.data !== y.data || x.parentId !== y.parentId) {
      return false;
    }
  }
  return true;
};

const sameEdges = (a: Edge[], b: Edge[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (
      x.id !== y.id ||
      x.source !== y.source ||
      x.target !== y.target ||
      x.sourceHandle !== y.sourceHandle ||
      x.targetHandle !== y.targetHandle ||
      x.type !== y.type ||
      x.data !== y.data
    ) {
      return false;
    }
  }
  return true;
};

const sameInputs = (a: ValidationInputs, b: ValidationInputs) =>
  a.workflowName === b.workflowName &&
  a.workflowVersion === b.workflowVersion &&
  a.workflowVariables === b.workflowVariables &&
  sameNodes(a.nodes, b.nodes) &&
  sameEdges(a.edges, b.edges);

// Shared by every consumer (header indicator + validation panel) so the graph is validated
// once per structural change instead of once per consumer per change.
let cache: { inputs: ValidationInputs; result: WorkflowValidationResult } | null = null;

const peekValidation = (inputs: ValidationInputs) =>
  cache && sameInputs(cache.inputs, inputs) ? cache.result : null;

const getValidation = (inputs: ValidationInputs): WorkflowValidationResult => {
  const cached = peekValidation(inputs);
  if (cached) {
    // Keep the newest references so later comparisons short-circuit on identity.
    cache = { inputs, result: cached };
    return cached;
  }
  const result = validateWorkflow(inputs);
  cache = { inputs, result };
  return result;
};

/**
 * Workflow validation for the current designer graph. Computed synchronously on mount, then
 * re-computed (debounced) only when the graph structure or workflow metadata changes; moving,
 * measuring or selecting nodes does not trigger validation nor re-render the caller.
 */
export function useWorkflowValidation(): WorkflowValidationResult {
  const [result, setResult] = useState<WorkflowValidationResult>(() =>
    getValidation(selectInputs(useDesignerStore.getState()))
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      const inputs = selectInputs(useDesignerStore.getState());
      const cached = peekValidation(inputs);
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (cached) {
        setResult(cached);
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        setResult(getValidation(selectInputs(useDesignerStore.getState())));
      }, VALIDATION_DEBOUNCE_MS);
    };

    // The store may have changed between render and this effect.
    check();

    const unsubscribe = useDesignerStore.subscribe((state, prev) => {
      if (
        state.nodes === prev.nodes &&
        state.edges === prev.edges &&
        state.workflowName === prev.workflowName &&
        state.workflowVersion === prev.workflowVersion &&
        state.workflowVariables === prev.workflowVariables
      ) {
        return;
      }
      check();
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return result;
}
