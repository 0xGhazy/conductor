import type { Node } from "@xyflow/react";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";

/**
 * Execution mode for the invoked workflow:
 * - ASYNC: Asynchronized (fire-and-forget or non-blocking async execution)
 * - SYNC: Synchronized (wait for workflow execution to complete)
 */
export type WorkflowExecutionMode = "ASYNC" | "SYNC";

/**
 * Typed configuration stored in node.data.config for a Workflow node.
 */
export interface WorkflowNodeConfigValue {
  /**
   * The canonical workflow name to invoke.
   */
  workflowName?: string | null;

  /**
   * Target version of the workflow:
   * - null or undefined represents "Latest"
   * - number (e.g. 1, 2, 3) represents an explicit pinned version
   */
  version?: number | null;

  /**
   * Input payload passed to the invoked workflow.
   * Represented canonically as an object Map<string, any>.
   */
  inputs?: Record<string, any>;

  /**
   * Optional correlation ID for the invoked workflow execution.
   */
  correlationId?: string;

  /**
   * Invocation execution mode (ASYNC or SYNC).
   * Defaults to ASYNC ("Asynchronized").
   */
  mode?: WorkflowExecutionMode;

  /**
   * Standard task/node reference name.
   */
  name?: string;
  taskReferenceName?: string;
  nodeName?: string;

  /**
   * Internal subWorkflowParam object for Conductor compatibility.
   */
  subWorkflowParam?: {
    name: string;
    version?: number | null;
  };
}

/**
 * Summary of a workflow loaded from the backend catalog.
 */
export interface WorkflowSummaryItem {
  id?: string;
  name: string;
  version: number;
  input?: Record<string, any>;
  description?: string;
}

/**
 * Props for the WorkflowNodeConfig component.
 */
export type WorkflowNodeConfigComponentProps = WeaverNodeConfigProps<
  Node<Record<string, any>>
>;
