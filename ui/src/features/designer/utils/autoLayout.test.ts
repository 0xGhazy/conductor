import { describe, it, expect, beforeEach } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  calculateAutoLayout,
  getStoredLayoutDirection,
  setStoredLayoutDirection,
} from "./autoLayout";

describe("calculateAutoLayout", () => {
  const sampleNodes: Node[] = [
    {
      id: "workflow-entry-point",
      type: "START",
      position: { x: 0, y: 0 },
      data: {},
    },
    {
      id: "http_1",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: {},
    },
    {
      id: "db_1",
      type: "DATABASE_ACTION",
      position: { x: 0, y: 0 },
      data: {},
    },
  ];

  const sampleEdges: Edge[] = [
    { id: "e1", source: "workflow-entry-point", target: "http_1" },
    { id: "e2", source: "http_1", target: "db_1" },
  ];

  it("arranges nodes vertically in TB direction", () => {
    const { nodes } = calculateAutoLayout(sampleNodes, sampleEdges, {
      direction: "TB",
    });

    expect(nodes).toHaveLength(3);

    const startNode = nodes.find((n) => n.id === "workflow-entry-point")!;
    const httpNode = nodes.find((n) => n.id === "http_1")!;
    const dbNode = nodes.find((n) => n.id === "db_1")!;

    // In TB direction, start node y < httpNode y < dbNode y
    expect(startNode.position.y).toBeLessThan(httpNode.position.y);
    expect(httpNode.position.y).toBeLessThan(dbNode.position.y);
  });

  it("arranges nodes horizontally in LR direction", () => {
    const { nodes } = calculateAutoLayout(sampleNodes, sampleEdges, {
      direction: "LR",
    });

    expect(nodes).toHaveLength(3);

    const startNode = nodes.find((n) => n.id === "workflow-entry-point")!;
    const httpNode = nodes.find((n) => n.id === "http_1")!;
    const dbNode = nodes.find((n) => n.id === "db_1")!;

    // In LR direction, start node x < httpNode x < dbNode x
    expect(startNode.position.x).toBeLessThan(httpNode.position.x);
    expect(httpNode.position.x).toBeLessThan(dbNode.position.x);
  });

  it("arranges End node below terminal nodes in TB direction", () => {
    const nodesWithEnd: Node[] = [
      ...sampleNodes,
      {
        id: "end",
        type: "endFlag",
        position: { x: 0, y: 0 },
        data: { name: "End" },
      },
    ];

    const { nodes } = calculateAutoLayout(nodesWithEnd, sampleEdges, {
      direction: "TB",
    });

    const dbNode = nodes.find((n) => n.id === "db_1")!;
    const endNode = nodes.find((n) => n.id === "end")!;

    expect(dbNode.position.y).toBeLessThan(endNode.position.y);
  });

  it("arranges End node to the right of terminal nodes in LR direction", () => {
    const nodesWithEnd: Node[] = [
      ...sampleNodes,
      {
        id: "end",
        type: "endFlag",
        position: { x: 0, y: 0 },
        data: { name: "End" },
      },
    ];

    const { nodes } = calculateAutoLayout(nodesWithEnd, sampleEdges, {
      direction: "LR",
    });

    const dbNode = nodes.find((n) => n.id === "db_1")!;
    const endNode = nodes.find((n) => n.id === "end")!;

    expect(dbNode.position.x).toBeLessThan(endNode.position.x);
  });

  describe.each(["TB", "LR"] as const)("End node placement with branches (%s)", (direction) => {
    // Mirrors the screenshot shape: a switch whose short branches end early while one
    // branch continues several layers deeper.
    const branchNodes: Node[] = [
      { id: "workflow-entry-point", type: "START", position: { x: 0, y: 0 }, data: {} },
      { id: "validate", type: "JEXL_ACTION", position: { x: 0, y: 0 }, data: {} },
      {
        id: "switch_1",
        type: "SWITCH_ACTION",
        position: { x: 0, y: 0 },
        data: { config: { cases: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] } },
      },
      { id: "respond_a", type: "RESPOND_ACTION", position: { x: 0, y: 0 }, data: {} },
      { id: "respond_b", type: "RESPOND_ACTION", position: { x: 0, y: 0 }, data: {} },
      { id: "respond_c", type: "RESPOND_ACTION", position: { x: 0, y: 0 }, data: {} },
      { id: "fetch", type: "DATABASE_ACTION", position: { x: 0, y: 0 }, data: {} },
      { id: "check", type: "JEXL_ACTION", position: { x: 0, y: 0 }, data: {} },
      { id: "respond_deep", type: "RESPOND_ACTION", position: { x: 0, y: 0 }, data: {} },
      { id: "end", type: "endFlag", position: { x: 9999, y: -9999 }, data: { name: "End" } },
    ];
    const branchEdges: Edge[] = [
      { id: "e1", source: "workflow-entry-point", target: "validate" },
      { id: "e2", source: "validate", target: "switch_1" },
      { id: "e3", source: "switch_1", sourceHandle: "c1", target: "respond_a" },
      { id: "e4", source: "switch_1", sourceHandle: "c2", target: "fetch" },
      { id: "e5", source: "switch_1", sourceHandle: "c3", target: "respond_b" },
      { id: "e6", source: "switch_1", sourceHandle: "default", target: "respond_c" },
      { id: "e7", source: "fetch", target: "check" },
      { id: "e8", source: "check", target: "respond_deep" },
    ];
    const terminalIds = ["respond_a", "respond_b", "respond_c", "respond_deep"];
    const ghostEdges: Edge[] = terminalIds.map((id) => ({
      id: `ghost-edge-${id}-end`,
      source: id,
      target: "end",
      targetHandle: "end-entry-point",
      data: { isGhost: true },
    }));

    const isLR = direction === "LR";
    const mainStart = (n: Node) => (isLR ? n.position.x : n.position.y);
    const crossStart = (n: Node) => (isLR ? n.position.y : n.position.x);
    const positionsOf = (nodes: Node[]) =>
      Object.fromEntries(nodes.map((n) => [n.id, n.position]));

    it("places End one layer past the deepest node, within the graph's cross extent", () => {
      const { nodes } = calculateAutoLayout(branchNodes, branchEdges, { direction });
      const end = nodes.find((n) => n.id === "end")!;
      const others = nodes.filter((n) => n.id !== "end");

      const deepest = Math.max(...others.map(mainStart));
      expect(mainStart(end)).toBeGreaterThan(deepest);
      // One layer past the deepest node, not pushed far away.
      expect(mainStart(end) - deepest).toBeLessThan(300);

      const crossMin = Math.min(...others.map(crossStart));
      const crossMax = Math.max(...others.map(crossStart));
      expect(crossStart(end)).toBeGreaterThanOrEqual(crossMin - 100);
      expect(crossStart(end)).toBeLessThanOrEqual(crossMax + 300);
    });

    it("produces the same layout whether or not ghost edges are passed in", () => {
      const withoutGhosts = calculateAutoLayout(branchNodes, branchEdges, { direction });
      const withGhosts = calculateAutoLayout(branchNodes, [...branchEdges, ...ghostEdges], {
        direction,
      });
      expect(positionsOf(withGhosts.nodes)).toEqual(positionsOf(withoutGhosts.nodes));
      // Ghost edges are handed back untouched for rendering.
      expect(withGhosts.edges.filter((e) => e.target === "end")).toHaveLength(ghostEdges.length);
    });

    it("does not let End widen the rest of the graph", () => {
      const withoutEnd = calculateAutoLayout(
        branchNodes.filter((n) => n.id !== "end"),
        branchEdges,
        { direction }
      );
      const withEnd = calculateAutoLayout(branchNodes, [...branchEdges, ...ghostEdges], {
        direction,
      });
      const { end: _end, ...rest } = positionsOf(withEnd.nodes);
      expect(rest).toEqual(positionsOf(withoutEnd.nodes));
    });
  });

  it("handles empty nodes gracefully", () => {
    const { nodes, edges } = calculateAutoLayout([], []);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it("handles nodes without edges", () => {
    const isolatedNodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: {} },
      { id: "n2", position: { x: 0, y: 0 }, data: {} },
    ];

    const { nodes } = calculateAutoLayout(isolatedNodes, [], { direction: "TB" });
    expect(nodes).toHaveLength(2);
    expect(nodes[0].position).toBeDefined();
    expect(nodes[1].position).toBeDefined();
  });

  it("arranges switch branch nodes in left-to-right order matching switch handles", () => {
    const switchNodes: Node[] = [
      {
        id: "switch_1",
        type: "SWITCH_ACTION",
        position: { x: 0, y: 0 },
        data: {
          config: {
            cases: [
              { id: "c1", label: "Case 1" },
              { id: "c2", label: "Case 2" },
              { id: "c3", label: "Case 3" },
            ],
          },
        },
      },
      { id: "target_c1", position: { x: 0, y: 0 }, data: {} },
      { id: "target_c2", position: { x: 0, y: 0 }, data: {} },
      { id: "target_c3", position: { x: 0, y: 0 }, data: {} },
      { id: "target_def", position: { x: 0, y: 0 }, data: {} },
    ];

    const switchEdges: Edge[] = [
      { id: "e_c1", source: "switch_1", sourceHandle: "c1", target: "target_c1" },
      { id: "e_c2", source: "switch_1", sourceHandle: "c2", target: "target_c2" },
      { id: "e_c3", source: "switch_1", sourceHandle: "c3", target: "target_c3" },
      { id: "e_def", source: "switch_1", sourceHandle: "default", target: "target_def" },
    ];

    const { nodes } = calculateAutoLayout(switchNodes, switchEdges, { direction: "TB" });
    const posC1 = nodes.find((n) => n.id === "target_c1")!.position.x;
    const posC2 = nodes.find((n) => n.id === "target_c2")!.position.x;
    const posC3 = nodes.find((n) => n.id === "target_c3")!.position.x;
    const posDef = nodes.find((n) => n.id === "target_def")!.position.x;

    expect(posC1).toBeLessThan(posC2);
    expect(posC2).toBeLessThan(posC3);
    expect(posC3).toBeLessThan(posDef);
  });

  it("handles user workflow screenshot with sub-pipelines without mesh crossings", () => {
    // Exactly reproducing the user's scenario:
    // Switch handles from left to right: Case 3, Case 2, Case 1, default
    // Targets:
    // Case 3 -> rule_engine -> respond
    // default -> query
    // Case 2 -> terminate
    // Case 1 -> redis
    const userNodes: Node[] = [
      {
        id: "switch_k1lgt8iu",
        type: "SWITCH_ACTION",
        position: { x: 0, y: 0 },
        data: {
          config: {
            cases: [
              { id: "case_3", value: "case3", label: "Case 3" },
              { id: "case_2", value: "case2", label: "Case 2" },
              { id: "case_1", value: "case1", label: "Case 1" },
            ],
          },
        },
      },
      { id: "terminate_aak4sph4", position: { x: 0, y: 0 }, data: {} },
      { id: "redis_eqkxbl9", position: { x: 0, y: 0 }, data: {} },
      { id: "database_query_jmrthkcr", position: { x: 0, y: 0 }, data: {} },
      { id: "rule_wc5fq5nr", position: { x: 0, y: 0 }, data: {} },
      { id: "respond_nmlmrnp4", position: { x: 0, y: 0 }, data: {} },
    ];

    const userEdges: Edge[] = [
      {
        id: "e_rule",
        source: "switch_k1lgt8iu",
        sourceHandle: "case_3",
        target: "rule_wc5fq5nr",
      },
      {
        id: "e_respond",
        source: "rule_wc5fq5nr",
        target: "respond_nmlmrnp4",
      },
      {
        id: "e_term",
        source: "switch_k1lgt8iu",
        sourceHandle: "case_2",
        target: "terminate_aak4sph4",
      },
      {
        id: "e_redis",
        source: "switch_k1lgt8iu",
        sourceHandle: "case_1",
        target: "redis_eqkxbl9",
      },
      {
        id: "e_def",
        source: "switch_k1lgt8iu",
        sourceHandle: "default",
        target: "database_query_jmrthkcr",
      },
    ];

    const { nodes } = calculateAutoLayout(userNodes, userEdges, { direction: "TB" });

    const posRule = nodes.find((n) => n.id === "rule_wc5fq5nr")!.position;
    const posRespond = nodes.find((n) => n.id === "respond_nmlmrnp4")!.position;
    const posTerm = nodes.find((n) => n.id === "terminate_aak4sph4")!.position;
    const posRedis = nodes.find((n) => n.id === "redis_eqkxbl9")!.position;
    const posQuery = nodes.find((n) => n.id === "database_query_jmrthkcr")!.position;

    // Handles on switch are: case_3 (index 0), case_2 (index 1), case_1 (index 2), default (index 3)
    // Downstream columns must be strictly ordered:
    // Case 3 (rule) < Case 2 (terminate) < Case 1 (redis) < default (query)
    expect(posRule.x).toBeLessThan(posTerm.x);
    expect(posTerm.x).toBeLessThan(posRedis.x);
    expect(posRedis.x).toBeLessThan(posQuery.x);

    // And sub-pipeline: respond is in the same column under rule_wc5fq5nr
    expect(posRespond.x).toBe(posRule.x);
    expect(posRespond.y).toBeGreaterThan(posRule.y);
  });

  it("arranges switch branch nodes in top-to-bottom order for LR direction", () => {
    const switchNodes: Node[] = [
      {
        id: "switch_1",
        type: "SWITCH_ACTION",
        position: { x: 0, y: 0 },
        data: {
          config: {
            cases: [
              { id: "c1", label: "Case 1" },
              { id: "c2", label: "Case 2" },
            ],
          },
        },
      },
      { id: "t_c1", position: { x: 0, y: 0 }, data: {} },
      { id: "t_c2", position: { x: 0, y: 0 }, data: {} },
      { id: "t_def", position: { x: 0, y: 0 }, data: {} },
    ];

    const switchEdges: Edge[] = [
      { id: "e1", source: "switch_1", sourceHandle: "c1", target: "t_c1" },
      { id: "e2", source: "switch_1", sourceHandle: "c2", target: "t_c2" },
      { id: "e3", source: "switch_1", sourceHandle: "default", target: "t_def" },
    ];

    const { nodes } = calculateAutoLayout(switchNodes, switchEdges, { direction: "LR" });
    const posC1 = nodes.find((n) => n.id === "t_c1")!.position.y;
    const posC2 = nodes.find((n) => n.id === "t_c2")!.position.y;
    const posDef = nodes.find((n) => n.id === "t_def")!.position.y;

    expect(posC1).toBeLessThan(posC2);
    expect(posC2).toBeLessThan(posDef);
  });

  it("arranges ForEach loop body to the left of next action", () => {
    const forEachNodes: Node[] = [
      { id: "foreach_1", type: "FOREACH_ACTION", position: { x: 0, y: 0 }, data: {} },
      { id: "body_node", position: { x: 0, y: 0 }, data: {} },
      { id: "next_node", position: { x: 0, y: 0 }, data: {} },
    ];

    const forEachEdges: Edge[] = [
      { id: "e_body", source: "foreach_1", sourceHandle: "loopBody", target: "body_node" },
      { id: "e_next", source: "foreach_1", sourceHandle: "next", target: "next_node" },
    ];

    const { nodes } = calculateAutoLayout(forEachNodes, forEachEdges, { direction: "TB" });
    const posBody = nodes.find((n) => n.id === "body_node")!.position.x;
    const posNext = nodes.find((n) => n.id === "next_node")!.position.x;

    expect(posBody).toBeLessThan(posNext);
  });

  describe("Layout direction localStorage helpers", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("defaults to TB when localStorage is empty", () => {
      expect(getStoredLayoutDirection()).toBe("TB");
    });

    it("reads and writes stored direction correctly", () => {
      setStoredLayoutDirection("LR");
      expect(localStorage.getItem("weaver_layout_direction")).toBe("LR");
      expect(getStoredLayoutDirection()).toBe("LR");

      setStoredLayoutDirection("TB");
      expect(localStorage.getItem("weaver_layout_direction")).toBe("TB");
      expect(getStoredLayoutDirection()).toBe("TB");
    });
  });
});
