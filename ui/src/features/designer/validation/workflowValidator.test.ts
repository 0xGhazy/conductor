import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./workflowValidator";
import { START_NODE_ID } from "@/features/designer/constants/workflowNodes";

describe("Workflow Validator Engine", () => {
  const baseStartNode = {
    id: START_NODE_ID,
    type: "startFlag",
    data: { name: "Start" },
    position: { x: 100, y: 100 },
  };

  it("validates a completely valid workflow with 0 errors", () => {
    const validHttpNode = {
      id: "node-http-1",
      type: "HTTP_ACTION",
      data: {
        name: "fetch_user",
        config: {
          referenceName: "fetch_user",
          url: "https://api.example.com/user",
          method: "GET",
        },
      },
      position: { x: 100, y: 200 },
    };

    const edge = {
      id: "edge-1",
      source: START_NODE_ID,
      target: "node-http-1",
    };

    const result = validateWorkflow({
      nodes: [baseStartNode, validHttpNode],
      edges: [edge],
      workflowName: "test_valid_wf",
      workflowVersion: 1,
    });

    expect(result.summary.isValid).toBe(true);
    expect(result.summary.errors).toBe(0);
    expect(result.issues.length).toBe(0);
  });

  describe("Category A: Workflow Structure", () => {
    it("reports error when workflow name is missing", () => {
      const result = validateWorkflow({
        nodes: [baseStartNode],
        edges: [],
        workflowName: "",
      });

      expect(result.summary.isValid).toBe(false);
      expect(result.issues.some((i) => i.code === "WF_NAME_REQUIRED")).toBe(true);
    });

    it("reports error when Start node is missing", () => {
      const result = validateWorkflow({
        nodes: [],
        edges: [],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "WF_MISSING_START")).toBe(true);
    });

    it("detects duplicate node IDs", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "dup-id", type: "HTTP_ACTION", data: { name: "node1", config: { referenceName: "node1", url: "https://example.com" } } },
          { id: "dup-id", type: "HTTP_ACTION", data: { name: "node2", config: { referenceName: "node2", url: "https://example.com" } } },
        ],
        edges: [],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "DUPLICATE_NODE_ID")).toBe(true);
    });

    it("detects duplicate task reference names", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "node-1", type: "HTTP_ACTION", data: { config: { referenceName: "shared_ref", url: "https://a.com" } } },
          { id: "node-2", type: "HTTP_ACTION", data: { config: { referenceName: "shared_ref", url: "https://b.com" } } },
        ],
        edges: [],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "DUPLICATE_TASK_REF_NAME")).toBe(true);
    });

    it("detects completely disconnected nodes", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "isolated-node", type: "HTTP_ACTION", data: { config: { referenceName: "isolated", url: "https://a.com" } } },
        ],
        edges: [],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "NODE_DISCONNECTED")).toBe(true);
    });

    it("detects self-loop connection", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "loop-node", type: "HTTP_ACTION", data: { config: { referenceName: "loop_node", url: "https://a.com" } } },
        ],
        edges: [
          { id: "e1", source: START_NODE_ID, target: "loop-node" },
          { id: "e-self", source: "loop-node", target: "loop-node" },
        ],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "EDGE_SELF_LOOP")).toBe(true);
    });

    it("detects edges targeting nonexistent nodes", () => {
      const result = validateWorkflow({
        nodes: [baseStartNode],
        edges: [{ id: "e1", source: START_NODE_ID, target: "non-existent-node" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "EDGE_TARGET_NOT_FOUND")).toBe(true);
    });
  });

  describe("Category B & D: Node Configuration & Node Specifics", () => {
    it("reports error when HTTP node is missing request URL", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "http-node", type: "HTTP_ACTION", data: { config: { referenceName: "http_step", url: "" } } },
        ],
        edges: [{ id: "e1", source: START_NODE_ID, target: "http-node" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "HTTP_URL_REQUIRED")).toBe(true);
    });

    it("reports error for invalid task reference name pattern", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "node-bad-ref", type: "HTTP_ACTION", data: { config: { referenceName: "123 invalid-name!", url: "https://a.com" } } },
        ],
        edges: [{ id: "e1", source: START_NODE_ID, target: "node-bad-ref" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "NODE_INVALID_REF_NAME")).toBe(true);
    });

    it("reports error when Database node is missing datasource or query", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "db-node", type: "DATABASE_ACTION", data: { config: { referenceName: "db_step" } } },
        ],
        edges: [{ id: "e1", source: START_NODE_ID, target: "db-node" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "DB_DATASOURCE_REQUIRED")).toBe(true);
      expect(result.issues.some((i) => i.code === "DB_QUERY_REQUIRED")).toBe(true);
    });

    it("reports error when Script node has empty expression", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "script-node", type: "SCRIPT_ACTION", data: { config: { referenceName: "script_step", script: "" } } },
        ],
        edges: [{ id: "e1", source: START_NODE_ID, target: "script-node" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "SCRIPT_EMPTY")).toBe(true);
    });

    it("reports error when Switch node has no evaluation expression", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          { id: "switch-node", type: "SWITCH_ACTION", data: { config: { referenceName: "switch_step", expression: "" } } },
        ],
        edges: [{ id: "e1", source: START_NODE_ID, target: "switch-node" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "SWITCH_EXPRESSION_REQUIRED")).toBe(true);
    });
  });

  describe("Category C: Workflow References", () => {
    it("reports warning when referencing a nonexistent task output", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          {
            id: "node-1",
            type: "HTTP_ACTION",
            data: {
              config: {
                referenceName: "step_one",
                url: "https://api.example.com/${ghost_task.output.path}",
              },
            },
          },
        ],
        edges: [{ id: "e1", source: START_NODE_ID, target: "node-1" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "INVALID_TASK_REFERENCE")).toBe(true);
    });

    it("reports error on unclosed expression syntax", () => {
      const result = validateWorkflow({
        nodes: [
          baseStartNode,
          {
            id: "node-1",
            type: "HTTP_ACTION",
            data: {
              config: {
                referenceName: "step_one",
                url: "https://api.example.com/${unclosed_var",
              },
            },
          },
        ],
        edges: [{ id: "e1", source: START_NODE_ID, target: "node-1" }],
        workflowName: "my_wf",
      });

      expect(result.issues.some((i) => i.code === "EXPRESSION_SYNTAX_ERROR")).toBe(true);
    });
  });
});
