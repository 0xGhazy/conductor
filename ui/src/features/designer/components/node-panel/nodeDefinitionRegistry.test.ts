import { describe, it, expect } from "vitest";
import {
  nodeDefinitionRegistry,
  getNodeDefinition,
  registerNodeDefinition,
} from "./nodeDefinitionRegistry";
import { StartNodeDefinition } from "./definitions/start";
import { HttpNodeDefinition } from "./definitions/http";
import { DatabaseNodeDefinition } from "./definitions/database";
import { ScriptNodeDefinition } from "./definitions/script";
import { SwitchNodeDefinition } from "./definitions/switch";
import { WorkflowNodeDefinition } from "./definitions/workflow";
import type { WeaverNodeDefinition } from "./nodeDefinition.types";

describe("nodeDefinitionRegistry", () => {
  it("resolves START node definition for 'START' type and startFlag", () => {
    expect(getNodeDefinition("START")).toBe(StartNodeDefinition);
    expect(getNodeDefinition("startFlag")).toBe(StartNodeDefinition);
    expect(
      getNodeDefinition({
        id: "start",
        type: "startFlag",
        position: { x: 0, y: 0 },
        data: { name: "Start" },
      })
    ).toBe(StartNodeDefinition);
  });

  it("resolves HTTP node definition", () => {
    expect(getNodeDefinition("HTTP_ACTION")).toBe(HttpNodeDefinition);
    expect(getNodeDefinition("httpAction")).toBe(HttpNodeDefinition);
    expect(
      getNodeDefinition({
        id: "node-1",
        type: "HTTP_ACTION",
        position: { x: 100, y: 100 },
        data: { name: "HTTP", config: { method: "GET", url: "https://example.com" } },
      })
    ).toBe(HttpNodeDefinition);
  });

  it("resolves DATABASE node definition", () => {
    expect(getNodeDefinition("DATABASE_ACTION")).toBe(DatabaseNodeDefinition);
    expect(getNodeDefinition("databaseAction")).toBe(DatabaseNodeDefinition);
  });

  it("resolves SCRIPT node definition", () => {
    expect(getNodeDefinition("SCRIPT_ACTION")).toBe(ScriptNodeDefinition);
    expect(getNodeDefinition("scriptAction")).toBe(ScriptNodeDefinition);
    expect(getNodeDefinition("JEXL_ACTION")).toBe(ScriptNodeDefinition);
  });

  it("resolves SWITCH node definition", () => {
    expect(getNodeDefinition("SWITCH_ACTION")).toBe(SwitchNodeDefinition);
    expect(getNodeDefinition("switchAction")).toBe(SwitchNodeDefinition);
  });

  it("returns undefined for unrecognized node types", () => {
    expect(getNodeDefinition("UNKNOWN_TYPE_XYZ")).toBeUndefined();
    expect(getNodeDefinition(null)).toBeUndefined();
  });

  it("registers future custom node definitions dynamically", () => {
    const customDef: WeaverNodeDefinition = {
      type: "CUSTOM_WEBHOOK_NODE",
      label: "Custom Webhook",
      tabs: [
        { id: "configuration", label: "Configuration", render: "configuration" },
        { id: "json", label: "JSON", render: "json" },
      ],
    };

    registerNodeDefinition(customDef);
    expect(getNodeDefinition("CUSTOM_WEBHOOK_NODE")).toBe(customDef);
  });

  it("verifies START definition defines Configuration and JSON tabs only", () => {
    const tabIds = StartNodeDefinition.tabs.map((t) => t.id);
    expect(tabIds).toEqual(["configuration", "json"]);
  });

  it("verifies HTTP definition defines Configuration, JSON, Result, and Logs tabs", () => {
    const tabIds = HttpNodeDefinition.tabs.map((t) => t.id);
    expect(tabIds).toEqual(["configuration", "json", "result", "logs"]);
  });

  it("verifies SWITCH definition defines Configuration, JSON, and Result tabs", () => {
    const tabIds = SwitchNodeDefinition.tabs.map((t) => t.id);
    expect(tabIds).toEqual(["configuration", "json", "result"]);
  });

  it("resolves WORKFLOW node definition for canonical types", () => {
    expect(getNodeDefinition("WORKFLOW")).toBe(WorkflowNodeDefinition);
    expect(getNodeDefinition("workflow")).toBe(WorkflowNodeDefinition);
    expect(getNodeDefinition("SUB_WORKFLOW")).toBe(WorkflowNodeDefinition);
    expect(getNodeDefinition("sub_workflow")).toBe(WorkflowNodeDefinition);
    expect(getNodeDefinition("subworkflow")).toBe(WorkflowNodeDefinition);
    expect(getNodeDefinition("SUBWORKFLOW_ACTION")).toBe(WorkflowNodeDefinition);
    expect(
      getNodeDefinition({
        id: "wf-1",
        type: "WORKFLOW",
        position: { x: 50, y: 50 },
        data: { name: "Workflow", kind: "subworkflow" },
      })
    ).toBe(WorkflowNodeDefinition);
  });

  it("verifies WORKFLOW definition defines exactly Configurations, JSON, and Output tabs without Logs", () => {
    expect(WorkflowNodeDefinition.label).toBe("Workflow");
    expect(WorkflowNodeDefinition.defaultTab).toBe("configuration");
    const tabIds = WorkflowNodeDefinition.tabs.map((t) => t.id);
    expect(tabIds).toEqual(["configuration", "json", "output"]);

    const tabLabels = WorkflowNodeDefinition.tabs.map((t) => t.label);
    expect(tabLabels).toEqual(["Configurations", "JSON", "Output"]);

    const tabRenders = WorkflowNodeDefinition.tabs.map((t) => t.render);
    expect(tabRenders).toEqual(["configuration", "json", "result"]);

    expect(tabIds).not.toContain("logs");
  });
});
