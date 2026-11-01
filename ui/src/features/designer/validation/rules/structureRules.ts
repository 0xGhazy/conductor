import type { WorkflowValidationIssue, ValidationContext } from "../types";
import {
  isStartNode,
  isEndNode,
  isStartNodeId,
  isEndNodeId,
} from "@/features/designer/utils/designerGraphUtils";

/**
 * Validates Category A: Workflow Structure rules.
 */
export function validateStructure(context: ValidationContext): WorkflowValidationIssue[] {
  const { nodes, edges, workflowName, nodeMap, outgoingEdgesMap, incomingEdgesMap, taskRefMap } = context;
  const issues: WorkflowValidationIssue[] = [];

  // 1. Missing required workflow information
  if (!workflowName || !workflowName.trim()) {
    issues.push({
      id: "wf-structure-missing-name",
      severity: "error",
      code: "WF_NAME_REQUIRED",
      message: "Workflow name is required.",
      fieldPath: "name",
      description: "Every workflow must have a valid non-empty identifier name.",
    });
  }

  // 2. Start node verification
  const startNodes = nodes.filter((node) => isStartNode(node));
  if (startNodes.length === 0) {
    issues.push({
      id: "wf-structure-missing-start",
      severity: "error",
      code: "WF_MISSING_START",
      message: "Workflow must have a Start node.",
      description: "Workflows require a Start node to define the entry execution point.",
    });
  } else if (startNodes.length > 1) {
    issues.push({
      id: "wf-structure-multiple-starts",
      severity: "error",
      code: "WF_MULTIPLE_STARTS",
      message: "Workflow cannot have multiple Start nodes.",
      description: "Only one Start entry node is allowed per workflow.",
    });
  }

  // 3. Node IDs validation & Duplicates
  const seenNodeIds = new Set<string>();
  for (const node of nodes) {
    const rawId = String(node?.id || "").trim();
    if (!rawId) {
      issues.push({
        id: `node-missing-id-${Math.random().toString(36).slice(2, 7)}`,
        severity: "error",
        code: "NODE_ID_REQUIRED",
        message: "A node has an empty or invalid ID.",
        description: "All nodes in the canvas must have a unique identifier string.",
      });
      continue;
    }

    if (seenNodeIds.has(rawId)) {
      issues.push({
        id: `node-duplicate-id-${rawId}`,
        severity: "error",
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node ID "${rawId}" detected.`,
        nodeId: rawId,
        description: "Node identifiers must be strictly unique across the workflow graph.",
      });
    } else {
      seenNodeIds.add(rawId);
    }
  }

  // 4. Duplicate task reference names where uniqueness is required
  for (const [refName, nodeIds] of taskRefMap.entries()) {
    if (nodeIds.length > 1) {
      for (const nodeId of nodeIds) {
        issues.push({
          id: `node-duplicate-ref-${nodeId}`,
          severity: "error",
          code: "DUPLICATE_TASK_REF_NAME",
          message: `Duplicate task reference name "${refName}" found on multiple nodes.`,
          nodeId,
          fieldPath: "referenceName",
          description: "Task reference names must be unique to allow Conductor to address task outputs.",
        });
      }
    }
  }

  // 5. Edge connections validation
  for (const edge of edges) {
    const edgeId = edge.id || `edge-${edge.source}->${edge.target}`;

    // Self loop
    if (edge.source === edge.target) {
      issues.push({
        id: `edge-self-loop-${edgeId}`,
        severity: "error",
        code: "EDGE_SELF_LOOP",
        message: `Self-referencing loop detected on connection "${edgeId}".`,
        edgeId,
        nodeId: edge.source,
        description: "A node cannot connect directly to itself.",
      });
    }

    // Missing source node
    if (!nodeMap.has(edge.source)) {
      issues.push({
        id: `edge-missing-source-${edgeId}`,
        severity: "error",
        code: "EDGE_SOURCE_NOT_FOUND",
        message: `Connection references nonexistent source node "${edge.source}".`,
        edgeId,
        description: "Connection references a source node that no longer exists in the workflow graph.",
      });
    }

    // Missing target node
    if (!nodeMap.has(edge.target)) {
      issues.push({
        id: `edge-missing-target-${edgeId}`,
        severity: "error",
        code: "EDGE_TARGET_NOT_FOUND",
        message: `Connection references nonexistent target node "${edge.target}".`,
        edgeId,
        description: "Connection references a target node that no longer exists in the workflow graph.",
      });
    }
  }

  // 6. Disconnected action nodes (0 incoming AND 0 outgoing edges)
  for (const node of nodes) {
    if (isStartNode(node) || isEndNode(node)) continue;
    const incoming = incomingEdgesMap.get(node.id) || [];
    const outgoing = outgoingEdgesMap.get(node.id) || [];

    if (incoming.length === 0 && outgoing.length === 0) {
      const nodeName = node.data?.name || node.data?.config?.name || node.id;
      issues.push({
        id: `node-disconnected-${node.id}`,
        severity: "error",
        code: "NODE_DISCONNECTED",
        message: `Node "${nodeName}" is completely disconnected.`,
        nodeId: node.id,
        description: "Every task node must be connected into the workflow execution path.",
      });
    }
  }

  // 7. Unreachable nodes from Start
  if (startNodes.length > 0) {
    const startId = startNodes[0].id;
    const reachable = new Set<string>([startId]);
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const outgoing = outgoingEdgesMap.get(current) || [];
      for (const edge of outgoing) {
        if (!reachable.has(edge.target) && nodeMap.has(edge.target)) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    for (const node of nodes) {
      if (isStartNode(node) || isEndNode(node)) continue;
      if (!reachable.has(node.id)) {
        // Only report unreachable if not already reported as disconnected
        const incoming = incomingEdgesMap.get(node.id) || [];
        const outgoing = outgoingEdgesMap.get(node.id) || [];
        if (incoming.length > 0 || outgoing.length > 0) {
          const nodeName = node.data?.name || node.data?.config?.name || node.id;
          issues.push({
            id: `node-unreachable-${node.id}`,
            severity: "warning",
            code: "NODE_UNREACHABLE",
            message: `Node "${nodeName}" cannot be reached from Start.`,
            nodeId: node.id,
            description: "No path exists from the workflow Start node to this task node.",
          });
        }
      }
    }
  }

  // 8. Cycle detection (DFS based)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleNodes = new Set<string>();

  const checkCycle = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = outgoingEdgesMap.get(nodeId) || [];
    for (const edge of outgoing) {
      const targetId = edge.target;
      if (!nodeMap.has(targetId)) continue;
      // Exclude special loop targets if modeled as self-contained
      if (!visited.has(targetId)) {
        if (checkCycle(targetId)) return true;
      } else if (recursionStack.has(targetId)) {
        cycleNodes.add(targetId);
        cycleNodes.add(nodeId);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (checkCycle(node.id)) {
        // Cycle detected
        issues.push({
          id: `cycle-detected-${node.id}`,
          severity: "error",
          code: "WORKFLOW_CYCLE_DETECTED",
          message: `Cycle or loop path detected involving node "${node.data?.name || node.id}".`,
          nodeId: node.id,
          description: "Conductor standard DAG workflows cannot contain unsupported cycles.",
        });
        break; // Report the primary cycle
      }
    }
  }

  return issues;
}
