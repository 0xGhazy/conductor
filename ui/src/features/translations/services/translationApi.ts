import type { AxiosResponse } from "axios";
import { config } from "@/config/appConfig";
import apiClient from "@/services/apiClient";
import type {
  TranslationListParams,
  TranslationPage,
  WorkflowTranslation,
  WorkflowTranslationPayload,
  WorkflowTranslationsMap,
} from "@/features/translations/types/translationTypes";

export interface ApiEnvelope<T> {
  message?: string;
  status?: string;
  data: T;
}

export const TRANSLATIONS_API = `${config.apiBaseUrl}/api/workflows/translations`;

const unwrapData = <T,>(response: AxiosResponse<ApiEnvelope<T> | T>): T => {
  const body = response.data;
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
};

export const translationApi = {
  async fetchWorkflowTranslationsMap(
    workflowName: string,
    version: number | string
  ): Promise<WorkflowTranslationsMap> {
    if (!workflowName) return {};
    const safeVersion = Number(version) || 1;
    const response = await apiClient.get<ApiEnvelope<WorkflowTranslationsMap> | WorkflowTranslationsMap>(
      `${TRANSLATIONS_API}/${encodeURIComponent(workflowName)}/${safeVersion}`
    );
    return unwrapData<WorkflowTranslationsMap>(response) || {};
  },

  async list(params: TranslationListParams): Promise<TranslationPage> {
    const searchParams = new URLSearchParams({
      page: String(Math.max(params.page, 0)),
      size: String(Math.max(params.size, 1)),
    });

    if (params.workflowName?.trim()) {
      searchParams.set("workflowName", params.workflowName.trim());
    }
    if (params.workflowVersion != null && !isNaN(Number(params.workflowVersion))) {
      searchParams.set("workflowVersion", String(params.workflowVersion));
    }
    if (params.search?.trim()) {
      searchParams.set("search", params.search.trim());
    }

    const response = await apiClient.get<ApiEnvelope<TranslationPage> | TranslationPage>(
      `${TRANSLATIONS_API}?${searchParams.toString()}`
    );
    const page = unwrapData<TranslationPage>(response);

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

  async create(payload: WorkflowTranslationPayload): Promise<WorkflowTranslation> {
    const response = await apiClient.post<ApiEnvelope<WorkflowTranslation> | WorkflowTranslation>(
      TRANSLATIONS_API,
      payload
    );
    return unwrapData<WorkflowTranslation>(response);
  },

  async update(id: string, payload: WorkflowTranslationPayload): Promise<WorkflowTranslation> {
    const response = await apiClient.put<ApiEnvelope<WorkflowTranslation> | WorkflowTranslation>(
      `${TRANSLATIONS_API}/${id}`,
      payload
    );
    return unwrapData<WorkflowTranslation>(response);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`${TRANSLATIONS_API}/${id}`);
  },

  async reloadCache(): Promise<void> {
    await apiClient.post(`${TRANSLATIONS_API}/cache/reload`);
  },
};
