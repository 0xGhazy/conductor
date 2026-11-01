import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { ApiResponse, PaginationParams } from "@/types/api";
import type {
  Secret,
  SecretCreatePayload,
  SecretMinimal,
  SecretUpdatePayload,
  SecretUsage,
} from "../types/secretTypes";

export const SECRETS_API = `${config.apiBaseUrl}/api/secrets`;

const secretUrl = (id: string) => `${SECRETS_API}/${encodeURIComponent(id)}`;

export const fetchSecrets = (
  params?: PaginationParams & { minimal?: boolean }
): Promise<ApiResponse<Array<Secret | SecretMinimal>>> =>
  apiClient
    .get<ApiResponse<Array<Secret | SecretMinimal>>>(SECRETS_API, { params })
    .then((res) => res.data);

export const fetchSecretById = (id: string): Promise<ApiResponse<Secret>> =>
  apiClient.get<ApiResponse<Secret>>(secretUrl(id)).then((res) => res.data);

export const fetchSecretUsages = (id: string): Promise<ApiResponse<SecretUsage[]>> =>
  apiClient.get<ApiResponse<SecretUsage[]>>(`${secretUrl(id)}/usages`).then((res) => res.data);

export const createSecret = (payload: SecretCreatePayload): Promise<ApiResponse<Secret>> =>
  apiClient.post<ApiResponse<Secret>>(SECRETS_API, payload).then((res) => res.data);

export const updateSecret = (id: string, payload: SecretUpdatePayload): Promise<ApiResponse<Secret>> =>
  apiClient.put<ApiResponse<Secret>>(secretUrl(id), payload).then((res) => res.data);

export const deleteSecret = (id: string): Promise<void> =>
  apiClient.delete(secretUrl(id)).then(() => undefined);
