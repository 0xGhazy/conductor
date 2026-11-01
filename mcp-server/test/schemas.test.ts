import { describe, expect, it } from "vitest";
import {
  CreateWorkflowInputSchema,
  ExecuteWorkflowInputSchema,
  ListWorkflowsInputSchema,
  SimplifiedNodeSchema,
} from "../src/workflow/schemas.js";

describe("tool input schemas", () => {
  it("applies release-2 list defaults", () => {
    expect(ListWorkflowsInputSchema.parse({})).toEqual({
      mode: "page",
      page: 0,
      size: 20,
      sort: ["createdOn,desc"],
    });
  });

  it("requires execution input to be an object", () => {
    expect(
      ExecuteWorkflowInputSchema.safeParse({ workflow_name: "demo", input: [] })
        .success,
    ).toBe(false);
  });

  it("accepts a raw release-2 WorkflowDto and preserves extra fields", () => {
    const result = CreateWorkflowInputSchema.parse({
      format: "raw",
      payload: {
        name: "demo",
        version: 2,
        custom: true,
        tasks: [
          {
            name: "terminate",
            taskReferenceName: "done",
            inputParameters: {
              terminationStatus: "COMPLETED",
              workflowOutput: {},
            },
            type: "TERMINATE",
            customTaskField: true,
          },
        ],
        edges: [],
      },
    });
    expect(result.payload).toMatchObject({
      name: "demo",
      custom: true,
      tasks: [expect.objectContaining({ customTaskField: true })],
    });
  });

  it("rejects the removed cache action", () => {
    expect(
      SimplifiedNodeSchema.safeParse({
        id: "cache",
        type: "CACHE_ACTION",
        config: { action: "READ", key: "key" },
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      type: "SCRIPT_ACTION",
      config: {
        expression: "return 1",
        variables: {},
        language: "JAVA_SCRIPT",
      },
    },
    {
      type: "REDIS_ACTION",
      config: {
        datasourceId: "01953901-9f20-7000-8000-000000000002",
        action: "GET",
        key: "customer",
      },
    },
    {
      type: "RULE_ENGINE_ACTION",
      config: {
        rules: [{ field: "age", operator: ">=", value: 18 }],
      },
    },
    {
      type: "WAIT_ACTION",
      config: { mode: "DURATION", duration: "1 minute" },
    },
    {
      type: "RESPOND_ACTION",
      config: { messageCode: "OK" },
    },
  ])("accepts release-2 $type", ({ type, config }) => {
    expect(
      SimplifiedNodeSchema.safeParse({ id: type.toLowerCase(), type, config })
        .success,
    ).toBe(true);
  });
});
