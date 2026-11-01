import type { AxiosResponse } from "axios";
import { config } from "@/config/appConfig";
import apiClient from "@/services/apiClient";
import type {
  ApiEnvelope,
  ScriptBulkDeleteResult,
  ScriptDefinition,
  ScriptDefinitionPayload,
  ScriptExecutionPayload,
  ScriptExecutionResult,
  ScriptListParams,
  ScriptPage,
} from "@/features/scripts/types/scriptTypes";

export const SCRIPTS_API = `${config.apiBaseUrl}/api/scripts`;
export const SCRIPT_EXECUTE_API = `${SCRIPTS_API}/execute`;

const unwrapData = <T,>(response: AxiosResponse<ApiEnvelope<T> | T>): T => {
  const body = response.data;
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
};

export const scriptsService = {
  async list(params: ScriptListParams): Promise<ScriptPage> {
    const searchParams = new URLSearchParams({
      page: String(Math.max(params.page, 0)),
      size: String(Math.max(params.size, 1)),
      sort: "createdAt,DESC",
    });

    if (params.search?.trim()) searchParams.set("search", params.search.trim());
    if (params.language) searchParams.set("language", params.language);

    const response = await apiClient.get<ApiEnvelope<ScriptPage> | ScriptPage>(
      `${SCRIPTS_API}?${searchParams.toString()}`
    );
    const page = unwrapData<ScriptPage>(response);
    if (Array.isArray(page)) {
      return {
        content: page,
        page: params.page,
        size: params.size,
        numberOfElements: page.length,
        totalElements: page.length,
        totalPages: 1,
        first: true,
        last: true,
      };
    }
    return {
      content: Array.isArray(page?.content) ? page.content : [],
      page: Number(page?.page ?? params.page),
      size: Number(page?.size ?? params.size),
      numberOfElements: Number(page?.numberOfElements ?? page?.content?.length ?? 0),
      totalElements: Number(page?.totalElements ?? page?.content?.length ?? 0),
      totalPages: Number(page?.totalPages ?? 0),
      first: Boolean(page?.first),
      last: Boolean(page?.last),
    };
  },

  async getById(id: string): Promise<ScriptDefinition> {
    const response = await apiClient.get<ApiEnvelope<ScriptDefinition>>(`${SCRIPTS_API}/${encodeURIComponent(id)}`);
    return unwrapData<ScriptDefinition>(response);
  },

  async create(payload: ScriptDefinitionPayload): Promise<ScriptDefinition> {
    const response = await apiClient.post<ApiEnvelope<ScriptDefinition>>(SCRIPTS_API, payload);
    return unwrapData<ScriptDefinition>(response);
  },

  async update(id: string, payload: ScriptDefinitionPayload): Promise<ScriptDefinition> {
    const response = await apiClient.put<ApiEnvelope<ScriptDefinition>>(
      `${SCRIPTS_API}/${encodeURIComponent(id)}`,
      payload
    );
    return unwrapData<ScriptDefinition>(response);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`${SCRIPTS_API}/${encodeURIComponent(id)}`);
  },

  async bulkDelete(ids: string[]): Promise<ScriptBulkDeleteResult> {
    const response = await apiClient.delete<ApiEnvelope<ScriptBulkDeleteResult>>(`${SCRIPTS_API}/bulk`, {
      data: { ids },
    });
    return unwrapData<ScriptBulkDeleteResult>(response);
  },

  async execute(payload: ScriptExecutionPayload): Promise<ScriptExecutionResult> {
    const response = await apiClient.post<ScriptExecutionResult>(SCRIPT_EXECUTE_API, payload);
    return response.data;
  },
};
