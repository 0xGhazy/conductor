import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import type { ApiResponse, PaginationParams, PaginatedData } from "@/types/api";
import type {
  ApiCollection,
  ApiCollectionPayload,
  CollectionEndpoint,
  CollectionImportPayload,
} from "@/features/collections/types/apiCollectionTypes";

const COLLECTIONS_API = `${config.apiBaseUrl}/api/actions/http/collections`;

export const fetchCollections = (
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<ApiCollection> | ApiCollection[]>> =>
  apiClient
    .get<ApiResponse<PaginatedData<ApiCollection> | ApiCollection[]>>(COLLECTIONS_API, { params })
    .then((res) => res.data);

export const fetchCollectionById = (
  id: string
): Promise<ApiResponse<ApiCollection>> =>
  apiClient
    .get<ApiResponse<ApiCollection>>(`${COLLECTIONS_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export const createCollection = (
  payload: ApiCollectionPayload
): Promise<ApiResponse<ApiCollection>> =>
  apiClient
    .post<ApiResponse<ApiCollection>>(COLLECTIONS_API, payload)
    .then((res) => res.data);

export const updateCollection = (
  id: string,
  payload: ApiCollectionPayload
): Promise<ApiResponse<ApiCollection>> =>
  apiClient
    .patch<ApiResponse<ApiCollection>>(`${COLLECTIONS_API}/${encodeURIComponent(id)}`, payload)
    .then((res) => res.data);

export const deleteCollection = (
  id: string
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`${COLLECTIONS_API}/${encodeURIComponent(id)}`)
    .then((res) => res.data);

export const importCollection = (
  payload: CollectionImportPayload
): Promise<ApiResponse<ApiCollection>> =>
  apiClient
    .post<ApiResponse<ApiCollection>>(`${COLLECTIONS_API}/import`, payload)
    .then((res) => res.data);

export const fetchCollectionEndpoints = (
  id: string,
  params?: PaginationParams
): Promise<ApiResponse<PaginatedData<CollectionEndpoint> | CollectionEndpoint[]>> =>
  apiClient
    .get<ApiResponse<PaginatedData<CollectionEndpoint> | CollectionEndpoint[]>>(
      `${COLLECTIONS_API}/${encodeURIComponent(id)}/endpoints`,
      { params }
    )
    .then((res) => res.data);

export const fetchCollectionEndpoint = (
  collectionId: string,
  endpointId: string
): Promise<ApiResponse<CollectionEndpoint>> =>
  apiClient
    .get<ApiResponse<CollectionEndpoint>>(
      `${COLLECTIONS_API}/${encodeURIComponent(collectionId)}/endpoints/${encodeURIComponent(endpointId)}`
    )
    .then((res) => res.data);

export const createCollectionEndpoint = (
  collectionId: string,
  payload: Partial<CollectionEndpoint>
): Promise<ApiResponse<CollectionEndpoint>> =>
  apiClient
    .post<ApiResponse<CollectionEndpoint>>(
      `${COLLECTIONS_API}/${encodeURIComponent(collectionId)}/endpoints`,
      payload
    )
    .then((res) => res.data);

export const updateCollectionEndpoint = (
  endpointId: string,
  payload: Partial<CollectionEndpoint>
): Promise<ApiResponse<CollectionEndpoint>> =>
  apiClient
    .patch<ApiResponse<CollectionEndpoint>>(
      `${COLLECTIONS_API}/endpoints/${encodeURIComponent(endpointId)}`,
      payload
    )
    .then((res) => res.data);

export const deleteCollectionEndpoint = (
  endpointId: string
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(
      `${COLLECTIONS_API}/endpoints/${encodeURIComponent(endpointId)}`
    )
    .then((res) => res.data);

export { COLLECTIONS_API };
