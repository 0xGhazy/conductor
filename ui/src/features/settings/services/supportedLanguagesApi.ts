import type { AxiosResponse } from "axios";
import { config } from "@/config/appConfig";
import apiClient from "@/services/apiClient";
import type {
  SupportedLanguage,
  SupportedLanguagePayload,
} from "@/features/settings/types/supportedLanguageTypes";

export interface ApiEnvelope<T> {
  message?: string;
  status?: string;
  data: T;
}

export const LANGUAGES_API = `${config.apiBaseUrl}/api/settings/languages`;

const unwrapData = <T,>(response: AxiosResponse<ApiEnvelope<T> | T>): T => {
  const body = response.data;
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
};

export const supportedLanguagesApi = {
  async list(): Promise<SupportedLanguage[]> {
    const response = await apiClient.get<ApiEnvelope<SupportedLanguage[]> | SupportedLanguage[]>(
      LANGUAGES_API
    );
    const data = unwrapData<SupportedLanguage[]>(response);
    return Array.isArray(data) ? data : [];
  },

  async getById(id: string): Promise<SupportedLanguage> {
    const response = await apiClient.get<ApiEnvelope<SupportedLanguage> | SupportedLanguage>(
      `${LANGUAGES_API}/${id}`
    );
    return unwrapData<SupportedLanguage>(response);
  },

  async create(payload: SupportedLanguagePayload): Promise<SupportedLanguage> {
    const response = await apiClient.post<ApiEnvelope<SupportedLanguage> | SupportedLanguage>(
      LANGUAGES_API,
      payload
    );
    return unwrapData<SupportedLanguage>(response);
  },

  async update(id: string, payload: Partial<SupportedLanguagePayload>): Promise<SupportedLanguage> {
    const response = await apiClient.put<ApiEnvelope<SupportedLanguage> | SupportedLanguage>(
      `${LANGUAGES_API}/${id}`,
      payload
    );
    return unwrapData<SupportedLanguage>(response);
  },

  async delete(id: string): Promise<SupportedLanguage> {
    const response = await apiClient.delete<ApiEnvelope<SupportedLanguage> | SupportedLanguage>(
      `${LANGUAGES_API}/${id}`
    );
    return unwrapData<SupportedLanguage>(response);
  },
};
