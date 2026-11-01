import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { ApiResponse } from "@/types/api";
import type {
  RedisDatasource,
  RedisDatasourcePayload,
  RedisConnectionStatus,
} from "@/features/redis/types/redisTypes";

const REDIS_DATASOURCES_API = `${config.apiBaseUrl}/api/redis`;

export const fetchRedisDatasources = (): Promise<ApiResponse<RedisDatasource[]>> =>
  apiClient.get<ApiResponse<RedisDatasource[]>>(REDIS_DATASOURCES_API).then((res) => res.data);

export const fetchRedisDatasourceById = (
  id: string
): Promise<ApiResponse<RedisDatasource>> =>
  apiClient
    .get<ApiResponse<RedisDatasource>>(`${REDIS_DATASOURCES_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export const createRedisDatasource = (
  payload: RedisDatasourcePayload
): Promise<ApiResponse<RedisDatasource>> =>
  apiClient
    .post<ApiResponse<RedisDatasource>>(REDIS_DATASOURCES_API, payload)
    .then((res) => res.data);

export const updateRedisDatasource = (
  id: string,
  payload: RedisDatasourcePayload
): Promise<ApiResponse<RedisDatasource>> =>
  apiClient
    .put<ApiResponse<RedisDatasource>>(`${REDIS_DATASOURCES_API}/${encodeURIComponent(id)}`, payload)
    .then((res) => res.data);

export const deleteRedisDatasource = (
  id: string
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`${REDIS_DATASOURCES_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export const testRedisConnection = (
  payload: RedisDatasourcePayload
): Promise<ApiResponse<RedisConnectionStatus>> =>
  apiClient
    .post<ApiResponse<RedisConnectionStatus>>(`${REDIS_DATASOURCES_API}/test`, payload)
    .then((res) => res.data);

export const getRedisDatasourceStatus = (
  id: string
): Promise<ApiResponse<RedisConnectionStatus>> =>
  apiClient
    .get<ApiResponse<RedisConnectionStatus>>(`${REDIS_DATASOURCES_API}/${encodeURIComponent(id)}/status`)
    .then((res) => res.data);

export { REDIS_DATASOURCES_API };
