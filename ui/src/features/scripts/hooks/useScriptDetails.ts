import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/utils/error";
import { scriptsService } from "@/features/scripts/services/scriptsService";
import { scriptKeys } from "@/features/scripts/hooks/queryKeys";
import type {
  ScriptDefinition,
  ScriptDefinitionPayload,
  ScriptExecutionPayload,
  ScriptExecutionResult,
} from "@/features/scripts/types/scriptTypes";

export const useScriptDetails = (id: string | undefined, enabled: boolean) => {
  const queryClient = useQueryClient();
  const isEnabled = enabled && !!id;
  const query = useQuery({
    queryKey: scriptKeys.detail(id ?? ""),
    queryFn: () => scriptsService.getById(id as string),
    enabled: isEnabled,
  });
  const { data, error, isPending, refetch } = query;

  const script: ScriptDefinition | null = isEnabled ? data ?? null : null;
  // Spinner only while nothing is cached for this id; background refetches keep the current data on screen.
  const loading = isEnabled && isPending;
  const errorMessage = isEnabled && error ? getErrorMessage(error, "Failed to load script.") : "";

  const loadScript = useCallback(async () => {
    if (!isEnabled) return;
    await refetch();
  }, [isEnabled, refetch]);

  const createScript = useCallback(
    async (payload: ScriptDefinitionPayload): Promise<ScriptDefinition> => {
      const created = await scriptsService.create(payload);
      await queryClient.invalidateQueries({ queryKey: scriptKeys.all });
      if (created?.id) {
        // Seed the detail cache so the page opened for the new id renders without a refetch spinner.
        queryClient.setQueryData(scriptKeys.detail(created.id), created);
      }
      return created;
    },
    [queryClient]
  );

  const updateScript = useCallback(
    async (payload: ScriptDefinitionPayload): Promise<ScriptDefinition> => {
      if (!id) throw new Error("Script id is required.");
      const updated = await scriptsService.update(id, payload);
      await queryClient.invalidateQueries({ queryKey: scriptKeys.all });
      return updated;
    },
    [id, queryClient]
  );

  const deleteScript = useCallback(async () => {
    if (!id) throw new Error("Script id is required.");
    await scriptsService.delete(id);
    const deletedKey = scriptKeys.detail(id);
    // Skip the deleted record's own detail query so it is not refetched (404) before the page navigates away.
    await queryClient.invalidateQueries({
      queryKey: scriptKeys.all,
      predicate: (q) =>
        !(q.queryKey.length === deletedKey.length && q.queryKey.every((part, index) => part === deletedKey[index])),
    });
  }, [id, queryClient]);

  const executeScript = useCallback(
    async (payload: ScriptExecutionPayload): Promise<ScriptExecutionResult> => scriptsService.execute(payload),
    []
  );

  return {
    script,
    loading,
    errorMessage,
    /** Raw query error (new object per failed fetch) - use to fire one notification per failure. */
    error: isEnabled ? error : null,
    loadScript,
    createScript,
    updateScript,
    deleteScript,
    executeScript,
  };
};
