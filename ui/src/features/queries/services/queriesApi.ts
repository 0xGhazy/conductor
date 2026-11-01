import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { ApiResponse, PaginationParams, PaginatedData } from "@/types/api";
import type {
  QueryDefinition,
  QueryPayload,
  QueryExecutionPayload,
  QueryExecutionResult,
} from "../types/queryTypes";

const DATABASE_API = `${config.apiBaseUrl}/api/database`;
const DATASOURCES_API = `${DATABASE_API}/instances`;
const DATASOURCES_LIST_API = DATASOURCES_API;
const QUERIES_API = `${DATABASE_API}/queries`;
const DATABASE_QUERIES_API = QUERIES_API;
// The only execution endpoint: the SQL always comes from the frontend, nothing is loaded by query id.
const QUERIES_EXECUTE_API = `${QUERIES_API}/adhoc-executions`;

const toQueryRequestPayload = (payload: QueryPayload): QueryPayload => ({
  ...payload,
  sql: payload.sql ?? payload.sqlQuery ?? payload.query,
  dataSource:
    payload.dataSource ??
    payload.dataSourceId ??
    payload.datasourceId ??
    payload.datasource,
  timeout: payload.timeout ?? payload.timeoutMs,
  parameters: payload.parameters ?? {},
});

const toAdhocQueryExecutionPayload = (
  payload: QueryExecutionPayload
): QueryExecutionPayload => ({
  ...payload,
  datasource:
    payload.datasource ??
    payload.datasourceId ??
    payload.dataSource ??
    payload.dataSourceId,
  sql: payload.sql ?? payload.sqlQuery ?? payload.query,
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
  includeQuery = false
): Promise<ApiResponse<QueryDefinition>> =>
  apiClient
    .get<ApiResponse<QueryDefinition>>(`${DATABASE_QUERIES_API}/${encodeURIComponent(id)}`, {
      params: { includeQuery },
    })
    .then((res) => res.data);

export const fetchQueriesByDatasourceId = (
  datasourceId: string,
  params?: Omit<PaginationParams, "datasource">
): Promise<ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>> =>
  apiClient
    .get<ApiResponse<PaginatedData<QueryDefinition> | QueryDefinition[]>>(DATABASE_QUERIES_API, {
      params: { ...params, datasource: datasourceId },
    })
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

export const executeQuery = (
  payload: QueryExecutionPayload
): Promise<ApiResponse<QueryExecutionResult>> =>
  apiClient
    .post<ApiResponse<QueryExecutionResult>>(QUERIES_EXECUTE_API, toAdhocQueryExecutionPayload(payload))
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
  QUERIES_EXECUTE_API,
};
