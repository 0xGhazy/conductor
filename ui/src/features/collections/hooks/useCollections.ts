import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginationParams } from "@/types/api";
import {
  fetchCollectionById,
  fetchCollectionEndpoint,
  fetchCollectionEndpoints,
  fetchCollections,
} from "@/features/collections/services/apiCollectionsApi";
import { collectionKeys } from "@/features/collections/hooks/queryKeys";

/** Paged list of API collections (raw API response). Keeps previous page data while fetching. */
export const useCollectionsList = (params: PaginationParams) =>
  useQuery({
    queryKey: collectionKeys.list(params),
    queryFn: () => fetchCollections(params),
    placeholderData: keepPreviousData,
  });

/** Single API collection by id (raw API response). */
export const useCollection = (id: string | undefined, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: collectionKeys.detail(String(id ?? "")),
    queryFn: () => fetchCollectionById(String(id)),
    enabled: (options.enabled ?? true) && Boolean(id),
  });

const COLLECTION_ENDPOINTS_PARAMS: PaginationParams = { page: 0, size: 500 };

/** All endpoints of a collection (first 500, raw API response). */
export const useCollectionEndpoints = (
  collectionId: string | undefined,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: collectionKeys.endpoints(String(collectionId ?? "")),
    queryFn: () => fetchCollectionEndpoints(String(collectionId), COLLECTION_ENDPOINTS_PARAMS),
    enabled: (options.enabled ?? true) && Boolean(collectionId),
  });

/** Single collection endpoint (raw API response). */
export const useCollectionEndpoint = (
  collectionId: string | undefined,
  endpointId: string | undefined,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: collectionKeys.endpoint(String(collectionId ?? ""), String(endpointId ?? "")),
    queryFn: () => fetchCollectionEndpoint(String(collectionId), String(endpointId)),
    enabled: (options.enabled ?? true) && Boolean(collectionId) && Boolean(endpointId),
  });
