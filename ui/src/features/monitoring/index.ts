import { lazy } from "react";

export * from "./components/ExecutionTimeline";
// ExecutionTaskDetails embeds Monaco; export it lazily so importing this barrel (e.g. from the
// executions list page) doesn't pull the editor into that chunk. Render it inside <Suspense>.
export const ExecutionTaskDetails = lazy(() =>
  import("./components/ExecutionTaskDetails/ExecutionTaskDetails").then((m) => ({
    default: m.ExecutionTaskDetails,
  }))
);
export type { ExecutionTaskDetailsProps } from "./components/ExecutionTaskDetails";
export * from "./components/ExecutionLogsConsole";
export * from "./hooks/useTaskExecutionLogs";
export * from "./hooks/useWorkflowExecutionLogs";
export * from "./services/executionsApi";
export * from "./services/executionsService";
export * from "./services/executionTimeline";
export * from "./types/executionTypes";

