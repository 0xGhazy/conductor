import { describe, it, expect } from "vitest";
import {
  buildExecuteUrl,
  wrapWorkflowExecutePayload,
  normalizeWorkflow,
  parseJsonSafe,
  formatJson,
} from "./workbenchService";

describe("workbenchService - sync workflow execution", () => {
  describe("buildExecuteUrl", () => {
    it("builds the sync execution endpoint matching Conductor's /api/workflow/execute/{name}/{version}", () => {
      const url = buildExecuteUrl(
        "workflow_name",
        {
          version: 1,
          requestId: "qwe",
          waitForSeconds: 60,
          consistency: "DURABLE",
          returnStrategy: "TARGET_WORKFLOW",
        },
        "http://localhost:8080"
      );

      expect(url).toBe(
        "http://localhost:8080/api/workflow/execute/workflow_name/1?requestId=qwe&waitForSeconds=60&consistency=DURABLE&returnStrategy=TARGET_WORKFLOW"
      );
    });

    it("uses correlationId when requestId is not provided", () => {
      const url = buildExecuteUrl(
        "customer_lookup",
        {
          version: "2",
          correlationId: "corr-1234",
        },
        "http://localhost:8080"
      );

      expect(url).toBe(
        "http://localhost:8080/api/workflow/execute/customer_lookup/2?requestId=corr-1234&waitForSeconds=60&consistency=DURABLE&returnStrategy=TARGET_WORKFLOW"
      );
    });

    it("defaults version to 1 and waitForSeconds to 60 if omitted", () => {
      const url = buildExecuteUrl("order_process", {}, "http://localhost:8080");

      expect(url).toBe(
        "http://localhost:8080/api/workflow/execute/order_process/1?waitForSeconds=60&consistency=DURABLE&returnStrategy=TARGET_WORKFLOW"
      );
    });

    it("properly encodes special characters in workflow name and version", () => {
      const url = buildExecuteUrl("user login / v2", { version: 1 }, "http://localhost:8080");

      expect(url).toBe(
        "http://localhost:8080/api/workflow/execute/user%20login%20%2F%20v2/1?waitForSeconds=60&consistency=DURABLE&returnStrategy=TARGET_WORKFLOW"
      );
    });
  });

  describe("wrapWorkflowExecutePayload", () => {
    it("wraps standard key-value inputs into an input wrapper object", () => {
      const rawInput = {
        inp1: "asdasdkjh",
        inp2: "asd",
        inp3: "asdasd",
      };

      const wrapped = wrapWorkflowExecutePayload(rawInput);
      expect(wrapped).toEqual({
        input: {
          inp1: "asdasdkjh",
          inp2: "asd",
          inp3: "asdasd",
        },
      });
    });

    it("does not double-wrap if payload already contains an input object", () => {
      const existingWrapped = {
        input: {
          inp1: "asdasdkjh",
          inp2: "asd",
          inp3: "asdasd",
        },
      };

      const wrapped = wrapWorkflowExecutePayload(existingWrapped);
      expect(wrapped).toEqual(existingWrapped);
    });

    it("handles null or undefined payload gracefully", () => {
      expect(wrapWorkflowExecutePayload(null)).toEqual({ input: {} });
      expect(wrapWorkflowExecutePayload(undefined)).toEqual({ input: {} });
      expect(wrapWorkflowExecutePayload("string")).toEqual({ input: {} });
    });
  });

  describe("normalizeWorkflow & formatting", () => {
    it("normalizes workflow item correctly", () => {
      const normalized = normalizeWorkflow(
        {
          name: "sim_swap_wf",
          version: 2,
          input: { phone: "123" },
          description: "SIM Swap process",
        },
        0
      );

      expect(normalized.name).toBe("sim_swap_wf");
      expect(normalized.version).toBe(2);
      expect(normalized.input).toEqual({ phone: "123" });
    });

    it("parses and formats JSON safely", () => {
      expect(parseJsonSafe('{"a":1}', {})).toEqual({ a: 1 });
      expect(parseJsonSafe("invalid", { default: true })).toEqual({ default: true });
      expect(formatJson({ key: "val" })).toContain('"key": "val"');
    });
  });
});
