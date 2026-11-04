import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import { extractList } from "@/utils/data";
import type { ApiResponse, PaginationParams, PaginatedData } from "@/types/api";
import type { Datasource, DatasourcePayload, DatasourceStatusDetails } from "../types/databaseTypes";

const DATABASE_API = `${config.apiBaseUrl}/api/databases`;
const DATASOURCES_API = DATABASE_API;

const toDatabaseInstancePayload = (payload: DatasourcePayload): DatasourcePayload => ({
  ...payload,
  connection:
    payload.connection ??
    payload.connectionDetails ??
    {
      url: payload.url,
      username: payload.username,
      password: payload.password,
      maxPoolSize: (payload as { maxPoolSize?: number }).maxPoolSize ?? payload.maximumPoolSize,
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

/** One database. `withQueries` also returns its newest 100 queries (without SQL) in `queries`. */
export const fetchDatasourceById = (
  id: string,
  { withQueries = false }: { withQueries?: boolean } = {}
): Promise<ApiResponse<Datasource>> =>
  apiClient
    .get<ApiResponse<Datasource>>(`${DATASOURCES_API}/${encodeURIComponent(id)}`, {
      params: withQueries ? { withQueries: true } : undefined,
    })
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

/** Pings a saved database; `data` is the database with a fresh `status`. */
export const pingDatasource = (
  id: string
): Promise<ApiResponse<Datasource>> =>
  apiClient
    .post<ApiResponse<Datasource>>(`${DATASOURCES_API}/${encodeURIComponent(id)}/ping`)
    .then((res) => res.data);

/**
 * Tests a connection from form values without saving. Pass `id` when editing a saved
 * database so a blank or masked password reuses the stored one.
 */
export const testDatasourceConnection = (
  payload: DatasourcePayload & { id?: string | null }
): Promise<ApiResponse<DatasourceStatusDetails>> =>
  apiClient
    .post<ApiResponse<DatasourceStatusDetails>>(
      `${DATASOURCES_API}/test`,
      toDatabaseInstancePayload(payload)
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
  testDatasourceConnection as testDatabaseConnection,
  DATASOURCES_API,
  DATABASE_API,
};

