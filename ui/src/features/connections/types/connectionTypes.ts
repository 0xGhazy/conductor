export type ConnectionStrategy = "OAUTH2" | "API_KEY" | "BASIC_AUTHENTICATION" | "COOKIE" | string;

export type OAuthGrantType = "CLIENT_CREDENTIALS" | "PASSWORD" | "AUTHORIZATION_CODE" | string;

export interface ConnectionAuthConfig {
  apiKey?: string;
  apiKeyHeader?: string;
  cookie?: string;
  cookieHeader?: string;
  grantType?: OAuthGrantType;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  resource?: string;
  scope?: string;
  username?: string;
  password?: string;
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  [key: string]: unknown;
}

export interface HttpConnection {
  id: string;
  name: string;
  strategy: ConnectionStrategy;
  active?: boolean;
  status?: string | boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  authConfig?: ConnectionAuthConfig;
  apiKey?: string;
  apiKeyHeader?: string;
  cookie?: string;
  cookieHeader?: string;
  grantType?: OAuthGrantType;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  resource?: string;
  scope?: string;
  username?: string;
  password?: string;
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  [key: string]: unknown;
}

export interface HttpConnectionPayload {
  name: string;
  strategy: ConnectionStrategy;
  active?: boolean;
  authConfig?: ConnectionAuthConfig;
  [key: string]: unknown;
}
