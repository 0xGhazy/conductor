import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { config } from "@/config/appConfig";
import apiClient from "@/services/apiClient";

const METADATA_WORKFLOW_URL = `${config.apiBaseUrl}/api/metadata/workflow`;

export interface WeaverBulkUpdateResult {
  bulkErrorResults?: Record<string, string>;
  bulkSuccessfulResults?: string[];
}

export interface DeleteWorkflowItem {
  name: string;
  version?: number | string;
}

async function fetchWorkflows(): Promise<any[]> {
  const response = await apiClient.get<any>(METADATA_WORKFLOW_URL);
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export const METADATA_WORKFLOWS_QUERY_KEY = ["metadata", "workflows"] as const;

/**
 * Conductor workflow metadata. The endpoint returns every definition in one response, so
 * the list is cached under a single key and paginated client-side by the caller.
 */
export function useWeaverMetadataService() {
  const queryClient = useQueryClient();

  const workflows = useQuery({
    queryKey: METADATA_WORKFLOWS_QUERY_KEY,
    queryFn: () => fetchWorkflows(),
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });

  const saveWorkflow = useMutation<WeaverBulkUpdateResult, Error, any>({
    mutationFn: async (payload: any) => {
      // Conductor PUT /api/metadata/workflow expects an array [ workflowDef ]
      const arrayPayload = Array.isArray(payload) ? payload : [payload];
      const res = await apiClient.put<WeaverBulkUpdateResult>(METADATA_WORKFLOW_URL, arrayPayload);
      const data = res.data;
      if (data?.bulkErrorResults && Object.keys(data.bulkErrorResults).length > 0) {
        const errorMsg = Object.entries(data.bulkErrorResults)
          .map(([wf, err]) => `${wf}: ${err}`)
          .join(", ");
        throw new Error(errorMsg || "Failed to create or update workflow.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata", "workflows"] });
    },
  });

  const deleteWorkflow = useMutation<any, Error, DeleteWorkflowItem>({
    mutationFn: async ({ name, version = 1 }: DeleteWorkflowItem) => {
      const v = version ?? 1;
      const res = await apiClient.delete(
        `${METADATA_WORKFLOW_URL}/${encodeURIComponent(name)}/${encodeURIComponent(String(v))}`
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata", "workflows"] });
    },
  });

  const bulkDeleteWorkflows = useMutation<any, Error, DeleteWorkflowItem[]>({
    mutationFn: async (items: DeleteWorkflowItem[]) => {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return [];

      const settled = await Promise.allSettled(
        list.map((item) => {
          const v = item.version ?? 1;
          return apiClient.delete(
            `${METADATA_WORKFLOW_URL}/${encodeURIComponent(item.name)}/${encodeURIComponent(String(v))}`
          );
        })
      );

      const failures = settled.filter((r) => r.status === "rejected");
      if (failures.length === list.length) {
        throw new Error("Failed to delete the selected workflows.");
      }
      return settled;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata", "workflows"] });
    },
  });

  return {
    workflows,
    saveWorkflow,
    deleteWorkflow,
    bulkDeleteWorkflows,
  };
}

export default useWeaverMetadataService;
