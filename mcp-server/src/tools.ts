import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { SidecarError, sidecarErrorBody } from "./errors.js";
import type { Logger } from "./logger.js";
import { WeaverClient, type WeaverResponse } from "./weaver-client.js";
import { compileSimplifiedWorkflow } from "./workflow/compiler.js";
import {
  CreateWorkflowInputSchema,
  DescribeWorkflowInputSchema,
  ExecuteWorkflowInputSchema,
  ListWorkflowsInputSchema,
} from "./workflow/schemas.js";

const jsonResult = (body: unknown, isError = false): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(body) }],
  structuredContent: body,
  ...(isError ? { isError: true } : {}),
});

const weaverResult = (response: WeaverResponse): CallToolResult =>
  jsonResult(response.body, response.status < 200 || response.status >= 300);

const failureResult = (
  error: unknown,
  logger: Logger,
  operation: string,
): CallToolResult => {
  if (error instanceof SidecarError) {
    logger.warn("tool_call_failed", { operation, code: error.code });
    return jsonResult(sidecarErrorBody(error), true);
  }
  const message =
    error instanceof Error ? error.message : "Unexpected sidecar error";
  logger.error("tool_call_failed", { operation, code: "INTERNAL_ERROR" });
  return jsonResult({ error: { code: "INTERNAL_ERROR", message } }, true);
};

export const createWeaverMcpServer = (
  client: WeaverClient,
  logger: Logger,
): McpServer => {
  const server = new McpServer(
    { name: "weaver-workflow-mcp", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Use list_workflows to discover workflow names, describe_workflow before execution when inputs are unclear, execute_workflow to run an existing workflow, and create_workflow to create or update a definition. Creation uses Weaver's existing upsert semantics.",
    },
  );

  server.registerTool(
    "list_workflows",
    {
      title: "List Weaver workflows",
      description:
        "List Weaver workflow definitions. Use mode=page for one REST page or mode=all to traverse pages up to the configured safety limit. Responses are passed through from Weaver; all mode returns an array of page envelopes.",
      inputSchema: ListWorkflowsInputSchema,
      annotations: {
        // Does not modify any state; only reads workflow metadata.
        readOnlyHint: true,
        // No data is altered or deleted.
        destructiveHint: false,
        // Repeated calls with the same params yield the same result.
        idempotentHint: true,
        // Operates within the closed Weaver domain; no external entities.
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return weaverResult(await client.listWorkflows(input));
      } catch (error) {
        return failureResult(error, logger, "list_workflows");
      }
    },
  );

  server.registerTool(
    "describe_workflow",
    {
      title: "Describe a Weaver workflow",
      description:
        "Fetch the latest compiled definition of one Weaver workflow by name. The response body is returned exactly as Weaver produced it.",
      inputSchema: DescribeWorkflowInputSchema,
      annotations: {
        // Only fetches a single workflow definition; no mutations.
        readOnlyHint: true,
        // Nothing is created, updated, or deleted.
        destructiveHint: false,
        // The same name always returns the same definition snapshot.
        idempotentHint: true,
        // Scoped to the Weaver API; no external systems involved.
        openWorldHint: false,
      },
    },
    async ({ workflow_name }) => {
      try {
        return weaverResult(await client.describeWorkflow(workflow_name));
      } catch (error) {
        return failureResult(error, logger, "describe_workflow");
      }
    },
  );

  server.registerTool(
    "execute_workflow",
    {
      title: "Execute a Weaver workflow",
      description:
        "Start a named Weaver workflow with an arbitrary JSON object as input and wait for Weaver's synchronous execution result. The workflow may perform external side effects.",
      inputSchema: ExecuteWorkflowInputSchema,
      annotations: {
        // Workflow execution triggers side effects (API calls, DB writes, etc.).
        readOnlyHint: false,
        // Effects may be irreversible depending on the workflow's steps.
        destructiveHint: true,
        // Re-running the same workflow may produce different outcomes or duplicate effects.
        idempotentHint: false,
        // Workflows can reach external services, APIs, and infrastructure.
        openWorldHint: true,
      },
    },
    async ({ workflow_name, input }) => {
      try {
        return weaverResult(await client.executeWorkflow(workflow_name, input));
      } catch (error) {
        return failureResult(error, logger, "execute_workflow");
      }
    },
  );

  server.registerTool(
    "create_workflow",
    {
      title: "Create or update a Weaver workflow",
      description:
        "Create or update a Weaver workflow using either a simplified typed DAG or Weaver's release-2 WorkflowDto. Existing names follow Weaver's current upsert and version behavior.",
      inputSchema: CreateWorkflowInputSchema,
      annotations: {
        // Creates or overwrites a workflow definition in Weaver.
        readOnlyHint: false,
        // Upsert semantics mean an existing definition can be replaced.
        destructiveHint: true,
        // Weaver may version or mutate state differently on repeated calls.
        idempotentHint: false,
        // Writes only to the Weaver API; no external systems contacted.
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const payload =
          input.format === "simplified"
            ? compileSimplifiedWorkflow(input.payload)
            : input.payload;
        return weaverResult(await client.createWorkflow(payload));
      } catch (error) {
        return failureResult(error, logger, "create_workflow");
      }
    },
  );

  return server;
};
