export type CollectionType = "POSTMAN" | "SWAGGER" | string;

export interface EndpointConfig {
  method: string;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown;
}

export interface CollectionEndpoint {
  id?: string;
  endpointId?: string;
  name: string;
  description?: string;
  connection?: string | null;
  config: EndpointConfig;
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export interface ApiCollection {
  id: string;
  name: string;
  description?: string;
  connection?: string | null;
  type?: CollectionType;
  endpoints?: CollectionEndpoint[];
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
}

export interface ApiCollectionPayload {
  name: string;
  description?: string;
  connection?: string | null;
  type?: CollectionType;
  [key: string]: unknown;
}

export interface CollectionImportPayload extends ApiCollectionPayload {
  endpoints?: Array<{
    name: string;
    description?: string;
    connection?: string | null;
    config: EndpointConfig;
  }>;
}
