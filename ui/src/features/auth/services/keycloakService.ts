import Keycloak from "keycloak-js";
import { config } from "@/config/appConfig";
import type { UserProfile } from "../types/authTypes";

const keycloak = new Keycloak({
  url: config.keycloak.url,
  realm: config.keycloak.realm,
  clientId: config.keycloak.clientId,
});

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;
let refreshPromise: Promise<string> | null = null;
let refreshTimerId: number | null = null;

type TokenListener = (token: string | null) => void;

const tokenListeners = new Set<TokenListener>();

const notifyTokenListeners = (token: string | null) => {
  tokenListeners.forEach((listener) => listener(token));
};

// Last token set written to storage. getAccessToken() runs on every API request, so skipping
// unchanged syncs avoids redundant localStorage writes and auth context re-renders.
let lastSyncedTokens: string | null = null;

export const syncLocalStorageTokens = (
  token?: string,
  refreshToken?: string,
  idToken?: string
) => {
  const signature = `${token ?? ""}\n${refreshToken ?? ""}\n${idToken ?? ""}`;
  if (signature === lastSyncedTokens) {
    return;
  }
  lastSyncedTokens = signature;

  if (token) {
    localStorage.setItem("access_token", token);
    localStorage.setItem("cwAccessToken", token);
  } else {
    localStorage.removeItem("access_token");
    localStorage.removeItem("cwAccessToken");
  }

  if (refreshToken) {
    localStorage.setItem("cwRefreshToken", refreshToken);
  } else {
    localStorage.removeItem("cwRefreshToken");
  }

  if (idToken) {
    localStorage.setItem("cwIdToken", idToken);
  } else {
    localStorage.removeItem("cwIdToken");
  }

  notifyTokenListeners(token || null);
};

export const isKeycloakInitialized = (): boolean => isInitialized;

export const subscribeToTokenChanges = (listener: TokenListener): (() => void) => {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
};

const clearRefreshTimer = () => {
  if (refreshTimerId !== null) {
    window.clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
};

const scheduleTokenRefresh = () => {
  clearRefreshTimer();

  const expiresAtSeconds = keycloak.tokenParsed?.exp;
  if (!keycloak.authenticated || !expiresAtSeconds) {
    return;
  }

  const refreshInMs = Math.max(expiresAtSeconds * 1000 - Date.now() - 60_000, 5_000);
  refreshTimerId = window.setTimeout(() => {
    refreshToken().catch((error) => {
      console.warn("[Keycloak] Scheduled token refresh failed:", error);
    });
  }, refreshInMs);
};

export const initKeycloak = async (onLoad: "check-sso" | "login-required" = "check-sso"): Promise<boolean> => {
  if (isInitialized) {
    return !!keycloak.authenticated;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = keycloak
    .init({
      onLoad,
      checkLoginIframe: false,
      pkceMethod: "S256",
    })
    .then((authenticated) => {
      isInitialized = true;
      if (authenticated && keycloak.token) {
        sessionStorage.removeItem("weaver_logged_out");
        syncLocalStorageTokens(keycloak.token, keycloak.refreshToken, keycloak.idToken);
        scheduleTokenRefresh();
      } else {
        syncLocalStorageTokens();
        clearRefreshTimer();
      }

      // Automatically refresh token when close to expiry
      keycloak.onTokenExpired = () => {
        refreshToken().catch(() => {
          syncLocalStorageTokens();
          clearRefreshTimer();
        });
      };

      keycloak.onAuthRefreshSuccess = () => {
        if (keycloak.token) {
          syncLocalStorageTokens(keycloak.token, keycloak.refreshToken, keycloak.idToken);
        }
        scheduleTokenRefresh();
      };

      keycloak.onAuthRefreshError = () => {
        clearRefreshTimer();
        syncLocalStorageTokens();
      };

      keycloak.onAuthLogout = () => {
        clearRefreshTimer();
        syncLocalStorageTokens();
      };

      return !!authenticated;
    })
    .catch((error) => {
      console.error("[Keycloak] Initialization error:", error);
      isInitialized = true;
      syncLocalStorageTokens();
      clearRefreshTimer();
      return false;
    });

  return initPromise;
};

export const getAccessToken = async (): Promise<string> => {
  // If Keycloak is currently initializing (e.g. processing OAuth code redirect), await it
  if (initPromise && !isInitialized) {
    try {
      await initPromise;
    } catch {
      // Continue to check local state
    }
  }

  if (keycloak.authenticated) {
    try {
      // Refresh token if within 30 seconds of expiry
      const refreshed = await keycloak.updateToken(30);
      if (keycloak.token) {
        syncLocalStorageTokens(keycloak.token, keycloak.refreshToken, keycloak.idToken);
        if (refreshed) {
          scheduleTokenRefresh();
        }
        return keycloak.token;
      }
    } catch {
      console.warn("[Keycloak] Failed to refresh token.");
    }

    if (keycloak.token) {
      return keycloak.token;
    }
  }

  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("cwAccessToken") ||
    ""
  );
};

export const refreshToken = async (): Promise<string> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  if (initPromise && !isInitialized) {
    try {
      await initPromise;
    } catch {
      // ignore
    }
  }

  if (!keycloak.authenticated) {
    return "";
  }

  refreshPromise = keycloak.updateToken(-1)
    .then(() => {
      if (keycloak.token) {
        syncLocalStorageTokens(keycloak.token, keycloak.refreshToken, keycloak.idToken);
        scheduleTokenRefresh();
        return keycloak.token;
      }
      return "";
    })
    .catch((error) => {
      console.warn("[Keycloak] Forced token refresh failed:", error);
      clearRefreshTimer();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

export const login = async (options?: Keycloak.KeycloakLoginOptions): Promise<void> => {
  sessionStorage.removeItem("weaver_logged_out");

  const currentTheme =
    localStorage.getItem("theme") ||
    (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  try {
    const loginUrl = await keycloak.createLoginUrl(options);
    const parsedUrl = new URL(loginUrl);
    parsedUrl.searchParams.set("theme", currentTheme);
    window.location.assign(parsedUrl.toString());
  } catch (err) {
    // Fallback to standard keycloak login if createLoginUrl fails
    await keycloak.login(options);
  }
};

export const logout = async (options?: Keycloak.KeycloakLogoutOptions): Promise<void> => {
  clearRefreshTimer();

  // Flag session as explicitly logged out to prevent ProtectedRoute from auto-initiating login()
  sessionStorage.setItem("weaver_logged_out", "true");
  sessionStorage.removeItem("user_avatar_color");

  const refreshTokenVal = keycloak.refreshToken || localStorage.getItem("cwRefreshToken");
  const idToken = keycloak.idToken || localStorage.getItem("cwIdToken") || undefined;
  const redirectUri = options?.redirectUri || window.location.origin;

  // Best-effort backchannel session termination via Keycloak OIDC logout endpoint
  if (refreshTokenVal) {
    try {
      await fetch(
        `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/logout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: config.keycloak.clientId,
            refresh_token: refreshTokenVal,
          }),
          mode: "no-cors",
        }
      );
    } catch {
      // Continue to browser logout navigation
    }
  }

  // Clear all local storage tokens & notify listeners
  syncLocalStorageTokens();

  if (keycloak.clearToken) {
    try {
      keycloak.clearToken();
    } catch {
      // ignore
    }
  }

  // Construct frontchannel GET logout URL with id_token_hint for Keycloak 26 RP-Initiated Logout
  let logoutUrl = "";
  try {
    logoutUrl = keycloak.createLogoutUrl({
      logoutMethod: "GET",
      redirectUri,
      ...options,
    });
    if (idToken && !logoutUrl.includes("id_token_hint")) {
      const urlObj = new URL(logoutUrl);
      urlObj.searchParams.set("id_token_hint", idToken);
      logoutUrl = urlObj.toString();
    }
  } catch {
    const params = new URLSearchParams({
      client_id: config.keycloak.clientId,
      post_logout_redirect_uri: redirectUri,
    });
    if (idToken) {
      params.set("id_token_hint", idToken);
    }
    logoutUrl = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/logout?${params.toString()}`;
  }

  // Direct frontchannel navigation clears Keycloak SSO browser cookies and returns to redirectUri
  window.location.replace(logoutUrl);

  // Return pending promise so downstream unmounting components do not execute further logic
  return new Promise(() => {});
};

export const getUserProfile = (): UserProfile | null => {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    return null;
  }

  const token = keycloak.tokenParsed as Record<string, any>;
  const realmRoles: string[] = token?.realm_access?.roles || [];
  const clientRoles: string[] = token?.resource_access?.[config.keycloak.clientId]?.roles || [];
  const allRoles = Array.from(new Set([...realmRoles, ...clientRoles]));

  return {
    id: token.sub,
    username: token.preferred_username || token.sub || "",
    email: token.email,
    firstName: token.given_name,
    lastName: token.family_name,
    fullName:
      token.name ||
      [token.given_name, token.family_name].filter(Boolean).join(" ") ||
      token.preferred_username,
    roles: allRoles,
  };
};

export const hasRole = (role: string): boolean => {
  const profile = getUserProfile();
  return profile ? profile.roles.includes(role) : false;
};

export const getKeycloakInstance = () => keycloak;
