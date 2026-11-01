import { describe, it, expect } from "vitest";
import { serializeHttpNodeForJson, exportHttpActionData } from "./serializeHttpNodeForJson";
import { HttpNodeDefinition } from "./HttpNodeDefinition";
import type { Node, Edge } from "@xyflow/react";

describe("serializeHttpNodeForJson", () => {
  it("serializes an empty/default HTTP node to the Conductor Simple Task specification", () => {
    const node: Node = {
      id: "2a5047fe-472c-4500-a32b-a2391460caa3",
      type: "HTTP_ACTION",
      position: { x: -168.5, y: 521.23 },
      data: {
        name: "List Red bundles",
        config: {
          taskReferenceName: "http_request_kz9jw708",
          url: "http://localhost:8090/vodafone/bundles",
        },
      },
    };

    const result = serializeHttpNodeForJson(node, {
      node,
      readOnly: false,
      updateConfig: () => {},
      edges: [],
    });

    expect(result).toEqual({
      name: "HttpWorker",
      taskReferenceName: "http_request_kz9jw708",
      inputParameters: {
        method: "GET",
        url: "http://localhost:8090/vodafone/bundles",
        timeout: 3000,
        connection: "--NONE--",
        headers: {},
        body: {},
      },
      type: "SIMPLE",
    });

    // Check exact key ordering in inputParameters
    const keys = Object.keys(result.inputParameters);
    expect(keys).toEqual([
      "method",
      "url",
      "timeout",
      "connection",
      "headers",
      "body",
    ]);
  });

  it("serializes HTTP node with custom configuration and parameters", () => {
    const node: Node = {
      id: "http_middle",
      type: "HTTP_ACTION",
      position: { x: 200, y: 150 },
      data: {
        name: "Call Gateway",
        config: {
          taskReferenceName: "call_gateway_ref",
          method: "POST",
          url: "https://api.gateway.internal/v1/checkout",
          timeout: 5000,
          connection: "BillingGatewayConn",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer ${workflow.input.token}",
          },
          body: '{"orderId":"${workflow.input.orderId}"}',
        },
      },
    };

    const edges: Edge[] = [
      {
        id: "e1",
        source: "start_node",
        target: "http_middle",
      },
      {
        id: "e2",
        source: "http_middle",
        target: "end_node",
      },
    ];

    const result = serializeHttpNodeForJson(node, {
      node,
      readOnly: false,
      updateConfig: () => {},
      edges,
    });

    expect(result).toEqual({
      name: "HttpWorker",
      taskReferenceName: "call_gateway_ref",
      inputParameters: {
        method: "POST",
        url: "https://api.gateway.internal/v1/checkout",
        timeout: 5000,
        connection: "BillingGatewayConn",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ${workflow.input.token}",
        },
        body: {
          orderId: "${workflow.input.orderId}",
        },
      },
      type: "SIMPLE",
    });
  });

  it("handles stringified headers and defaults body to object {}", () => {
    const node: Node = {
      id: "http_stringified",
      type: "HTTP_ACTION",
      position: { x: 50, y: 50 },
      data: {
        name: "HTTP Stringified",
        config: {
          taskReferenceName: "http_str_ref",
          headers: '{"Accept": "application/json", "X-Custom": "123"}',
        },
      },
    };

    const result = serializeHttpNodeForJson(node, {
      node,
      readOnly: false,
      updateConfig: () => {},
      edges: [],
    });

    expect(result.inputParameters.headers).toEqual({
      "Accept": "application/json",
      "X-Custom": "123",
    });
    expect(result.inputParameters.body).toEqual({});
  });

  it("is registered as the serializeForJson serializer on HttpNodeDefinition", () => {
    expect(HttpNodeDefinition.serializeForJson).toBe(serializeHttpNodeForJson);
  });

  it("serializes from headersRows when headers is missing or empty", () => {
    const node: Node = {
      id: "http_rows",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: {
        config: {
          taskReferenceName: "http_rows_ref",
          headersRows: [
            { id: "1", header: "X-Api-Key", value: "secret123" },
            { id: "2", header: "Accept", value: "application/json" },
          ],
        },
      },
    };

    const result = serializeHttpNodeForJson(node);
    expect(result.inputParameters.headers).toEqual({
      "X-Api-Key": "secret123",
      "Accept": "application/json",
    });
  });

  it("supports legacy exportHttpActionData adapter", () => {
    const data = {
      name: "Legacy Adapter Node",
      config: {
        taskReferenceName: "adapter_ref",
        method: "PUT",
        url: "https://example.com/api",
      },
    };

    const result = exportHttpActionData(data, "adapter_node_id", { x: 10, y: 20 });
    expect(result.name).toBe("HttpWorker");
    expect(result.taskReferenceName).toBe("adapter_ref");
    expect(result.inputParameters.method).toBe("PUT");
    expect(result.inputParameters.url).toBe("https://example.com/api");
  });

  describe("HttpNodeDefinition.validate", () => {
    it("reports HTTP_URL_REQUIRED when URL is missing", () => {
      const node: Node = {
        id: "http-no-url",
        type: "HTTP_ACTION",
        position: { x: 0, y: 0 },
        data: {
          config: {
            url: "",
            method: "GET",
          },
        },
      };

      const issues = HttpNodeDefinition.validate?.(node) || [];
      expect(issues.some((i) => i.code === "HTTP_URL_REQUIRED")).toBe(true);
    });

    it("reports HTTP_METHOD_INVALID when method is unsupported", () => {
      const node: Node = {
        id: "http-bad-method",
        type: "HTTP_ACTION",
        position: { x: 0, y: 0 },
        data: {
          config: {
            url: "https://example.com",
            method: "INVALID_METHOD",
          },
        },
      };

      const issues = HttpNodeDefinition.validate?.(node) || [];
      expect(issues.some((i) => i.code === "HTTP_METHOD_INVALID")).toBe(true);
    });

    it("returns no issues for valid HTTP configuration", () => {
      const node: Node = {
        id: "http-valid",
        type: "HTTP_ACTION",
        position: { x: 0, y: 0 },
        data: {
          config: {
            url: "https://example.com/users",
            method: "POST",
          },
        },
      };

      const issues = HttpNodeDefinition.validate?.(node) || [];
      expect(issues.length).toBe(0);
    });
  });
});

