import type { WorkflowValidationIssue, ValidationContext } from "../types";
import { isStartNode, isEndNode } from "@/features/designer/utils/designerGraphUtils";
import { isValidTaskReferenceName } from "@/utils/validation";
import { getNodeDefinition } from "@/features/designer/components/node-panel/nodeDefinitionRegistry";

/**
 * Validates Category B: Node Configuration & Category D: Node-Specific Validation rules.
 */
export function validateNodeConfigurations(context: ValidationContext): WorkflowValidationIssue[] {
  const { nodes } = context;
  const issues: WorkflowValidationIssue[] = [];

  for (const node of nodes) {
    if (isStartNode(node) || isEndNode(node)) continue;

    const nodeId = node.id;
    const nodeName = node.data?.name || node.data?.config?.name || nodeId;
    const config = node.data?.config || {};
    const nodeType = String(node.type || node.data?.kind || "").toUpperCase();

    // 1. Task Reference Name check
    const rawRefName =
      config.referenceName ??
      config.taskReferenceName ??
      config.name ??
      node.data?.name ??
      "";
    const refName = String(rawRefName || "").trim();

    if (!refName) {
      issues.push({
        id: `node-missing-ref-${nodeId}`,
        severity: "error",
        code: "NODE_MISSING_REF_NAME",
        message: `Node "${nodeName}" is missing a reference name.`,
        nodeId,
        fieldPath: "referenceName",
        description: "Every task node must have a unique reference name for identification.",
      });
    } else if (!isValidTaskReferenceName(refName)) {
      issues.push({
        id: `node-invalid-ref-${nodeId}`,
        severity: "error",
        code: "NODE_INVALID_REF_NAME",
        message: `Task reference name "${refName}" is invalid. Must start with a letter and contain only letters, numbers, and underscores.`,
        nodeId,
        fieldPath: "referenceName",
        description: "Reference names cannot contain spaces, hyphens, or special characters.",
      });
    }

    // 2. Extensible Node Definition Validation
    const definition = getNodeDefinition(node);
    if (definition && typeof definition.validate === "function") {
      try {
        const customIssues = definition.validate(node, context) || [];
        issues.push(...customIssues);
      } catch (err) {
        console.error(`Error executing custom validator for node type ${node.type}:`, err);
      }
    }

    // 3. Built-in Node Specific Validations by Type
    switch (nodeType) {

      case "DATABASE_ACTION":
      case "DATABASEACTION": {
        const datasource = config.datasourceId || config.dataSourceId;
        if (!datasource) {
          issues.push({
            id: `db-missing-datasource-${nodeId}`,
            severity: "error",
            code: "DB_DATASOURCE_REQUIRED",
            message: `Database node "${nodeName}" requires a selected datasource.`,
            nodeId,
            fieldPath: "datasourceId",
            description: "Please select a valid database connection/datasource.",
          });
        }
        const query = config.query || config.queryId || config.queryName;
        if (!query || !String(query).trim()) {
          issues.push({
            id: `db-missing-query-${nodeId}`,
            severity: "error",
            code: "DB_QUERY_REQUIRED",
            message: `Database node "${nodeName}" requires a query or query ID.`,
            nodeId,
            fieldPath: "query",
            description: "Specify a SQL query string or configured query identifier.",
          });
        }
        break;
      }

      case "SCRIPT_ACTION":
      case "SCRIPTACTION":
      case "JEXL_ACTION": {
        const script = config.script ?? config.expression ?? "";
        if (!String(script).trim()) {
          issues.push({
            id: `script-missing-code-${nodeId}`,
            severity: "error",
            code: "SCRIPT_EMPTY",
            message: `Script node "${nodeName}" has an empty expression.`,
            nodeId,
            fieldPath: "expression",
            description: "Script or JEXL expression cannot be empty.",
          });
        }
        break;
      }

      case "SWITCH_ACTION":
      case "SWITCHACTION": {
        const expr = config.expression ?? "";
        if (!String(expr).trim()) {
          issues.push({
            id: `switch-missing-expr-${nodeId}`,
            severity: "error",
            code: "SWITCH_EXPRESSION_REQUIRED",
            message: `Switch node "${nodeName}" requires an evaluation expression.`,
            nodeId,
            fieldPath: "expression",
            description: "Switch nodes evaluate an expression or value parameter to route execution.",
          });
        }
        const cases = config.cases || [];
        if (!Array.isArray(cases) || cases.length === 0) {
          issues.push({
            id: `switch-no-cases-${nodeId}`,
            severity: "warning",
            code: "SWITCH_NO_CASES",
            message: `Switch node "${nodeName}" has no decision cases configured.`,
            nodeId,
            fieldPath: "cases",
            description: "Consider adding at least one decision case branch.",
          });
        }
        break;
      }

      case "WAIT_ACTION":
      case "WAITACTION":
      case "DELAY_ACTION": {
        const mode = config.mode || "DURATION";
        if (mode === "DURATION") {
          const duration = config.duration ?? "";
          if (!String(duration).trim()) {
            issues.push({
              id: `wait-missing-duration-${nodeId}`,
              severity: "error",
              code: "WAIT_DURATION_REQUIRED",
              message: `Wait node "${nodeName}" requires a duration (e.g. '10 seconds').`,
              nodeId,
              fieldPath: "duration",
              description: "Specify a duration expression or timeframe.",
            });
          }
        } else if (mode === "UNTIL") {
          const until = config.until ?? "";
          if (!String(until).trim()) {
            issues.push({
              id: `wait-missing-until-${nodeId}`,
              severity: "error",
              code: "WAIT_UNTIL_REQUIRED",
              message: `Wait node "${nodeName}" requires an 'until' date or timestamp.`,
              nodeId,
              fieldPath: "until",
              description: "Specify an ISO date string or Conductor expression.",
            });
          }
        }
        break;
      }

      case "FOREACH_ACTION":
      case "FOREACH": {
        const collection = config.collectionExpression ?? config.collection ?? "";
        if (!String(collection).trim()) {
          issues.push({
            id: `foreach-missing-collection-${nodeId}`,
            severity: "error",
            code: "FOREACH_COLLECTION_REQUIRED",
            message: `ForEach node "${nodeName}" requires a collection expression.`,
            nodeId,
            fieldPath: "collectionExpression",
            description: "Specify the collection array expression to iterate over.",
          });
        }
        const itemVar = config.itemVariable ?? "";
        if (!String(itemVar).trim()) {
          issues.push({
            id: `foreach-missing-itemvar-${nodeId}`,
            severity: "error",
            code: "FOREACH_ITEM_VAR_REQUIRED",
            message: `ForEach node "${nodeName}" requires an item variable name.`,
            nodeId,
            fieldPath: "itemVariable",
            description: "Specify the iteration item variable name.",
          });
        }
        break;
      }

      case "TERMINATE":
      case "TERMINATEACTION": {
        const status = config.status || config.terminationStatus;
        if (!status) {
          issues.push({
            id: `terminate-missing-status-${nodeId}`,
            severity: "warning",
            code: "TERMINATE_STATUS_REQUIRED",
            message: `Terminate node "${nodeName}" should specify a termination status.`,
            nodeId,
            fieldPath: "status",
            description: "Select COMPLETED or FAILED as the termination status.",
          });
        }
        break;
      }

      case "RESPOND_ACTION":
      case "RESPONDACTION":
      case "RESPOND": {
        const code = config.messageCode || config.responseCode;
        if (!code || !String(code).trim()) {
          issues.push({
            id: `respond-missing-code-${nodeId}`,
            severity: "warning",
            code: "RESPOND_CODE_REQUIRED",
            message: `Respond node "${nodeName}" has no message code specified.`,
            nodeId,
            fieldPath: "messageCode",
            description: "A message code is recommended to identify the client response.",
          });
        }
        break;
      }
    }
  }

  return issues;
}
