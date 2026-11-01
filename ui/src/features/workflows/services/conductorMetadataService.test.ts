import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "@/services/apiClient";
import {
  fetchWorkflowJsonByName,
  saveWorkflow as designerSaveWorkflow,
  upsertNewWorkflowStructure,
} from "@/features/designer/services/designerApi";
import { extractWorkflowJsonDataFromResponse } from "@/features/designer/utils/workflowSerialization";
import {
  fetchWorkflowDetail,
  updateWorkflowDetail,
} from "@/features/workflows/services/workflowsService";

vi.mock("@/services/apiClient", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Conductor Workflow Metadata APIs Specification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("List workflows: GET http://localhost:8080/api/metadata/workflow", () => {
    it("fetches workflows from /api/metadata/workflow directly", async () => {
      const mockList = [
        { name: "sim_swap_wf", version: 1, description: "SIM Swap Flow", tasks: [] },
        { name: "test_flattened", version: 2, description: "Test Flow", tasks: [] },
      ];
      (apiClient.get as any).mockResolvedValueOnce({ data: mockList });

      const res = await apiClient.get("http://localhost:8080/api/metadata/workflow");
      expect(apiClient.get).toHaveBeenCalledWith("http://localhost:8080/api/metadata/workflow");
      expect(res.data).toEqual(mockList);
    });
  });

  describe("Delete workflow: DELETE http://localhost:8080/api/metadata/workflow/{name}/{version}", () => {
    it("deletes workflow with encoded name and version", async () => {
      (apiClient.delete as any).mockResolvedValueOnce({ data: { success: true } });

      const name = "sim_swap_wf";
      const version = 1;
      const url = `http://localhost:8080/api/metadata/workflow/${encodeURIComponent(name)}/${encodeURIComponent(String(version))}`;
      
      const res = await apiClient.delete(url);
      expect(apiClient.delete).toHaveBeenCalledWith(
        "http://localhost:8080/api/metadata/workflow/sim_swap_wf/1"
      );
      expect(res.data.success).toBe(true);
    });
  });

  describe("Open workflow definition in designer: GET http://localhost:8080/api/metadata/workflow/sim_swap_wf?version=1", () => {
    it("fetches definition with version query param using fetchWorkflowJsonByName", async () => {
      const conductorDef = {
        name: "sim_swap_wf",
        version: 1,
        description: "SIM Swap Process",
        tasks: [
          {
            name: "validate_sim",
            taskReferenceName: "validate_sim_ref",
            type: "SIMPLE",
          },
        ],
      };
      (apiClient.get as any).mockResolvedValueOnce({ data: conductorDef });

      const result = await fetchWorkflowJsonByName("sim_swap_wf", 1);
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/metadata/workflow/sim_swap_wf?version=1"),
        expect.any(Object)
      );
      expect(result).toEqual(conductorDef);
    });

    it("extractWorkflowJsonDataFromResponse correctly extracts raw Conductor workflow definitions", () => {
      const conductorDef = {
        name: "sim_swap_wf",
        version: 1,
        tasks: [{ name: "step1", taskReferenceName: "step1_ref", type: "SIMPLE" }],
      };

      // Direct object response
      const extractedDirect = extractWorkflowJsonDataFromResponse(conductorDef);
      expect(extractedDirect).toEqual(conductorDef);

      // Wrapped in Axios { data: ... }
      const extractedAxios = extractWorkflowJsonDataFromResponse({ data: conductorDef });
      expect(extractedAxios).toEqual(conductorDef);

      // JSON string response
      const extractedString = extractWorkflowJsonDataFromResponse(JSON.stringify(conductorDef));
      expect(extractedString).toEqual(conductorDef);
    });

    it("extractWorkflowJsonDataFromResponse handles legacy wrapped jsonData if present", () => {
      const wrapped = {
        id: "123",
        jsonData: JSON.stringify({ name: "legacy_wf", version: 1, tasks: [] }),
      };
      const extracted = extractWorkflowJsonDataFromResponse(wrapped);
      expect(extracted.name).toBe("legacy_wf");
    });
  });

  describe("Create / Update workflow: PUT http://localhost:8080/api/metadata/workflow", () => {
    it("sends an array payload [ workflowDef ] and handles successful bulk response", async () => {
      const successfulBulkResponse = {
        bulkErrorResults: {},
        bulkSuccessfulResults: ["test_flattened"],
      };
      (apiClient.put as any).mockResolvedValueOnce({ data: successfulBulkResponse });

      const payload = {
        name: "test_flattened",
        version: 1,
        tasks: [],
      };

      const result = await designerSaveWorkflow(payload);
      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining("/api/metadata/workflow"),
        [payload],
        expect.any(Object)
      );
      expect(result).toEqual(successfulBulkResponse);
      expect(result.bulkSuccessfulResults).toContain("test_flattened");
      expect(Object.keys(result.bulkErrorResults)).toHaveLength(0);
    });

    it("throws an error when bulkErrorResults contains failures", async () => {
      const failedBulkResponse = {
        bulkErrorResults: {
          test_flattened: "Validation failed: Task names must be unique",
        },
        bulkSuccessfulResults: [],
      };
      (apiClient.put as any).mockResolvedValueOnce({ data: failedBulkResponse });

      await expect(
        designerSaveWorkflow({ name: "test_flattened", version: 1, tasks: [] })
      ).rejects.toThrow(/Task names must be unique/);
    });

    it("updates workflow definition via updateWorkflowDetail with array payload", async () => {
      const successfulBulkResponse = {
        bulkErrorResults: {},
        bulkSuccessfulResults: ["sim_swap_wf"],
      };
      (apiClient.put as any).mockResolvedValueOnce({ data: successfulBulkResponse });

      const res = await updateWorkflowDetail("sim_swap_wf", {
        name: "sim_swap_wf",
        version: 1,
        description: "Updated description",
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining("/api/metadata/workflow"),
        [expect.objectContaining({ name: "sim_swap_wf", description: "Updated description" })]
      );
      expect(res.bulkSuccessfulResults).toContain("sim_swap_wf");
    });
  });
});
