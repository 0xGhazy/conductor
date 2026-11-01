import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { extractList, extractTotal } from "@/utils/data";
import {
  createSecret,
  deleteSecret,
  fetchSecretById,
  fetchSecretUsages,
  fetchSecrets,
  updateSecret,
} from "../services/secretsApi";
import type {
  Secret,
  SecretCreatePayload,
  SecretMinimal,
  SecretUpdatePayload,
  SecretUsage,
} from "../types/secretTypes";
import { secretKeys } from "./queryKeys";

export interface SecretListParams {
  page: number;
  size: number;
  search?: string;
}

export interface SecretListResult {
  items: Secret[];
  total: number;
}

/** Paged secret list, cached per {page,size,search}. */
export const useSecretsList = ({ page, size, search }: SecretListParams) => {
  const trimmedSearch = (search || "").trim();
  return useQuery({
    queryKey: secretKeys.list({ page, size, search: trimmedSearch }),
    queryFn: async (): Promise<SecretListResult> => {
      const response = await fetchSecrets({
        page,
        size,
        sort: "createdAt,DESC",
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
      });
      const items = extractList<Secret>(response);
      return { items, total: extractTotal(response, items.length) };
    },
    placeholderData: keepPreviousData,
  });
};

/** Minimal list for pickers that insert ${weaver.secrets.<name>} into other forms. */
export const useSecretPicker = (search = "", options: { enabled?: boolean } = {}) => {
  const trimmedSearch = search.trim();
  return useQuery({
    queryKey: secretKeys.picker(trimmedSearch),
    queryFn: async (): Promise<SecretMinimal[]> => {
      const response = await fetchSecrets({
        minimal: true,
        size: 50,
        sort: "name,ASC",
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
      });
      return extractList<SecretMinimal>(response);
    },
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
};

export const useSecret = (id: string | undefined, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: secretKeys.detail(String(id ?? "")),
    queryFn: async (): Promise<Secret | null> => (await fetchSecretById(String(id)))?.data ?? null,
    enabled: (options.enabled ?? true) && Boolean(id),
  });

export const useSecretUsages = (id: string | undefined, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: secretKeys.usages(String(id ?? "")),
    queryFn: async (): Promise<SecretUsage[]> => extractList<SecretUsage>(await fetchSecretUsages(String(id))),
    enabled: (options.enabled ?? true) && Boolean(id),
  });

// The plaintext value only travels in the mutation variables; nothing here caches it.

export const useCreateSecret = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SecretCreatePayload) => (await createSecret(payload))?.data ?? null,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: secretKeys.all }),
  });
};

export const useUpdateSecret = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SecretUpdatePayload) => (await updateSecret(id, payload))?.data ?? null,
    onSuccess: (updated) => {
      // Seed the detail cache with the response (new version, displayedText) before the refetch lands.
      if (updated) queryClient.setQueryData(secretKeys.detail(id), updated);
      return queryClient.invalidateQueries({ queryKey: secretKeys.all });
    },
  });
};

export const useDeleteSecret = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSecret(id),
    onSuccess: async (_, id) => {
      // The deleted record's own queries are only marked stale: refetching them while still mounted would 404.
      void queryClient.invalidateQueries({ queryKey: secretKeys.detail(id), refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: secretKeys.usages(id), refetchType: "none" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: secretKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: [...secretKeys.all, "picker"] }),
      ]);
    },
  });
};
