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

export interface DatasourceStatusDetails {
  status?: string;
  message?: string;
  reason?: string;
  lastCheck?: string | null;
  lastChecked?: string | null;
  [key: string]: unknown;
}
export type DatabaseStatusDetails = DatasourceStatusDetails;

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
  createdBy?: string;
  updatedBy?: string;
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
