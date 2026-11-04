import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { ApiResponse, PaginationParams, PaginatedData } from "@/types/api";
import type {
  QueryDefinition,
  QueryPayload,
  QueryExecutionPayload,
  QueryExecutionResult,
} from "../types/queryTypes";

const DATABASES_API = `${config.apiBaseUrl}/api/databases`;
const DATASOURCES_API = DATABASES_API;
const DATASOURCES_LIST_API = DATASOURCES_API;
const QUERIES_API = `${config.apiBaseUrl}/api/queries`;
const DATABASE_QUERIES_API = QUERIES_API;

const firstDefined = <T,>(...values: T[]): T | undefined =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const toQueryRequestPayload = (payload: QueryPayload): QueryPayload => ({
  ...payload,
  sql: payload.sql ?? payload.sqlQuery ?? (payload.query as string | undefined),
  // The API reads `datasourceId`; the form may hold the id under older names.
  datasourceId: firstDefined(
    payload.datasourceId,
    payload.dataSourceId,
    payload.dataSource,
    payload.datasource
  ) as string | undefined,
  timeout: payload.timeout ?? payload.timeoutMs,
  parameters: payload.parameters ?? {},
});

export const fetchQueries = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>> =>
  apiClient
    .get<ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>>(DATABASE_QUERIES_API, {
      params,
    })
    .then((res) => res.data);

export const fetchQueryById = (
  id: string,
  includeSql = false
): Promise<ApiResponse<QueryDefinition>> =>
  apiClient
    .get<ApiResponse<QueryDefinition>>(`${QUERIES_API}/${encodeURIComponent(id)}`, {
      params: { includeSql },
    })
    .then((res) => res.data);

export const fetchQueriesByDatasourceId = (
  datasourceId: string,
  params?: Omit<PaginationParams, "datasource">
): Promise<ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>> =>
  apiClient
    .get<ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>>(
      `${DATABASES_API}/${encodeURIComponent(datasourceId)}/queries`,
      { params }
    )
    .then((res) => res.data);

export const createQuery = (
  payload: QueryPayload
): Promise<ApiResponse<QueryDefinition>> =>
  apiClient
    .post<ApiResponse<QueryDefinition>>(QUERIES_API, toQueryRequestPayload(payload))
    .then((res) => res.data);

export const updateQuery = (
  id: string,
  payload: QueryPayload
): Promise<ApiResponse<QueryDefinition>> =>
  apiClient
    .put<ApiResponse<QueryDefinition>>(
      `${QUERIES_API}/${encodeURIComponent(id)}`,
      toQueryRequestPayload(payload)
    )
    .then((res) => res.data);

export const deleteQuery = (
  id: string
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`${QUERIES_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

/** Runs the SQL in `payload` against its database: POST /api/databases/{id}/execute. */
export const executeQuery = (
  payload: QueryExecutionPayload
): Promise<ApiResponse<QueryExecutionResult>> => {
  const databaseId = firstDefined(
    payload.datasource,
    payload.datasourceId,
    payload.dataSource,
    payload.dataSourceId
  );
  if (!databaseId) {
    return Promise.reject(new Error("A database is required to run SQL."));
  }
  return apiClient
    .post<ApiResponse<QueryExecutionResult>>(
      `${DATABASES_API}/${encodeURIComponent(String(databaseId))}/execute`,
      {
        sql: payload.sql ?? payload.sqlQuery ?? payload.query,
        parameters: payload.parameters ?? {},
        timeout: payload.timeout ?? payload.timeoutMs,
        maxRows: payload.maxRows,
      }
    )
    .then((res) => res.data);
};

/** Runs a saved query with arguments: POST /api/queries/{id}/execute. */
export const executeSavedQuery = (
  id: string,
  parameters: Record<string, unknown> = {},
  maxRows?: number
): Promise<ApiResponse<QueryExecutionResult>> =>
  apiClient
    .post<ApiResponse<QueryExecutionResult>>(`${QUERIES_API}/${encodeURIComponent(id)}/execute`, {
      parameters,
      maxRows,
    })
    .then((res) => res.data);

/** Deletes several queries; `data` lists the deleted ids and the ids that did not exist. */
export const bulkDeleteQueries = (
  ids: string[]
): Promise<ApiResponse<{ deleted: string[]; notFound: string[] }>> =>
  apiClient
    .post<ApiResponse<{ deleted: string[]; notFound: string[] }>>(`${QUERIES_API}/bulk-delete`, ids)
    .then((res) => res.data);

export const fetchQueryDatasources = (): Promise<
  ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>
> =>
  apiClient
    .get<ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>>(DATABASE_QUERIES_API)
    .then((res) => res.data);

export {
  DATASOURCES_API,
  DATASOURCES_LIST_API,
  QUERIES_API,
  DATABASE_QUERIES_API,
};
