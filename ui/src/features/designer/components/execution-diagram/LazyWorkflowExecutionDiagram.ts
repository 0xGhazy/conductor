import { lazy } from "react";

/**
 * Code-split execution diagram for pages outside the designer (e.g. workflow monitoring).
 * Render it inside a `<Suspense>`; it loads React Flow + the diagram on first use.
 */
export const LazyWorkflowExecutionDiagram = lazy(() =>
  import("./WorkflowExecutionDiagram").then((module) => ({
    default: module.WorkflowExecutionDiagram,
  }))
);
