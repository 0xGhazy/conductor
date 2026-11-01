export const CONNECTION_STRATEGIES = [
  "OAUTH2",
  "API_KEY",
  "BASIC_AUTHENTICATION",
  "COOKIE",
];
export const OAUTH_GRANT_TYPES = ["CLIENT_CREDENTIALS", "PASSWORD", "AUTHORIZATION_CODE"];

export const buildEmptyConnection = () => ({
  id: null,
  name: "",
  strategy: "API_KEY",
  active: true,
  createdAt: "",
  apiKey: "",
  apiKeyHeader: "",
  cookie: "",
  cookieHeader: "",
  grantType: "CLIENT_CREDENTIALS",
  tokenEndpoint: "",
  clientId: "",
  clientSecret: "",
  resource: "",
  scope: "",
  username: "",
  password: "",
  code: "",
  codeVerifier: "",
  redirectUri: "",
});

export const normalizeConnection = (connection) => {
  const authConfig = connection?.authConfig || {};
  const rawActive =
    connection?.active ??
    connection?.status ??
    connection?.isActive ??
    connection?.enabled;
  const normalizedActive =
    typeof rawActive === "boolean"
      ? rawActive
      : typeof rawActive === "number"
        ? rawActive === 1
        : String(rawActive || "").trim().toUpperCase() === "TRUE" ||
          String(rawActive || "").trim().toUpperCase() === "ACTIVE" ||
          String(rawActive || "").trim().toUpperCase() === "ENABLED";
  return {
    ...buildEmptyConnection(),
    ...connection,
    active: normalizedActive,
    apiKey: authConfig.apiKey ?? connection?.apiKey ?? "",
    apiKeyHeader: authConfig.apiKeyHeader ?? connection?.apiKeyHeader ?? "",
    cookie: authConfig.cookie ?? connection?.cookie ?? "",
    cookieHeader: authConfig.cookieHeader ?? connection?.cookieHeader ?? "",
    grantType: authConfig.grantType ?? connection?.grantType ?? "CLIENT_CREDENTIALS",
    tokenEndpoint: authConfig.tokenEndpoint ?? connection?.tokenEndpoint ?? "",
    clientId: authConfig.clientId ?? connection?.clientId ?? "",
    clientSecret: authConfig.clientSecret ?? connection?.clientSecret ?? "",
    resource: authConfig.resource ?? connection?.resource ?? "",
    scope: authConfig.scope ?? connection?.scope ?? "",
    username: authConfig.username ?? connection?.username ?? "",
    password: authConfig.password ?? connection?.password ?? "",
    code: authConfig.code ?? connection?.code ?? "",
    codeVerifier: authConfig.codeVerifier ?? connection?.codeVerifier ?? "",
    redirectUri: authConfig.redirectUri ?? connection?.redirectUri ?? "",
  };
};

export const validateConnection = (connection) => {
  const errors = {};
  const name = connection.name?.trim() ?? "";
  if (!name || name.length < 3 || name.length > 50) {
    errors.name = "Name must be between 3 and 50 characters.";
  }
  if (!connection.strategy) {
    errors.strategy = "Strategy is required.";
  }
  if (connection.strategy === "API_KEY") {
    if (!connection.apiKey?.trim()) {
      errors.apiKey = "API key is required.";
    }
    if (!connection.apiKeyHeader?.trim()) {
      errors.apiKeyHeader = "API key header is required.";
    }
  }
  if (connection.strategy === "OAUTH2") {
    if (!connection.grantType) {
      errors.grantType = "Grant type is required.";
    }
    if (!connection.tokenEndpoint?.trim()) {
      errors.tokenEndpoint = "Token endpoint is required.";
    }
    if (!connection.clientId?.trim()) {
      errors.clientId = "Client ID is required.";
    }
    if (connection.grantType === "PASSWORD") {
      if (!connection.username?.trim()) {
        errors.username = "Username is required.";
      }
      if (!connection.password?.trim()) {
        errors.password = "Password is required.";
      }
    } else if (!connection.clientSecret?.trim()) {
      errors.clientSecret = "Client secret is required.";
    }
    if (connection.grantType === "AUTHORIZATION_CODE") {
      if (!connection.code?.trim()) {
        errors.code = "Code is required.";
      }
      if (!connection.redirectUri?.trim()) {
        errors.redirectUri = "Redirect URI is required.";
      }
    }
  }
  if (connection.strategy === "BASIC_AUTHENTICATION") {
    if (!connection.username?.trim()) {
      errors.username = "Username is required.";
    }
    if (!connection.password?.trim()) {
      errors.password = "Password is required.";
    }
  }
  if (connection.strategy === "COOKIE") {
    if (!connection.cookie?.trim()) {
      errors.cookie = "Cookie is required.";
    }
  }
  return errors;
};

export const buildConnectionPayload = (form) => {
  const basePayload = {
    name: form.name?.trim() ?? "",
    strategy: form.strategy,
  };

  if (form.strategy === "API_KEY") {
    return {
      ...basePayload,
      authConfig: {
        apiKey: form.apiKey,
        apiKeyHeader: form.apiKeyHeader,
      },
    };
  }

  if (form.strategy === "BASIC_AUTHENTICATION") {
    return {
      ...basePayload,
      authConfig: {
        username: form.username,
        password: form.password,
      },
    };
  }

  if (form.strategy === "COOKIE") {
    return {
      ...basePayload,
      authConfig: {
        cookie: form.cookie,
        cookieHeader: form.cookieHeader?.trim() || undefined,
      },
    };
  }

  return {
    ...basePayload,
    authConfig: {
      grantType: form.grantType,
      tokenEndpoint: form.tokenEndpoint,
      clientId: form.clientId,
      clientSecret: form.clientSecret,
      resource: form.grantType === "CLIENT_CREDENTIALS" ? form.resource : undefined,
      scope: form.scope,
      username: form.grantType === "PASSWORD" ? form.username : undefined,
      password: form.grantType === "PASSWORD" ? form.password : undefined,
      code: form.grantType === "AUTHORIZATION_CODE" ? form.code : undefined,
      codeVerifier:
        form.grantType === "AUTHORIZATION_CODE" ? form.codeVerifier : undefined,
      redirectUri:
        form.grantType === "AUTHORIZATION_CODE" ? form.redirectUri : undefined,
    },
  };
};

export const filterConnections = (connections, search) => {
  if (!search?.trim()) return connections;
  const q = search.toLowerCase();
  return connections.filter(
    (connection) =>
      connection.name?.toLowerCase().includes(q) ||
      connection.strategy?.toLowerCase().includes(q)
  );
};

