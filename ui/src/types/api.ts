/**
 * Shared API contracts and response wrappers across the application.
 * Follows ADR-02 Unified REST Envelope schema.
 */

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  reason?: string;
  details?: Record<string, unknown> | null;
  timestamp?: string;
  path?: string;
  status?: string | number;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  status?: string | number;
  message?: string;
  code?: string;
  data?: T;
  details?: Record<string, unknown> | null;
  error?: ApiErrorPayload | string | null;
  timestamp?: string;
  requestId?: string;
  path?: string;
  retryable?: boolean;
}

export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
  search?: string;
  [key: string]: unknown;
}

export interface PaginatedData<T> {
  content?: T[];
  items?: T[];
  records?: T[];
  totalElements?: number;
  totalItems?: number;
  totalPages?: number;
  page?: number;
  size?: number;
  numberOfElements?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}
