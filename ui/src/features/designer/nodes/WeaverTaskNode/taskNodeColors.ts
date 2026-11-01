/**
 * Node color per task type, for `WeaverTaskNode`'s `color` prop.
 * Values are theme tokens (see `--node-color-*` in styles/variables.css), so each
 * type keeps its own palette hue in both light and dark themes.
 */
export const TASK_NODE_COLORS = {
  http: "var(--node-color-http)",
  subworkflow: "var(--node-color-subworkflow)",
  database: "var(--node-color-database)",
  redis: "var(--node-color-redis)",
  script: "var(--node-color-script)",
  ruleEngine: "var(--node-color-rule-engine)",
  validation: "var(--node-color-validation)",
  switch: "var(--node-color-switch)",
  forEach: "var(--node-color-foreach)",
  wait: "var(--node-color-wait)",
  terminate: "var(--node-color-terminate)",
  respond: "var(--node-color-respond)",
} as const;

export type TaskNodeColorKey = keyof typeof TASK_NODE_COLORS;
