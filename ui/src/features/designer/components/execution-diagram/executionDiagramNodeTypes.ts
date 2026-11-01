/** React Flow node types of the read-only execution diagram. Kept dependency-free on purpose. */
export const EXECUTION_NODE_TYPES = {
  start: "executionStart",
  end: "executionEnd",
  task: "executionTask",
} as const;
