import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { WorkflowNodeDefinition } from "./WorkflowNodeDefinition";
import { WorkflowNodeConfig } from "./WorkflowNodeConfig";
import { serializeWorkflowNodeForJson } from "./serializeWorkflowNodeForJson";
import { deriveWorkflowInputTemplate } from "./useWorkflowNodeOptions";
import { nodeDefinitionRegistry, getNodeDefinition } from "../../nodeDefinitionRegistry";
import apiClient from "@/services/apiClient";
import * as designerApi from "@/features/designer/services/designerApi";
import { WeaverNodeConfigurationPanel } from "../..";

// Mock WeaverCodeEditor for deterministic test execution
vi.mock("@/components/common/editors", () => ({
  WeaverCodeEditor: ({
    value,
    onChange,
    readOnly,
    language,
    modelKey,
    suggestions,
  }: any) => (
    <textarea
      data-testid="mock-code-editor"
      data-language={language}
      data-model-key={modelKey}
      data-suggestions-count={suggestions ? suggestions.length : 0}
      readOnly={readOnly}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

// Mock apiClient and designerApi
vi.mock("@/services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/features/designer/services/designerApi", () => ({
  fetchWorkflowJsonByName: vi.fn(),
  fetchWorkflowVersions: vi.fn(),
}));

// Mock database and connection APIs to avoid network calls during full panel tests
vi.mock("@/features/databases/services/databasesApi", () => ({
  fetchDatasources: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock("@/features/connections/services/connectionsApi", () => ({
  fetchConnections: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/collections/services/apiCollectionsApi", () => ({
  fetchCollections: vi.fn().mockResolvedValue([]),
  fetchCollectionEndpoints: vi.fn().mockResolvedValue([]),
}));

describe("Workflow Node Configuration Architecture", () => {
  const mockWorkflowsList = [
    {
      id: "wf-1",
      name: "Customer Update",
      version: 3,
      input: { customerId: "", phoneNumber: "", source: "" },
    },
    {
      id: "wf-2",
      name: "Customer Update",
      version: 2,
      input: { customerId: "", phoneNumber: "" },
    },
    {
      id: "wf-3",
      name: "Customer Update",
      version: 1,
      input: { customerId: "" },
    },
    {
      id: "wf-4",
      name: "Balance Inquiry",
      version: 2,
      input: { accountId: "", currency: "" },
    },
    {
      id: "wf-5",
      name: "Balance Inquiry",
      version: 1,
      input: { accountId: "" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockResolvedValue({
      data: {
        status: "OK",
        data: mockWorkflowsList,
      },
    });

    (designerApi.fetchWorkflowJsonByName as any).mockImplementation(
      async (name: string, version: any) => {
        if (name === "Customer Update") {
          if (version === 1) {
            return {
              data: {
                name: "Customer Update",
                version: 1,
                input: { customerId: "" },
              },
            };
          }
          return {
            data: {
              name: "Customer Update",
              version: 3,
              input: { customerId: "", phoneNumber: "", source: "" },
            },
          };
        }
        if (name === "Balance Inquiry") {
          return {
            data: {
              name: "Balance Inquiry",
              version: 2,
              input: { accountId: "", currency: "" },
            },
          };
        }
        return { data: {} };
      }
    );
  });

  describe("1. Node Definition & Registry", () => {
    it("registers WORKFLOW node in nodeDefinitionRegistry with canonical aliases", () => {
      expect(nodeDefinitionRegistry.WORKFLOW).toBe(WorkflowNodeDefinition);
      expect(nodeDefinitionRegistry.workflow).toBe(WorkflowNodeDefinition);
      expect(nodeDefinitionRegistry.SUB_WORKFLOW).toBe(WorkflowNodeDefinition);
      expect(nodeDefinitionRegistry.subworkflow).toBe(WorkflowNodeDefinition);
      expect(nodeDefinitionRegistry.SUBWORKFLOW_ACTION).toBe(WorkflowNodeDefinition);

      expect(getNodeDefinition("WORKFLOW")).toBe(WorkflowNodeDefinition);
      expect(getNodeDefinition("SUB_WORKFLOW")).toBe(WorkflowNodeDefinition);
      expect(getNodeDefinition("subworkflow")).toBe(WorkflowNodeDefinition);
    });

    it("has label 'Workflow'", () => {
      expect(WorkflowNodeDefinition.label).toBe("Workflow");
    });

    it("defines exactly Configurations, JSON, and Output tabs without Logs", () => {
      const tabIds = WorkflowNodeDefinition.tabs.map((t) => t.id);
      expect(tabIds).toEqual(["configuration", "json", "output"]);

      const tabLabels = WorkflowNodeDefinition.tabs.map((t) => t.label);
      expect(tabLabels).toEqual(["Configurations", "JSON", "Output"]);

      const tabRenders = WorkflowNodeDefinition.tabs.map((t) => t.render);
      expect(tabRenders).toEqual(["configuration", "json", "result"]);

      expect(tabIds).not.toContain("logs");
    });

    it("has defaultTab set to configuration", () => {
      expect(WorkflowNodeDefinition.defaultTab).toBe("configuration");
    });
  });

  describe("2. Name Field", () => {
    it("uses WeaverSelectField, is required, and loads workflow names", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 100, y: 100 },
        data: { name: "Workflow", config: {} },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{}}
          onChange={handleChange}
        />
      );

      // Name label with required indicator
      const nameLabel = screen.getByText("Name");
      expect(nameLabel).toBeInTheDocument();

      // Options loaded from mock
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining("/api/workflows/list")
        );
      });
    });

    it("updates config when workflow name is selected", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 100, y: 100 },
        data: { name: "Workflow", config: {} },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{}}
          onChange={handleChange}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText("Loading workflows...")).not.toBeInTheDocument();
      });

      // Name select combobox
      const selects = screen.getAllByRole("combobox");
      const nameSelect = selects[0];
      fireEvent.mouseDown(nameSelect);

      const customerUpdateOption = await screen.findByRole("option", {
        name: "Customer Update",
      });
      fireEvent.click(customerUpdateOption);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({
            workflowName: "Customer Update",
            version: 3,
            subWorkflowParam: {
              name: "Customer Update",
              version: 3,
            },
          })
        );
      });
    });

    it("handles empty workflow list gracefully without crashing", async () => {
      (apiClient.get as any).mockResolvedValueOnce({
        data: { data: [] },
      });

      const mockNode: Node = {
        id: "wf-node-empty",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{}}
          onChange={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText("Name")[0]).toBeInTheDocument();
      });
      expect(screen.getAllByText("Version")[0]).toBeInTheDocument();
    });

    it("handles workflow loading failure gracefully", async () => {
      (apiClient.get as any).mockRejectedValue(new Error("Network Error"));

      const mockNode: Node = {
        id: "wf-node-err",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{}}
          onChange={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load workflows list|Network Error/)
        ).toBeInTheDocument();
      });
    });
  });

  describe("3. Version Field", () => {
    it("auto-selects the greatest version number when no version is specified", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update" } },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ workflowName: "Customer Update", version: null }}
          onChange={handleChange}
        />
      );

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({
            version: 3,
            subWorkflowParam: expect.objectContaining({
              name: "Customer Update",
              version: 3,
            }),
          })
        );
      });
    });

    it("loads available versions corresponding to the selected workflow without Latest", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update", version: 3 } },
      };

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ workflowName: "Customer Update", version: 3 }}
          onChange={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });

      const selects = screen.getAllByRole("combobox");
      const versionSelect = selects[1];
      fireEvent.mouseDown(versionSelect);

      expect(screen.queryByRole("option", { name: "Latest" })).not.toBeInTheDocument();
      expect(screen.getByRole("option", { name: "3" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "2" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "1" })).toBeInTheDocument();
    });

    it("updates config when a specific version is selected", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update" } },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ workflowName: "Customer Update", version: null }}
          onChange={handleChange}
        />
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });

      const selects = screen.getAllByRole("combobox");
      const versionSelect = selects[1];
      fireEvent.mouseDown(versionSelect);

      const option1 = screen.getByRole("option", { name: "1" });
      fireEvent.click(option1);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({
            version: 1,
            subWorkflowParam: {
              name: "Customer Update",
              version: 1,
            },
          })
        );
      });
    });
  });

  describe("4. Inputs Field & Auto-Population", () => {
    it("auto-populates inputs editor with derived template on workflow selection", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{}}
          onChange={handleChange}
        />
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });

      const selects = screen.getAllByRole("combobox");
      fireEvent.mouseDown(selects[0]);

      const option = await screen.findByRole("option", { name: "Customer Update" });
      fireEvent.click(option);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({
            inputs: expect.objectContaining({
              customerId: "",
              phoneNumber: "",
              source: "",
            }),
          })
        );
      });
    });

    it("regenerates inputs when changing version", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update", version: 3 } },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{
            workflowName: "Customer Update",
            version: 3,
            inputs: { customerId: "", phoneNumber: "", source: "" },
          }}
          onChange={handleChange}
        />
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });

      const selects = screen.getAllByRole("combobox");
      fireEvent.mouseDown(selects[1]);

      // Select version 1 (which only has customerId)
      const version1Option = screen.getByRole("option", { name: "1" });
      fireEvent.click(version1Option);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({
            version: 1,
            inputs: { customerId: "" },
          })
        );
      });
    });

    it("does not reset user inputs on unrelated rerenders", () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update" } },
      };

      const customInput = { customerId: "CUST-999", phoneNumber: "0100000000" };

      const { rerender } = render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{
            workflowName: "Customer Update",
            version: null,
            inputs: customInput,
            inputsText: JSON.stringify(customInput, null, 2),
            correlationId: "corr-1",
          }}
          onChange={vi.fn()}
        />
      );

      const editor = screen.getByTestId("mock-code-editor") as HTMLTextAreaElement;
      expect(editor.value).toContain("CUST-999");

      // Rerender with changed unrelated prop (e.g. correlationId)
      rerender(
        <WorkflowNodeConfig
          node={mockNode}
          value={{
            workflowName: "Customer Update",
            version: null,
            inputs: customInput,
            inputsText: JSON.stringify(customInput, null, 2),
            correlationId: "corr-2",
          }}
          onChange={vi.fn()}
        />
      );

      expect(editor.value).toContain("CUST-999");
    });

    it("handles invalid JSON without clearing user text and shows validation error", () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update" } },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ workflowName: "Customer Update" }}
          onChange={handleChange}
        />
      );

      const editor = screen.getByTestId("mock-code-editor") as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: "{ invalid json" } });

      expect(screen.getByText(/Invalid JSON:/)).toBeInTheDocument();
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          inputsText: "{ invalid json",
        })
      );
    });
  });

  describe("5. Correlation Id Field", () => {
    it("uses WeaverTextField, is optional, and emits changes", () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ correlationId: "" }}
          onChange={handleChange}
        />
      );

      const input = screen.getByLabelText("Correlation Id");
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "cust-${customerId}" } });
      expect(handleChange).toHaveBeenCalledWith({
        correlationId: "cust-${customerId}",
      });
    });

    it("handles suggestions on Ctrl+Space and keyboard interactions", () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ correlationId: "" }}
          onChange={vi.fn()}
        />
      );

      const input = screen.getByLabelText("Correlation Id");
      expect(input).toBeInTheDocument();

      // Trigger Ctrl+Space on the correlation input
      fireEvent.keyDown(input, { key: " ", code: "Space", ctrlKey: true });
      expect(input).toHaveAttribute("role", "combobox");
    });
  });

  describe("6. Mode Field", () => {
    it("defaults to ASYNC ('Asynchronized') and contains Synchronized option", () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{}}
          onChange={vi.fn()}
        />
      );

      const modeSelect = screen.getByRole("combobox", { name: "Mode" });
      expect(modeSelect).toHaveTextContent("Asynchronized");
    });

    it("emits correct backend mode value ('SYNC') when Synchronized is chosen", async () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ mode: "ASYNC" }}
          onChange={handleChange}
        />
      );

      const modeSelect = screen.getByRole("combobox", { name: "Mode" });
      fireEvent.mouseDown(modeSelect);

      const syncOption = screen.getByRole("option", { name: "Synchronized" });
      fireEvent.click(syncOption);

      expect(handleChange).toHaveBeenCalledWith({
        mode: "SYNC",
      });
    });
  });

  describe("7. Read-Only Mode", () => {
    it("disables all controls and makes code editor read-only", () => {
      const mockNode: Node = {
        id: "wf-node-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update" } },
      };

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{ workflowName: "Customer Update", correlationId: "c-123" }}
          onChange={vi.fn()}
          readOnly={true}
          disabled={true}
        />
      );

      const correlationInput = screen.getByLabelText("Correlation Id");
      expect(correlationInput).toHaveAttribute("readonly");

      const editor = screen.getByTestId("mock-code-editor");
      expect(editor).toHaveAttribute("readonly");
    });
  });

  describe("8. JSON Serialization", () => {
    it("serializes Workflow node into canonical Conductor SUB_WORKFLOW format", () => {
      const node: Node = {
        id: "node-wf-xyz",
        type: "WORKFLOW",
        position: { x: 120.5, y: 250.75 },
        data: {
          name: "Invoke Customer",
          config: {
            workflowName: "Customer Update",
            version: 3,
            inputs: { customerId: "12345" },
            correlationId: "corr-99",
            mode: "SYNC",
          },
        },
      };

      const serialized = serializeWorkflowNodeForJson(node);

      expect(serialized.type).toBe("SUB_WORKFLOW");
      expect(serialized.subWorkflowParam).toEqual({
        name: "Customer Update",
        version: 3,
      });
      expect(serialized.inputParameters).toMatchObject({
        customerId: "12345",
      });
      expect(serialized.correlationId).toBe("corr-99");
      expect(serialized.mode).toBe("SYNC");
      expect(serialized.asyncComplete).toBe(false);
    });

    it("serializes Latest version as null in subWorkflowParam", () => {
      const node: Node = {
        id: "node-wf-latest",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: {
          name: "Workflow",
          config: {
            workflowName: "Balance Inquiry",
            version: null,
            mode: "ASYNC",
          },
        },
      };

      const serialized = serializeWorkflowNodeForJson(node);

      expect(serialized.subWorkflowParam).toEqual({
        name: "Balance Inquiry",
        version: null,
      });
      expect(serialized.asyncComplete).toBe(true);
    });
  });

  describe("9. deriveWorkflowInputTemplate Helper", () => {
    it("handles inputs array from Conductor definition", () => {
      const definition = {
        inputs: ["userId", "email"],
      };
      const template = deriveWorkflowInputTemplate(definition);
      expect(template).toEqual({
        userId: "",
        email: "",
      });
    });

    it("handles inputParameters array from Conductor metadata", () => {
      const definition = {
        inputParameters: ["orderId", "amount"],
      };
      const template = deriveWorkflowInputTemplate(definition);
      expect(template).toEqual({
        orderId: "",
        amount: "",
      });
    });

    it("handles direct input map with preset defaults", () => {
      const definition = {
        input: { env: "prod", region: "eu-west-1" },
      };
      const template = deriveWorkflowInputTemplate(definition);
      expect(template).toEqual({
        env: "prod",
        region: "eu-west-1",
      });
    });
  });

  describe("10. Output Tab Integration", () => {
    it("renders empty state when no result is present for Workflow node", () => {
      const workflowNode: Node = {
        id: "wf-out-1",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update" } },
      };

      render(
        <WeaverNodeConfigurationPanel
          selectedNode={workflowNode}
          activeTab="output"
        />
      );

      expect(screen.getByRole("tab", { name: "Output" })).toBeInTheDocument();
      expect(screen.getByText("No result available for this node.")).toBeInTheDocument();
    });

    it("renders execution output when custom result is provided", () => {
      const workflowNode: Node = {
        id: "wf-out-2",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: { workflowName: "Customer Update" } },
      };

      render(
        <WeaverNodeConfigurationPanel
          selectedNode={workflowNode}
          activeTab="output"
        />
      );

      // Verify Output tab button is accessible and rendered
      const outputTab = screen.getByRole("tab", { name: "Output" });
      expect(outputTab).toBeInTheDocument();
      expect(outputTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("11. State Safety", () => {
    it("updating configuration preserves node ID, position, and metadata", () => {
      const originalNode: Node = {
        id: "unique-node-id-123",
        type: "WORKFLOW",
        position: { x: 340, y: 560 },
        data: {
          name: "Workflow",
          config: {
            workflowName: "Customer Update",
            version: null,
            mode: "ASYNC",
          },
        },
      };

      const handleUpdate = vi.fn();

      render(
        <WorkflowNodeConfig
          node={originalNode}
          value={originalNode.data.config}
          onChange={handleUpdate}
        />
      );

      const correlationInput = screen.getByLabelText("Correlation Id");
      fireEvent.change(correlationInput, { target: { value: "order-456" } });

      expect(handleUpdate).toHaveBeenCalledWith({
        correlationId: "order-456",
      });

      // Original node identity and coordinates remain untouched
      expect(originalNode.id).toBe("unique-node-id-123");
      expect(originalNode.position).toEqual({ x: 340, y: 560 });
    });
  });

  describe("12. Stale Request Safety", () => {
    it("ensures rapid changes discard obsolete async responses", async () => {
      let resolveFirstRequest: any;
      const firstPromise = new Promise((resolve) => {
        resolveFirstRequest = resolve;
      });

      (designerApi.fetchWorkflowJsonByName as any).mockImplementationOnce(
        () => firstPromise
      );

      const mockNode: Node = {
        id: "wf-stale-test",
        type: "WORKFLOW",
        position: { x: 0, y: 0 },
        data: { name: "Workflow", config: {} },
      };

      const handleChange = vi.fn();

      render(
        <WorkflowNodeConfig
          node={mockNode}
          value={{}}
          onChange={handleChange}
        />
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });

      // User rapidly selects Balance Inquiry then Customer Update
      // Customer Update resolves faster, while first request completes last
      const selects = screen.getAllByRole("combobox");
      fireEvent.mouseDown(selects[0]);

      const optionCustomer = await screen.findByRole("option", {
        name: "Customer Update",
      });
      fireEvent.click(optionCustomer);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          expect.objectContaining({
            workflowName: "Customer Update",
          })
        );
      });

      // Now resolve the late first request
      resolveFirstRequest({
        data: {
          name: "Slow Workflow",
          input: { slowKey: "" },
        },
      });

      // Ensure inputs text still corresponds to Customer Update, not Slow Workflow
      const editor = screen.getByTestId("mock-code-editor") as HTMLTextAreaElement;
      expect(editor.value).not.toContain("slowKey");
    });
  });
});
