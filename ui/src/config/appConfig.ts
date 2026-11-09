const baseConfig = {
  appName: "Weaver",
  requestTimeoutMs: 15000,
};

export const config = {
  ...baseConfig,
  apiBaseUrl: import.meta?.env?.VITE_API_BASE_URL || "",
  // Same server as apiBaseUrl; set only if workflow APIs are served from somewhere else.
  weaverApiBaseUrl:
    import.meta?.env?.VITE_WEAVER_API_BASE_URL || import.meta?.env?.VITE_API_BASE_URL || "",
  restApiUrl: "",
  connectionsTtlMs: 300000,
  scriptsTtlMs: 300000,
  queriesTtlMs: 300000,
  builderSchemaVersion: 2,
  keycloak: {
    url: import.meta?.env?.VITE_KEYCLOAK_URL || "http://localhost:8085",
    realm: import.meta?.env?.VITE_KEYCLOAK_REALM || "weaver",
    clientId: import.meta?.env?.VITE_KEYCLOAK_CLIENT_ID || "weaver",
  },
};
