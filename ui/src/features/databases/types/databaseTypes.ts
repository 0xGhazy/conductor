export type DatasourceType = "POSTGRES" | "MYSQL" | "ORACLE" | string;
export type DatabaseType = DatasourceType;

export interface DatasourceConnectionDetails {
  url?: string;
  username?: string;
  password?: string;
  maximumPoolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  schema?: string;
  [key: string]: unknown;
}
export type DatabaseConnectionDetails = DatasourceConnectionDetails;

/**
 * A Keycloak user as the server returns it in createdBy / updatedBy. Only the id is stored;
 * name and email are present when the user is known.
 */
export interface AuditUser {
  id: string;
  name?: string;
  email?: string;
}

export interface DatasourceStatusDetails {
  status?: string;
  message?: string;
  reason?: string;
  lastCheck?: string | null;
  lastChecked?: string | null;
  [key: string]: unknown;
}
export type DatabaseStatusDetails = DatasourceStatusDetails;

/** A datasource `status` may be a plain string or a details object; always get the object. */
export const toStatusDetails = (
  status?: string | DatasourceStatusDetails | null
): DatasourceStatusDetails | undefined =>
  status && typeof status === "object" ? status : status ? { status } : undefined;

export interface Datasource {
  id: string;
  name: string;
  type: DatasourceType;
  category?: string;
  status?: string | DatasourceStatusDetails;
  url?: string;
  username?: string;
  password?: string;
  maximumPoolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  schema?: string;
  connection?: DatasourceConnectionDetails;
  connectionDetails?: DatasourceConnectionDetails;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Who created it (null when unknown, for example with security disabled). */
  createdBy?: AuditUser | string | null;
  /** Who last changed it. */
  updatedBy?: AuditUser | string | null;
  queries?: unknown[];
  [key: string]: unknown;
}
export type DatabaseDefinition = Datasource;

export interface DatasourcePayload {
  name: string;
  type: DatasourceType;
  category?: string;
  connection?: DatasourceConnectionDetails;
  connectionDetails?: DatasourceConnectionDetails;
  url?: string;
  username?: string;
  password?: string;
  maximumPoolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  schema?: string;
  [key: string]: unknown;
}
export type DatabasePayload = DatasourcePayload;
