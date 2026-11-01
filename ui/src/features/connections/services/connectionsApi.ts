import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { ApiResponse, PaginationParams, PaginatedData } from "@/types/api";
import type { HttpConnection, HttpConnectionPayload } from "@/features/connections/types/connectionTypes";

const CONNECTIONS_API = `${config.apiBaseUrl}/api/actions/http/connections`;

export const fetchConnections = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<HttpConnection> | HttpConnection[]>> =>
  apiClient
    .get<ApiResponse<PaginatedData<HttpConnection> | HttpConnection[]>>(CONNECTIONS_API, { params })
    .then((res) => res.data);

export const fetchConnectionById = (
  id: string
): Promise<ApiResponse<HttpConnection>> =>
  apiClient
    .get<ApiResponse<HttpConnection>>(`${CONNECTIONS_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export const createConnection = (
  payload: HttpConnectionPayload
): Promise<ApiResponse<HttpConnection>> =>
  apiClient
    .post<ApiResponse<HttpConnection>>(CONNECTIONS_API, payload)
    .then((res) => res.data);

export const updateConnection = (
  id: string,
  payload: HttpConnectionPayload
): Promise<ApiResponse<HttpConnection>> =>
  apiClient
    .put<ApiResponse<HttpConnection>>(`${CONNECTIONS_API}/${encodeURIComponent(id)}`, payload)
    .then((res) => res.data);

export const deleteConnection = (
  id: string
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`${CONNECTIONS_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export { CONNECTIONS_API };
