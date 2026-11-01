import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import { extractList } from "@/utils/data";
import type { ApiResponse, PaginationParams, PaginatedData } from "@/types/api";
import type { Datasource, DatasourcePayload } from "../types/databaseTypes";

const DATABASE_API = `${config.apiBaseUrl}/api/database`;
const DATASOURCES_API = `${DATABASE_API}/instances`;

const toDatabaseInstancePayload = (payload: DatasourcePayload): DatasourcePayload => ({
  ...payload,
  connection:
    payload.connection ??
    payload.connectionDetails ??
    {
      url: payload.url,
      username: payload.username,
      password: payload.password,
      maximumPoolSize: (payload as any).maxPoolSize ?? payload.maximumPoolSize,
      connectionTimeout: payload.connectionTimeout,
      idleTimeout: payload.idleTimeout,
      schema: payload.schema,
    },
});

export const fetchDatasources = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<Datasource> | Datasource[]>> =>
  apiClient
    .get<ApiResponse<PaginatedData<Datasource> | Datasource[]>>(DATASOURCES_API, { params })
    .then((res) => res.data);

export const fetchDatasourceById = (
  id: string
): Promise<ApiResponse<Datasource>> =>
  apiClient
    .get<ApiResponse<Datasource>>(`${DATASOURCES_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export const createDatasource = (
  payload: DatasourcePayload
): Promise<ApiResponse<Datasource>> =>
  apiClient
    .post<ApiResponse<Datasource>>(DATASOURCES_API, toDatabaseInstancePayload(payload))
    .then((res) => res.data);

export const updateDatasource = (
  id: string,
  payload: DatasourcePayload
): Promise<ApiResponse<Datasource>> =>
  apiClient
    .put<ApiResponse<Datasource>>(
      `${DATASOURCES_API}/${encodeURIComponent(id)}`,
      toDatabaseInstancePayload(payload)
    )
    .then((res) => res.data);

export const deleteDatasource = (
  id: string
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`${DATASOURCES_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export const pingDatasource = (
  id: string
): Promise<ApiResponse<{ requested: string[]; results: Datasource[] }>> =>
  apiClient
    .post<ApiResponse<{ requested: string[]; results: Datasource[] }>>(
      `${DATASOURCES_API}/${encodeURIComponent(id)}/ping`
    )
    .then((res) => res.data);

export const fetchDatasourceByName = async (
  name: string
): Promise<Datasource | null> => {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const response = await fetchDatasources({ search: trimmed });
  const body = response?.data ?? response;
  const items = extractList<Datasource>(body);
  const found = items.find(
    (ds: any) => String(ds?.name || "").trim().toLowerCase() === trimmed.toLowerCase()
  );
  return found || null;
};

export {
  fetchDatasources as fetchDatabases,
  fetchDatasourceById as fetchDatabaseById,
  fetchDatasourceByName as fetchDatabaseByName,
  createDatasource as createDatabase,
  updateDatasource as updateDatabase,
  deleteDatasource as deleteDatabase,
  pingDatasource as pingDatabase,
  DATASOURCES_API,
  DATABASE_API,
};

