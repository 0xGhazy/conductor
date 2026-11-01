import { describe, it, expect } from "vitest";
import {
  getTerminalNodes,
  createGhostEndEdges,
  isEndNode,
  isStartNode,
  END_NODE_ID,
  START_NODE_ID,
} from "./designerGraphUtils";

describe("Terminal Nodes & Ghost Edges", () => {
  it("identifies Start node as terminal when there are no task nodes", () => {
    const nodes = [
      { id: START_NODE_ID, type: "startFlag", position: { x: 0, y: 0 }, data: { name: "Start" } },
      { id: END_NODE_ID, type: "endFlag", position: { x: 0, y: 200 }, data: { name: "End" } },
    ];
    const edges: any[] = [];

    const terminals = getTerminalNodes(nodes, edges);
    expect(terminals).toHaveLength(1);
    expect(terminals[0].id).toBe(START_NODE_ID);

    const ghostEdges = createGhostEndEdges(terminals, END_NODE_ID);
    expect(ghostEdges).toHaveLength(1);
    expect(ghostEdges[0].source).toBe(START_NODE_ID);
    expect(ghostEdges[0].target).toBe(END_NODE_ID);
    expect(ghostEdges[0].data?.isGhost).toBe(true);
  });

  it("identifies single leaf task node as terminal", () => {
    const nodes = [
      { id: START_NODE_ID, type: "startFlag", position: { x: 0, y: 0 }, data: { name: "Start" } },
      { id: "http_1", type: "HTTP_ACTION", position: { x: 0, y: 100 }, data: { name: "HTTP" } },
      { id: END_NODE_ID, type: "endFlag", position: { x: 0, y: 200 }, data: { name: "End" } },
    ];
    const edges = [
      { id: "e1", source: START_NODE_ID, target: "http_1" },
    ];

    const terminals = getTerminalNodes(nodes, edges);
    expect(terminals).toHaveLength(1);
    expect(terminals[0].id).toBe("http_1");

    const ghostEdges = createGhostEndEdges(terminals, END_NODE_ID);
    expect(ghostEdges).toHaveLength(1);
    expect(ghostEdges[0].source).toBe("http_1");
    expect(ghostEdges[0].target).toBe(END_NODE_ID);
    expect(ghostEdges[0].style.strokeDasharray).toBe("5 5");
  });

  it("identifies multiple branch leaves as terminal nodes", () => {
    const nodes = [
      { id: START_NODE_ID, type: "startFlag", position: { x: 0, y: 0 }, data: { name: "Start" } },
      { id: "switch_1", type: "SWITCH_ACTION", position: { x: 0, y: 100 }, data: { name: "Switch" } },
      { id: "branch_a", type: "HTTP_ACTION", position: { x: -100, y: 200 }, data: { name: "Branch A" } },
      { id: "branch_b", type: "DATABASE_ACTION", position: { x: 100, y: 200 }, data: { name: "Branch B" } },
      { id: END_NODE_ID, type: "endFlag", position: { x: 0, y: 300 }, data: { name: "End" } },
    ];
    const edges = [
      { id: "e1", source: START_NODE_ID, target: "switch_1" },
      { id: "e2", source: "switch_1", target: "branch_a" },
      { id: "e3", source: "switch_1", target: "branch_b" },
    ];

    const terminals = getTerminalNodes(nodes, edges);
    expect(terminals).toHaveLength(2);
    const terminalIds = terminals.map((t) => t.id);
    expect(terminalIds).toContain("branch_a");
    expect(terminalIds).toContain("branch_b");

    const ghostEdges = createGhostEndEdges(terminals, END_NODE_ID);
    expect(ghostEdges).toHaveLength(2);
    expect(ghostEdges.every((ge) => ge.target === END_NODE_ID)).toBe(true);
  });

  it("identifies explicit TERMINATE action as terminal even if it has no outgoing edges", () => {
    const nodes = [
      { id: START_NODE_ID, type: "startFlag", position: { x: 0, y: 0 }, data: { name: "Start" } },
      { id: "task_1", type: "HTTP_ACTION", position: { x: 0, y: 100 }, data: { name: "HTTP" } },
      { id: "term_1", type: "TERMINATE", position: { x: 0, y: 200 }, data: { name: "Terminate" } },
      { id: END_NODE_ID, type: "endFlag", position: { x: 0, y: 300 }, data: { name: "End" } },
    ];
    const edges = [
      { id: "e1", source: START_NODE_ID, target: "task_1" },
      { id: "e2", source: "task_1", target: "term_1" },
    ];

    const terminals = getTerminalNodes(nodes, edges);
    expect(terminals).toHaveLength(1);
    expect(terminals[0].id).toBe("term_1");
  });
});
