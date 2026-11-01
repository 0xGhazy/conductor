import { useCallback, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/utils/error";
import { scriptsService } from "@/features/scripts/services/scriptsService";
import { scriptKeys } from "@/features/scripts/hooks/queryKeys";
import type {
  ScriptDefinition,
  ScriptDefinitionPayload,
  ScriptExecutionPayload,
  ScriptExecutionResult,
  ScriptListParams,
  ScriptPage,
} from "@/features/scripts/types/scriptTypes";

const EMPTY_SCRIPTS: ScriptDefinition[] = [];

const createEmptyPage = (params: ScriptListParams): ScriptPage => ({
  content: [],
  page: params.page,
  size: params.size,
  numberOfElements: 0,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
});

export const useScripts = (params: ScriptListParams) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: scriptKeys.list(params),
    queryFn: () => scriptsService.list(params),
    placeholderData: keepPreviousData,
  });
  const { data, error, isError, isPending, refetch } = query;

  // Previous behaviour: on a failed fetch the list was cleared and the page info reset.
  const pageInfo = useMemo<ScriptPage>(
    () => (!isError && data ? data : createEmptyPage(params)),
    [data, isError, params]
  );
  const scripts = !isError && data ? data.content : EMPTY_SCRIPTS;
  const errorMessage = isError ? getErrorMessage(error, "Failed to fetch scripts.") : "";

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: scriptKeys.all }),
    [queryClient]
  );

  const createScript = useCallback(
    async (payload: ScriptDefinitionPayload) => {
      const created = await scriptsService.create(payload);
      await invalidate();
      return created;
    },
    [invalidate]
  );

  const updateScript = useCallback(
    async (id: string, payload: ScriptDefinitionPayload) => {
      const updated = await scriptsService.update(id, payload);
      await invalidate();
      return updated;
    },
    [invalidate]
  );

  const deleteScript = useCallback(
    async (id: string) => {
      await scriptsService.delete(id);
      await invalidate();
    },
    [invalidate]
  );

  const deleteScripts = useCallback(
    async (ids: string[]) => {
      await scriptsService.bulkDelete(ids);
      await invalidate();
    },
    [invalidate]
  );

  const executeScript = useCallback(
    async (payload: ScriptExecutionPayload): Promise<ScriptExecutionResult> => scriptsService.execute(payload),
    []
  );

  return {
    scripts,
    pageInfo,
    // Only block the table when nothing is cached yet; cached/previous pages stay visible while refetching.
    loading: isPending,
    errorMessage,
    refresh,
    createScript,
    updateScript,
    deleteScript,
    deleteScripts,
    executeScript,
  };
};
