import { createServer, type RequestListener, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { SidecarError } from "../src/errors.js";
import { Logger } from "../src/logger.js";
import { WeaverClient } from "../src/weaver-client.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

const startStub = async (
  handler: RequestListener,
): Promise<{ url: string; requests: string[] }> => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    handler?.(request, response);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Stub address unavailable");
  return { url: `http://127.0.0.1:${address.port}`, requests };
};

const config = (
  weaverBaseUrl: string,
  overrides: Partial<Config> = {},
): Config => ({
  host: "127.0.0.1",
  port: 3000,
  weaverBaseUrl,
  requestTimeoutMs: 500,
  executionTimeoutMs: 500,
  listMaxPages: 5,
  allowedHosts: new Set(["127.0.0.1"]),
  allowedOrigins: new Set(),
  logLevel: "error",
  ...overrides,
});

describe("WeaverClient", () => {
  it("traverses every workflow page without changing page envelopes", async () => {
    const stub = await startStub((request, response) => {
      const page = new URL(request.url ?? "/", "http://stub").searchParams.get(
        "page",
      );
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          message: "ok",
          status: "OK",
          data: [{ page }],
          details: { isLastPage: page === "1" },
        }),
      );
    });
    const client = new WeaverClient(config(stub.url), new Logger("error"));

    const result = await client.listWorkflows({
      mode: "all",
      page: 99,
      size: 10,
      sort: ["workflowName,asc"],
    });
    expect(result.body).toEqual([
      expect.objectContaining({ data: [{ page: "0" }] }),
      expect.objectContaining({ data: [{ page: "1" }] }),
    ]);
    expect(stub.requests).toEqual([
      "/api/metadata/workflows?page=0&size=10&sort=workflowName%2Casc",
      "/api/metadata/workflows?page=1&size=10&sort=workflowName%2Casc",
    ]);
  });

  it("returns Weaver error bodies without throwing", async () => {
    const body = { message: "Workflow not found", requestId: "request-1" };
    const stub = await startStub((_request, response) => {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    });
    const client = new WeaverClient(config(stub.url), new Logger("error"));
    await expect(client.describeWorkflow("missing workflow")).resolves.toEqual({
      status: 404,
      body,
      requestId: "request-1",
    });
    expect(stub.requests[0]).toBe(
      "/api/metadata/workflows/missing%20workflow",
    );
  });

  it("sends execution input unchanged and uses an encoded workflow name", async () => {
    let receivedBody = "";
    const stub = await startStub((request, response) => {
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        receivedBody += String(chunk);
      });
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ success: true }));
      });
    });
    const client = new WeaverClient(config(stub.url), new Logger("error"));
    const input = { customer: { id: 42 }, enabled: true };
    await client.executeWorkflow("customer lookup", input);
    expect(stub.requests[0]).toBe("/api/executor/customer%20lookup");
    expect(JSON.parse(receivedBody)).toEqual(input);
  });

  it("upserts a release-2 WorkflowDto with its requested version", async () => {
    let method = "";
    let receivedBody = "";
    const stub = await startStub((request, response) => {
      method = request.method ?? "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        receivedBody += String(chunk);
      });
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ success: true }));
      });
    });
    const client = new WeaverClient(config(stub.url), new Logger("error"));
    const payload = {
      name: "demo",
      version: 3,
      tasks: [],
      edges: [],
      custom: true,
    };
    await client.createWorkflow(payload);
    expect(method).toBe("POST");
    expect(stub.requests[0]).toBe(
      "/api/workflows/upsert/new?incrementVersion=false&version=3",
    );
    expect(JSON.parse(receivedBody)).toEqual(payload);
  });

  it("reports invalid JSON as an invalid Weaver response", async () => {
    const stub = await startStub((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("not json");
    });
    const client = new WeaverClient(config(stub.url), new Logger("error"));
    await expect(client.describeWorkflow("demo")).rejects.toMatchObject<
      Partial<SidecarError>
    >({
      code: "INVALID_WEAVER_RESPONSE",
    });
  });

  it("enforces the configured page limit and attaches collected pages", async () => {
    const stub = await startStub((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ data: [], details: { isLastPage: false } }),
      );
    });
    const client = new WeaverClient(
      config(stub.url, { listMaxPages: 2 }),
      new Logger("error"),
    );
    await expect(
      client.listWorkflows({ mode: "all", page: 0, size: 20, sort: [] }),
    ).rejects.toMatchObject<Partial<SidecarError>>({
      code: "WEAVER_PAGE_LIMIT",
    });
  });

  it("uses the bounded request timeout", async () => {
    const stub = await startStub(() => undefined);
    const client = new WeaverClient(
      config(stub.url, { requestTimeoutMs: 25 }),
      new Logger("error"),
    );
    await expect(client.describeWorkflow("slow")).rejects.toMatchObject<
      Partial<SidecarError>
    >({ code: "WEAVER_TIMEOUT" });
  });
});
