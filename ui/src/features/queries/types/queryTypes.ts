export interface AuditFields {
  createdAt: string | Date;
  createdBy: { name: string; avatarUrl?: string };
  updatedAt: string | Date;
  updatedBy: { name: string; avatarUrl?: string };
}

export interface QueryDefinition {
  id: string;
  name: string;
  description?: string;
  sql?: string;
  sqlQuery?: string;
  query?: string;
  statement?: string;
  queryText?: string;
  dataSource?: string;
  datasourceId?: string;
  dataSourceName?: string;
  datasourceName?: string;
  timeout?: number;
  timeoutMs?: number;
  parameters?: Record<string, string>;
  relatedWorkflows?: unknown[];
  createdBy?: string | AuditFields["createdBy"];
  updatedBy?: string | AuditFields["updatedBy"];
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface QueryPayload {
  id?: string;
  name: string;
  description?: string | null;
  sqlQuery?: string;
  sql?: string;
  dataSourceId?: string;
  datasourceId?: string;
  dataSource?: string;
  timeout?: number;
  timeoutMs?: number;
  parameters?: Record<string, string>;
  [key: string]: unknown;
}

export interface QueryExecutionPayload {
  queryId?: string;
  query?: string;
  datasource?: string;
  datasourceId?: string;
  dataSource?: string;
  dataSourceId?: string;
  sql?: string;
  sqlQuery?: string;
  timeout?: number;
  timeoutMs?: number;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface QueryExecutionResult {
  id?: string;
  name?: string;
  duration?: number;
  affectedRows?: number | null;
  size?: number | null;
  timeout?: number;
  reason?: unknown;
  resultSet?: unknown;
  status?: "SUCCESS" | "FAILED" | string;
  parameters?: Record<string, unknown>;
  errorCode?: string;
  [key: string]: unknown;
}
