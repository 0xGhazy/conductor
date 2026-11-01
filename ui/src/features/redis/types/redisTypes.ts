export interface RedisDatasource {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  databaseIndex?: number;
  ssl?: boolean;
  timeoutMs?: number;
  active?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface RedisDatasourcePayload {
  name: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  databaseIndex?: number;
  ssl?: boolean;
  timeoutMs?: number;
  active?: boolean;
  [key: string]: unknown;
}

export interface RedisConnectionStatus {
  connected?: boolean;
  status?: string;
  message?: string;
  latencyMs?: number;
  [key: string]: unknown;
}
