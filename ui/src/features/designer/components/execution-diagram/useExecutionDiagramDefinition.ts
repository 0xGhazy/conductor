import { useMemo } from "react";

export const resolveExecutionDefinition = (executionResponse: any): any => {
  if (!executionResponse) return null;
  // If executionResponse itself or executionResponse.workflowDefinition is a definition
  if (executionResponse.workflowDefinition && typeof executionResponse.workflowDefinition === "object") {
    return executionResponse.workflowDefinition;
  }
  if (Array.isArray(executionResponse.tasks)) {
    const tasks = executionResponse.tasks.map((t: any) => t.workflowTask || t);
    return {
      ...executionResponse,
      tasks,
    };
  }
  return executionResponse;
};

/**
 * Uses the workflow definition embedded in the execution response itself
 * to render the execution diagram, without making any external network requests.
 */
export const useExecutionDiagramDefinition = (
  _workflowName: string,
  _workflowVersion: number | string | undefined,
  fallbackDefinition: unknown
) => {
  const definition = useMemo(() => {
    return resolveExecutionDefinition(fallbackDefinition);
  }, [fallbackDefinition]);

  return {
    definition,
    loading: false,
    errorMessage: definition ? "" : "No workflow definition available in execution response.",
  };
};

export default useExecutionDiagramDefinition;
