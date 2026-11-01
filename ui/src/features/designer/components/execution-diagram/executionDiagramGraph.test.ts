import { describe, expect, it } from "vitest";
import { applyExecutionState, buildExecutionDiagramGraph } from "./executionDiagramGraph";
import { EXECUTION_NODE_TYPES } from "./executionDiagramNodeTypes";

const workflowDto = {
  name: "order_flow",
  version: 1,
  tasks: [
    { name: "httpworker", taskReferenceName: "fetch_order", type: "SIMPLE", inputParameters: {} },
    {
      name: "switch",
      taskReferenceName: "route_order",
      type: "SWITCH",
      evaluatorType: "value-param",
      inputParameters: { switchCaseValue: "${workflow.input.kind}" },
      decisionCases: {
        express: [{ name: "scriptworker", taskReferenceName: "ship_express", type: "SIMPLE", inputParameters: {} }],
      },
      defaultCase: [{ name: "scriptworker", taskReferenceName: "ship_standard", type: "SIMPLE", inputParameters: {} }],
    },
  ],
};

describe("buildExecutionDiagramGraph", () => {
  it("builds start, task and end nodes from a workflow DTO", () => {
    const { nodes } = buildExecutionDiagramGraph(workflowDto);
    const kinds = nodes.map((node) => node.data.kind);

    expect(kinds.filter((kind) => kind === "start")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "end")).toHaveLength(1);
    expect(nodes.filter((node) => node.type === EXECUTION_NODE_TYPES.task).map((n) => n.data.taskReferenceName).sort())
      .toEqual(["fetch_order", "route_order", "ship_express", "ship_standard"]);
    expect(nodes.every((node) => node.draggable === false && node.connectable === false)).toBe(true);
    expect(nodes.filter((node) => node.data.kind === "task").every((node) => node.className === "nopan")).toBe(true);
  });

  it("gives every edge endpoint a matching handle id", () => {
    const { nodes, edges } = buildExecutionDiagramGraph(workflowDto);
    const byId = new Map(nodes.map((node) => [node.id, node]));

    edges.forEach((edge) => {
      expect(byId.get(edge.source)?.data.sourceHandleIds).toContain(edge.sourceHandle ?? null);
      expect(byId.get(edge.target)?.data.targetHandleIds).toContain(edge.targetHandle ?? null);
    });
  });

  it("joins terminal tasks to End", () => {
    const { nodes, edges } = buildExecutionDiagramGraph(workflowDto);
    const endId = nodes.find((node) => node.data.kind === "end")!.id;
    const refsIntoEnd = edges
      .filter((edge) => edge.target === endId)
      .map((edge) => nodes.find((node) => node.id === edge.source)?.data.taskReferenceName)
      .sort();

    expect(refsIntoEnd).toEqual(["ship_express", "ship_standard"]);
  });

  it("returns only End for an empty definition", () => {
    const { nodes } = buildExecutionDiagramGraph(null);
    expect(nodes.map((node) => node.data.kind).sort()).toEqual(["end"]);
  });
});

describe("buildExecutionDiagramGraph with nested switch branches", () => {
  const respond = (ref: string) => [
    { name: "RespondWorker", taskReferenceName: ref, type: "SIMPLE", inputParameters: {} },
    {
      name: "terminate",
      taskReferenceName: `terminate_${ref}`,
      type: "TERMINATE",
      inputParameters: { workflowOutput: `\${${ref}.output}` },
    },
  ];
  const conductorDefinition = {
    name: "airtime_advance_wf",
    tasks: [
      { name: "ScriptWorker", taskReferenceName: "validate", type: "SIMPLE", inputParameters: {} },
      {
        name: "switch",
        taskReferenceName: "outer_switch",
        type: "SWITCH",
        evaluatorType: "value-param",
        decisionCases: {
          VALID_REQUEST: [
            { name: "DatabaseWorker", taskReferenceName: "query", type: "SIMPLE", inputParameters: {} },
            {
              name: "switch",
              taskReferenceName: "inner_switch",
              type: "SWITCH",
              evaluatorType: "value-param",
              decisionCases: { CUSTOMER_FOUND: respond("respond_found") },
              defaultCase: respond("respond_inner_default"),
            },
          ],
          MISSING_REQUIRED_ATTRIBUTES: respond("respond_missing"),
        },
        defaultCase: respond("respond_outer_default"),
      },
    ],
  };

  it("creates nodes for tasks at every branch depth and hides companion terminates", () => {
    const refs = buildExecutionDiagramGraph(conductorDefinition)
      .nodes.map((node) => node.data.taskReferenceName)
      .filter(Boolean)
      .sort();

    expect(refs).toEqual([
      "inner_switch",
      "outer_switch",
      "query",
      "respond_found",
      "respond_inner_default",
      "respond_missing",
      "respond_outer_default",
      "validate",
    ]);
  });

  it("links branches to their case without self-loops", () => {
    const { nodes, edges } = buildExecutionDiagramGraph(conductorDefinition);
    const refById = new Map(nodes.map((node) => [node.id, node.data.taskReferenceName || node.data.kind]));
    const links = edges.map((edge) => `${refById.get(edge.source)}->${refById.get(edge.target)}`);

    expect(edges.some((edge) => edge.source === edge.target)).toBe(false);
    expect(links).toEqual(
      expect.arrayContaining([
        "outer_switch->query",
        "query->inner_switch",
        "inner_switch->respond_found",
        "inner_switch->respond_inner_default",
        "outer_switch->respond_missing",
        "outer_switch->respond_outer_default",
        "respond_missing->end",
      ])
    );
  });
});

describe("applyExecutionState", () => {
  it("attaches task states and selection by reference name", () => {
    const graph = buildExecutionDiagramGraph(workflowDto);
    const { nodes } = applyExecutionState(
      graph,
      { fetch_order: { status: "COMPLETED", durationMs: 12 } },
      "fetch_order"
    );
    const fetchOrder = nodes.find((node) => node.data.taskReferenceName === "fetch_order")!;
    const routeOrder = nodes.find((node) => node.data.taskReferenceName === "route_order")!;

    expect(fetchOrder.data.executionState).toEqual({ status: "COMPLETED", durationMs: 12 });
    expect(fetchOrder.data.selected).toBe(true);
    expect(routeOrder.data.executionState).toBeUndefined();
    expect(routeOrder.data.selected).toBe(false);
  });
});
