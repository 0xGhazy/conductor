import { describe, it, expect } from "vitest";
import {
  calculateWorkflowDiff,
  extractFieldDiffs,
  formatDiffValue,
  getNodeMatchKey,
} from "./workflowDiffUtils";

describe("workflowDiffUtils", () => {
  describe("getNodeMatchKey", () => {
    it("identifies start and end nodes reliably", () => {
      expect(getNodeMatchKey({ id: "start" })).toBe("__start_node__");
      expect(getNodeMatchKey({ id: "end" })).toBe("__end_node__");
    });

    it("prefers taskReferenceName for task nodes", () => {
      expect(
        getNodeMatchKey({
          id: "node-uuid-1",
          data: { config: { taskReferenceName: "fetch_user_profile" } },
        })
      ).toBe("fetch_user_profile");
    });

    it("falls back to node id if no taskReferenceName", () => {
      expect(getNodeMatchKey({ id: "fallback-id", data: {} })).toBe("fallback-id");
    });
  });

  describe("extractFieldDiffs", () => {
    it("returns empty diff for identical objects", () => {
      const obj = { url: "https://api.example.com", method: "GET" };
      expect(extractFieldDiffs(obj, obj)).toEqual([]);
    });

    it("detects added, removed, and modified properties", () => {
      const base = {
        method: "GET",
        timeout: 3000,
        headers: { "Content-Type": "application/json" },
      };
      const target = {
        method: "POST",
        retries: 3,
        headers: { "Content-Type": "text/xml" },
      };

      const diffs = extractFieldDiffs(base, target);

      const modifiedMethod = diffs.find((d) => d.path === "method");
      expect(modifiedMethod).toEqual({
        key: "method",
        path: "method",
        oldValue: "GET",
        newValue: "POST",
        status: "modified",
      });

      const removedTimeout = diffs.find((d) => d.path === "timeout");
      expect(removedTimeout).toEqual({
        key: "timeout",
        path: "timeout",
        oldValue: 3000,
        newValue: undefined,
        status: "removed",
      });

      const addedRetries = diffs.find((d) => d.path === "retries");
      expect(addedRetries).toEqual({
        key: "retries",
        path: "retries",
        oldValue: undefined,
        newValue: 3,
        status: "added",
      });

      const nestedHeader = diffs.find((d) => d.path === "headers.Content-Type");
      expect(nestedHeader).toEqual({
        key: "Content-Type",
        path: "headers.Content-Type",
        oldValue: "application/json",
        newValue: "text/xml",
        status: "modified",
      });
    });
  });

  describe("calculateWorkflowDiff", () => {
    it("reports zero changes for identical workflow topologies", () => {
      const nodes = [
        { id: "start", type: "start" },
        {
          id: "task-1",
          type: "HTTP_ACTION",
          data: { config: { taskReferenceName: "http_1", url: "https://api.com" } },
        },
        { id: "end", type: "end" },
      ];
      const edges = [
        { id: "e1", source: "start", target: "task-1" },
        { id: "e2", source: "task-1", target: "end" },
      ];

      const diff = calculateWorkflowDiff(nodes, edges, nodes, edges);

      expect(diff.summary.hasChanges).toBe(false);
      expect(diff.summary.addedNodes).toBe(0);
      expect(diff.summary.removedNodes).toBe(0);
      expect(diff.summary.modifiedNodes).toBe(0);
      expect(diff.summary.unchangedNodes).toBe(3);
    });

    it("detects added node and new edges in target", () => {
      const baseNodes = [
        { id: "start", type: "start" },
        { id: "end", type: "end" },
      ];
      const baseEdges = [{ id: "e1", source: "start", target: "end" }];

      const targetNodes = [
        { id: "start", type: "start" },
        {
          id: "task-new",
          type: "HTTP_ACTION",
          data: { config: { taskReferenceName: "new_http", url: "https://new.com" } },
        },
        { id: "end", type: "end" },
      ];
      const targetEdges = [
        { id: "e1", source: "start", target: "task-new" },
        { id: "e2", source: "task-new", target: "end" },
      ];

      const diff = calculateWorkflowDiff(baseNodes, baseEdges, targetNodes, targetEdges);

      expect(diff.summary.hasChanges).toBe(true);
      expect(diff.summary.addedNodes).toBe(1);
      expect(diff.summary.removedNodes).toBe(0);
      expect(diff.summary.modifiedNodes).toBe(0);
      expect(diff.summary.addedEdges).toBe(2);
      expect(diff.summary.removedEdges).toBe(1);

      const addedNodeDecorated = diff.targetNodesDecorated.find(
        (n) => n.id === "task-new"
      );
      expect(addedNodeDecorated?.data.diffStatus).toBe("added");
    });

    it("detects modified node configuration and populates parameter diffs", () => {
      const baseNodes = [
        {
          id: "task-1",
          type: "HTTP_ACTION",
          data: { config: { taskReferenceName: "http_1", method: "GET" } },
        },
      ];
      const targetNodes = [
        {
          id: "task-1",
          type: "HTTP_ACTION",
          data: { config: { taskReferenceName: "http_1", method: "POST" } },
        },
      ];

      const diff = calculateWorkflowDiff(baseNodes, [], targetNodes, []);

      expect(diff.summary.modifiedNodes).toBe(1);
      expect(diff.summary.totalNodeChanges).toBe(1);

      const nodeDiff = diff.nodeDiffs.get("http_1");
      expect(nodeDiff?.status).toBe("modified");
      expect(nodeDiff?.parameterDiffs.length).toBe(1);
      expect(nodeDiff?.parameterDiffs[0].key).toBe("method");
      expect(nodeDiff?.parameterDiffs[0].oldValue).toBe("GET");
      expect(nodeDiff?.parameterDiffs[0].newValue).toBe("POST");
    });
  });

  describe("formatDiffValue", () => {
    it("formats primitives and objects cleanly", () => {
      expect(formatDiffValue(undefined)).toBe("—");
      expect(formatDiffValue(null)).toBe("null");
      expect(formatDiffValue(true)).toBe("true");
      expect(formatDiffValue(false)).toBe("false");
      expect(formatDiffValue("hello")).toBe("hello");
      expect(formatDiffValue({ a: 1 })).toBe('{\n  "a": 1\n}');
    });
  });
});
