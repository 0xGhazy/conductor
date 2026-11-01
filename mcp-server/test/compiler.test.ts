import { describe, expect, it } from "vitest";
import { SidecarError } from "../src/errors.js";
import {
  compileSimplifiedWorkflow,
  type CompiledTask,
} from "../src/workflow/compiler.js";
import { SimplifiedWorkflowSchema } from "../src/workflow/schemas.js";

const terminate = (id: string) => ({
  id,
  type: "TERMINATE" as const,
  config: { status: "COMPLETED" as const, reason: "Done", output: {} },
});

const flattenTasks = (tasks: CompiledTask[]): CompiledTask[] =>
  tasks.flatMap((task) => [
    task,
    ...Object.values(task.decisionCases ?? {}).flatMap(flattenTasks),
    ...flattenTasks(task.defaultCase ?? []),
  ]);

describe("compileSimplifiedWorkflow", () => {
  it("compiles a deterministic linear release-2 WorkflowDto", () => {
    const workflow = SimplifiedWorkflowSchema.parse({
      workflowName: "customer_lookup",
      inputs: { customerId: "" },
      variables: { tenant: "demo" },
      nodes: [
        {
          id: "lookup",
          name: "Lookup customer",
          type: "HTTP_ACTION",
          config: { url: "https://example.test/customer", method: "GET" },
        },
        terminate("done"),
      ],
      edges: [{ source: "lookup", target: "done" }],
    });

    const result = compileSimplifiedWorkflow(workflow);
    expect(result).toMatchObject({
      name: "customer_lookup",
      version: 1,
      _inputs: { customerId: "" },
      variables: { tenant: "demo" },
      _builderSchemaVersion: 2,
      schemaVersion: 2,
    });
    expect(result.tasks.map((task) => task.name)).toEqual([
      "HttpWorker",
      "terminate",
    ]);
    expect(result.tasks[0]?.inputParameters).toMatchObject({
      _nodeId: "lookup",
      _nodeName: "Lookup customer",
      _nodePosX: "60",
      _nodePosY: "320",
    });
    expect(result.edges).toEqual([
      expect.objectContaining({
        id: "edge-0001",
        source: "start",
        target: "lookup",
        sourceHandle: "workflow-entry-point",
      }),
      expect.objectContaining({
        id: "edge-0002",
        source: "lookup",
        target: "done",
        sourceHandle: "httpResult",
        targetHandle: "terminate-input",
      }),
    ]);
  });

  it("generates nested switch task branches", () => {
    const workflow = SimplifiedWorkflowSchema.parse({
      workflowName: "route_customer",
      nodes: [
        {
          id: "route",
          type: "SWITCH_ACTION",
          config: {
            evaluatorType: "value-param",
            switchCaseValue: "${workflow.input.segment}",
            cases: [{ id: "vip-case", value: "vip" }],
          },
        },
        {
          id: "inner",
          type: "SWITCH_ACTION",
          config: {
            evaluatorType: "javascript",
            expression: "$.score > 10",
            cases: [{ id: "high-case", value: "high" }],
          },
        },
        terminate("high_done"),
        terminate("inner_default"),
        terminate("outer_default"),
      ],
      edges: [
        { source: "route", target: "inner", branch: "vip-case" },
        { source: "route", target: "outer_default", branch: "default" },
        { source: "inner", target: "high_done", branch: "high-case" },
        { source: "inner", target: "inner_default", branch: "default" },
      ],
    });

    const result = compileSimplifiedWorkflow(workflow);
    const outer = result.tasks[0];
    expect(outer).toMatchObject({
      type: "SWITCH",
      evaluatorType: "value-param",
      expression: "switchCaseValue",
    });
    const inner = outer?.decisionCases?.vip?.[0];
    expect(inner).toMatchObject({
      type: "SWITCH",
      evaluatorType: "javascript",
      expression: "$.score > 10",
    });
    expect(inner?.decisionCases?.high?.[0]?.type).toBe("TERMINATE");
    expect(inner?.defaultCase?.[0]?.type).toBe("TERMINATE");
    expect(outer?.defaultCase?.[0]?.type).toBe("TERMINATE");
  });

  it("duplicates merged task sequences with deterministic unique references", () => {
    const workflow = SimplifiedWorkflowSchema.parse({
      workflowName: "merge_branches",
      nodes: [
        {
          id: "route",
          type: "SWITCH_ACTION",
          config: {
            evaluatorType: "value-param",
            switchCaseValue: "${workflow.input.route}",
            cases: [{ id: "a-case", value: "a" }],
          },
        },
        {
          id: "a",
          type: "JEXL_ACTION",
          config: { expression: "1", variables: {} },
        },
        {
          id: "b",
          type: "JEXL_ACTION",
          config: { expression: "2", variables: {} },
        },
        {
          id: "merge",
          type: "JEXL_ACTION",
          config: { expression: "3", variables: {} },
        },
        terminate("done"),
      ],
      edges: [
        { source: "route", target: "a", branch: "a-case" },
        { source: "route", target: "b", branch: "default" },
        { source: "a", target: "merge" },
        { source: "b", target: "merge" },
        { source: "merge", target: "done" },
      ],
    });

    const references = flattenTasks(compileSimplifiedWorkflow(workflow).tasks)
      .map((task) => task.taskReferenceName);
    expect(references).toContain("merge");
    expect(references).toContain("merge_2");
    expect(new Set(references).size).toBe(references.length);
  });

  it("compiles every release-2 action configuration", () => {
    const workflow = SimplifiedWorkflowSchema.parse({
      workflowName: "all_actions",
      nodes: [
        {
          id: "http",
          type: "HTTP_ACTION",
          config: {
            url: "https://example.test",
            method: "POST",
            headers: { accept: "application/json" },
            query: { page: "1" },
            body: { customer: "${workflow.input.customer}" },
            connection: "oauth_connection",
            timeout: 7000,
          },
        },
        {
          id: "database",
          type: "DATABASE_ACTION",
          config: {
            queryId: "3f558f99-5059-4314-9ff8-62f021215a16",
            datasourceId: "01953901-9f20-7000-8000-000000000001",
            params: { id: "${http.output.result.id}" },
          },
        },
        {
          id: "jexl",
          type: "JEXL_ACTION",
          config: { expression: "value + 1", variables: { value: 1 } },
        },
        {
          id: "script",
          type: "SCRIPT_ACTION",
          config: {
            expression: "return value + 1",
            variables: { value: 1 },
            language: "JAVA_SCRIPT",
          },
        },
        {
          id: "redis",
          type: "REDIS_ACTION",
          config: {
            datasourceId: "01953901-9f20-7000-8000-000000000002",
            action: "SET",
            key: "customer",
            value: "ok",
            ttlSeconds: 60,
          },
        },
        {
          id: "validate",
          type: "VALIDATION_ACTION",
          config: {
            rules: [
              {
                field: "customer",
                operator: "NOT_EMPTY",
                value: "",
                failureMessage: "customer is required",
              },
            ],
          },
        },
        {
          id: "rules",
          type: "RULE_ENGINE_ACTION",
          config: {
            rules: [
              { field: "score", operator: ">=", value: 10 },
              "AND",
              { field: "active", operator: "==", value: true },
            ],
          },
        },
        {
          id: "wait",
          type: "WAIT_ACTION",
          config: { mode: "DURATION", duration: "5 seconds" },
        },
        terminate("done"),
      ],
      edges: [
        { source: "http", target: "database" },
        { source: "database", target: "jexl" },
        { source: "jexl", target: "script" },
        { source: "script", target: "redis" },
        { source: "redis", target: "validate" },
        { source: "validate", target: "rules" },
        { source: "rules", target: "wait" },
        { source: "wait", target: "done" },
      ],
    });

    const tasks = compileSimplifiedWorkflow(workflow).tasks;
    expect(tasks.map((task) => task.name)).toEqual([
      "HttpWorker",
      "DatabaseWorker",
      "ScriptWorker",
      "ScriptWorker",
      "RedisWorker",
      "ValidationWorker",
      "RuleEngineWorker",
      "wait",
      "terminate",
    ]);
    expect(tasks[3]?.inputParameters).toMatchObject({
      language: "JAVA_SCRIPT",
      timeout: 30000,
    });
    expect(tasks[4]?.inputParameters).toMatchObject({
      action: "SET",
      ttlSeconds: 60,
    });
  });

  it("turns respond into a worker followed by a companion terminate", () => {
    const workflow = SimplifiedWorkflowSchema.parse({
      workflowName: "respond_demo",
      nodes: [
        {
          id: "reply",
          type: "RESPOND_ACTION",
          config: { messageCode: "SUCCESS" },
        },
      ],
      edges: [],
    });
    const tasks = compileSimplifiedWorkflow(workflow).tasks;
    expect(tasks.map((task) => task.name)).toEqual([
      "RespondWorker",
      "terminate",
    ]);
    expect(tasks[1]?.inputParameters.workflowOutput).toBe("${reply.output}");
  });

  it.each([
    {
      name: "missing references",
      value: {
        workflowName: "missing",
        nodes: [terminate("done")],
        edges: [{ source: "missing", target: "done" }],
      },
    },
    {
      name: "cycles",
      value: {
        workflowName: "cycle",
        nodes: [
          {
            id: "a",
            type: "JEXL_ACTION",
            config: { expression: "1", variables: {} },
          },
          {
            id: "b",
            type: "JEXL_ACTION",
            config: { expression: "2", variables: {} },
          },
        ],
        edges: [
          { source: "a", target: "b" },
          { source: "b", target: "a" },
        ],
      },
    },
    {
      name: "unterminated paths",
      value: {
        workflowName: "unterminated",
        nodes: [
          {
            id: "a",
            type: "JEXL_ACTION",
            config: { expression: "1", variables: {} },
          },
        ],
        edges: [],
      },
    },
    {
      name: "invalid switch branches",
      value: {
        workflowName: "bad_switch",
        nodes: [
          {
            id: "route",
            type: "SWITCH_ACTION",
            config: {
              evaluatorType: "value-param",
              switchCaseValue: "x",
              cases: [{ id: "known", value: "known" }],
            },
          },
          terminate("done"),
        ],
        edges: [
          { source: "route", target: "done", branch: "unknown" },
          { source: "route", target: "done", branch: "default" },
        ],
      },
    },
  ])("rejects $name", ({ value }) => {
    const workflow = SimplifiedWorkflowSchema.parse(value);
    expect(() => compileSimplifiedWorkflow(workflow)).toThrow(SidecarError);
  });
});
