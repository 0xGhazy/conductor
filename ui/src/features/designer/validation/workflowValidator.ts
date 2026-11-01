import type {
  WorkflowValidationIssue,
  WorkflowValidationResult,
  WorkflowValidationSummary,
  ValidationContext,
} from "./types";
import { validateStructure } from "./rules/structureRules";
import { validateReferences } from "./rules/referenceRules";
import { validateNodeConfigurations } from "./rules/nodeRules";
import { isStartNode, isEndNode } from "@/features/designer/utils/designerGraphUtils";

export interface ValidateWorkflowOptions {
  nodes?: any[];
  edges?: any[];
  workflowName?: string;
  workflowVersion?: string | number;
  workflowVariables?: Record<string, any>;
}

/**
 * Builds the reusable validation context index from raw graph elements.
 */
export function buildValidationContext({
  nodes = [],
  edges = [],
  workflowName = "",
  workflowVersion = "1",
  workflowVariables = {},
}: ValidateWorkflowOptions): ValidationContext {
  const nodeMap = new Map<string, any>();
  const outgoingEdgesMap = new Map<string, any[]>();
  const incomingEdgesMap = new Map<string, any[]>();
  const taskRefMap = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node?.id) continue;
    nodeMap.set(node.id, node);

    if (!isStartNode(node) && !isEndNode(node)) {
      const config = node.data?.config || {};
      const rawRef =
        config.referenceName ??
        config.taskReferenceName ??
        config.name ??
        node.data?.name ??
        "";
      const refName = String(rawRef || "").trim();
      if (refName) {
        if (!taskRefMap.has(refName)) {
          taskRefMap.set(refName, []);
        }
        taskRefMap.get(refName)!.push(node.id);
      }
    }
  }

  for (const edge of edges) {
    if (!edge?.source || !edge?.target) continue;

    if (!outgoingEdgesMap.has(edge.source)) {
      outgoingEdgesMap.set(edge.source, []);
    }
    outgoingEdgesMap.get(edge.source)!.push(edge);

    if (!incomingEdgesMap.has(edge.target)) {
      incomingEdgesMap.set(edge.target, []);
    }
    incomingEdgesMap.get(edge.target)!.push(edge);
  }

  return {
    nodes,
    edges,
    workflowName,
    workflowVersion,
    workflowVariables,
    nodeMap,
    outgoingEdgesMap,
    incomingEdgesMap,
    taskRefMap,
  };
}

/**
 * Executes full workflow validation across structural, configuration, and reference rules.
 */
export function validateWorkflow(options: ValidateWorkflowOptions): WorkflowValidationResult {
  const context = buildValidationContext(options);

  const issues: WorkflowValidationIssue[] = [
    ...validateStructure(context),
    ...validateReferences(context),
    ...validateNodeConfigurations(context),
  ];

  let errors = 0;
  let warnings = 0;
  let info = 0;

  for (const issue of issues) {
    if (issue.severity === "error") errors++;
    else if (issue.severity === "warning") warnings++;
    else if (issue.severity === "info") info++;
  }

  const summary: WorkflowValidationSummary = {
    errors,
    warnings,
    info,
    total: issues.length,
    isValid: errors === 0,
  };

  return {
    issues,
    summary,
  };
}
