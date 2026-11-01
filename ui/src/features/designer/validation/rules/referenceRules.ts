import type { WorkflowValidationIssue, ValidationContext } from "../types";
import { isStartNode, isEndNode } from "@/features/designer/utils/designerGraphUtils";

/**
 * Validates Category C: Workflow References rules.
 * Inspects expressions like ${taskRef.output.param} to ensure referenced tasks exist.
 */
export function validateReferences(context: ValidationContext): WorkflowValidationIssue[] {
  const { nodes, taskRefMap } = context;
  const issues: WorkflowValidationIssue[] = [];

  const knownRefNames = new Set<string>();
  for (const refName of taskRefMap.keys()) {
    if (refName) knownRefNames.add(refName);
  }

  // Helper to extract and check string expressions recursively
  const inspectValue = (val: any, nodeId: string, nodeName: string, fieldPath: string) => {
    if (typeof val === "string") {
      // 1. Check for unclosed expression syntax: e.g. "${something" without closing "}"
      const unclosedMatches = val.match(/\$\{[^}]*$/g);
      if (unclosedMatches) {
        issues.push({
          id: `ref-unclosed-${nodeId}-${fieldPath}`,
          severity: "error",
          code: "EXPRESSION_SYNTAX_ERROR",
          message: `Unclosed expression syntax in "${fieldPath}".`,
          nodeId,
          fieldPath,
          description: "Expressions must start with '${' and close with '}'.",
        });
      }

      // 2. Extract valid expression matches: ${ref.property}
      const exprRegex = /\$\{([^}]+)\}/g;
      let match: RegExpExecArray | null;
      while ((match = exprRegex.exec(val)) !== null) {
        const expressionContent = match[1].trim();
        const parts = expressionContent.split(".");
        const rootIdentifier = parts[0]?.trim();

        // Built-in Conductor root scopes
        if (
          rootIdentifier === "workflow" ||
          rootIdentifier === "item" ||
          rootIdentifier === "index" ||
          rootIdentifier === "env" ||
          rootIdentifier === "context"
        ) {
          continue;
        }

        // If it starts with an identifier that looks like a task reference name
        if (rootIdentifier && !knownRefNames.has(rootIdentifier)) {
          issues.push({
            id: `ref-nonexistent-task-${nodeId}-${fieldPath}-${rootIdentifier}`,
            severity: "warning",
            code: "INVALID_TASK_REFERENCE",
            message: `Expression in "${fieldPath}" references nonexistent task "${rootIdentifier}".`,
            nodeId,
            fieldPath,
            description: `The task reference name "${rootIdentifier}" was not found in this workflow graph.`,
          });
        }
      }
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      for (const [k, nestedVal] of Object.entries(val)) {
        if (k.startsWith("_")) continue; // Skip metadata
        const nextPath = fieldPath ? `${fieldPath}.${k}` : k;
        inspectValue(nestedVal, nodeId, nodeName, nextPath);
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        inspectValue(item, nodeId, nodeName, `${fieldPath}[${idx}]`);
      });
    }
  };

  for (const node of nodes) {
    if (isStartNode(node) || isEndNode(node)) continue;
    const nodeName = node.data?.name || node.data?.config?.name || node.id;
    const config = node.data?.config || {};
    inspectValue(config, node.id, nodeName, "");
  }

  return issues;
}
