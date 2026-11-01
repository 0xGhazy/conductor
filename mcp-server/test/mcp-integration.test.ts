import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/logger.js";
import { createWeaverMcpServer } from "../src/tools.js";
import type { WeaverClient } from "../src/weaver-client.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

const connect = async (weaver: WeaverClient): Promise<Client> => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createWeaverMcpServer(weaver, new Logger("error"));
  const client = new Client({ name: "weaver-mcp-test", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeCallbacks.push(async () => {
    await client.close();
    await server.close();
  });
  return client;
};

describe("MCP tool surface", () => {
  it("advertises exactly the four planned tools with annotations", async () => {
    const weaver = {
      listWorkflows: vi.fn(),
      describeWorkflow: vi.fn(),
      executeWorkflow: vi.fn(),
      createWorkflow: vi.fn(),
    } as unknown as WeaverClient;
    const client = await connect(weaver);
    const result = await client.listTools();
    expect(result.tools.map((tool) => tool.name)).toEqual([
      "list_workflows",
      "describe_workflow",
      "execute_workflow",
      "create_workflow",
    ]);
    expect(
      result.tools.find((tool) => tool.name === "list_workflows")?.annotations
        ?.readOnlyHint,
    ).toBe(true);
    expect(
      result.tools.find((tool) => tool.name === "execute_workflow")?.annotations
        ?.openWorldHint,
    ).toBe(true);
  });

  it("passes successful and failed Weaver responses through tool results", async () => {
    const weaver = {
      listWorkflows: vi
        .fn()
        .mockResolvedValue({ status: 200, body: { data: ["demo"] } }),
      describeWorkflow: vi
        .fn()
        .mockResolvedValue({ status: 404, body: { message: "missing" } }),
      executeWorkflow: vi.fn(),
      createWorkflow: vi.fn(),
    } as unknown as WeaverClient;
    const client = await connect(weaver);

    const listed = await client.callTool({
      name: "list_workflows",
      arguments: {},
    });
    expect(listed.structuredContent).toEqual({ data: ["demo"] });
    expect(listed.isError).not.toBe(true);

    const described = await client.callTool({
      name: "describe_workflow",
      arguments: { workflow_name: "missing" },
    });
    expect(described.structuredContent).toEqual({ message: "missing" });
    expect(described.isError).toBe(true);
  });

  it("compiles simplified workflows before calling Weaver", async () => {
    const createWorkflow = vi
      .fn()
      .mockResolvedValue({ status: 201, body: { message: "created" } });
    const weaver = {
      listWorkflows: vi.fn(),
      describeWorkflow: vi.fn(),
      executeWorkflow: vi.fn(),
      createWorkflow,
    } as unknown as WeaverClient;
    const client = await connect(weaver);
    const result = await client.callTool({
      name: "create_workflow",
      arguments: {
        format: "simplified",
        payload: {
          workflowName: "demo",
          nodes: [
            {
              id: "done",
              type: "TERMINATE",
              config: { status: "COMPLETED", output: {} },
            },
          ],
          edges: [],
        },
      },
    });

    expect(result.isError).not.toBe(true);
    expect(createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "demo",
        version: 1,
        tasks: [expect.objectContaining({ type: "TERMINATE" })],
        edges: [
          expect.objectContaining({ source: "start", target: "done" }),
        ],
      }),
    );
  });

  it("passes raw release-2 WorkflowDto payloads through unchanged", async () => {
    const createWorkflow = vi
      .fn()
      .mockResolvedValue({ status: 200, body: { success: true } });
    const weaver = {
      listWorkflows: vi.fn(),
      describeWorkflow: vi.fn(),
      executeWorkflow: vi.fn(),
      createWorkflow,
    } as unknown as WeaverClient;
    const client = await connect(weaver);
    const payload = {
      name: "raw_demo",
      version: 4,
      custom: "preserved",
      tasks: [
        {
          name: "terminate",
          taskReferenceName: "done",
          inputParameters: { terminationStatus: "COMPLETED" },
          type: "TERMINATE",
        },
      ],
      edges: [],
    };
    const result = await client.callTool({
      name: "create_workflow",
      arguments: { format: "raw", payload },
    });

    expect(result.isError).not.toBe(true);
    expect(createWorkflow).toHaveBeenCalledWith(payload);
  });
});
