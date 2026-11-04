import { getAccessToken, refreshToken } from "@/features/auth";
import { config } from "@/config/appConfig";

let isInstalled = false;

/**
 * Installs a global window.fetch interceptor that automatically attaches the Keycloak
 * Bearer token to all requests directed at the backend, and automatically retries once
 * on HTTP 401 after refreshing the token.
 */
export function installFetchInterceptor(): void {
  if (isInstalled || typeof window === "undefined" || !window.fetch) {
    return;
  }
  isInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlString = "";
    if (typeof input === "string") {
      urlString = input;
    } else if (input instanceof URL) {
      urlString = input.toString();
    } else if (input && typeof (input as Request).url === "string") {
      urlString = (input as Request).url;
    }

    const backendBases = [config.apiBaseUrl, config.conductorApiBaseUrl].filter(Boolean) as string[];
    const isBackendRequest =
      urlString.startsWith("/api") ||
      urlString.startsWith("/health") ||
      backendBases.some((base) => urlString.startsWith(base));

    if (!isBackendRequest) {
      return originalFetch(input, init);
    }

    let token = await getAccessToken();

    const applyAuthHeader = (headers: Headers, bearerToken: string): Headers => {
      if (bearerToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${bearerToken}`);
      }
      return headers;
    };

    let requestHeaders = new Headers(
      init?.headers || (input instanceof Request ? input.headers : {})
    );

    if (token) {
      requestHeaders = applyAuthHeader(requestHeaders, token);
    }

    const modifiedInit: RequestInit = {
      ...init,
      headers: requestHeaders,
    };

    let response = await originalFetch(input, modifiedInit);

    // If 401 Unauthorized, attempt token refresh and retry once
    if (response.status === 401) {
      try {
        const refreshedToken = await refreshToken();
        if (refreshedToken) {
          const retryHeaders = new Headers(
            init?.headers || (input instanceof Request ? input.headers : {})
          );
          retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
          response = await originalFetch(input, {
            ...init,
            headers: retryHeaders,
          });
        }
      } catch (err) {
        console.warn("[FetchInterceptor] Refresh on 401 failed:", err);
      }
    }

    return response;
  };
}
