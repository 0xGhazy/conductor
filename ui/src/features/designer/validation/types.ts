export type ValidationSeverity = "error" | "warning" | "info";

export interface WorkflowValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  nodeId?: string;
  fieldPath?: string;
  description?: string;
  edgeId?: string;
}

export interface WorkflowValidationSummary {
  errors: number;
  warnings: number;
  info: number;
  total: number;
  isValid: boolean;
}

export interface WorkflowValidationResult {
  issues: WorkflowValidationIssue[];
  summary: WorkflowValidationSummary;
}

export interface ValidationContext {
  nodes: any[];
  edges: any[];
  workflowName?: string;
  workflowVersion?: string | number;
  workflowVariables?: Record<string, any>;
  nodeMap: Map<string, any>;
  outgoingEdgesMap: Map<string, any[]>;
  incomingEdgesMap: Map<string, any[]>;
  taskRefMap: Map<string, string[]>;
}
