import axios from "axios";
import { getAccessToken as getKeycloakToken, refreshToken as refreshKeycloakToken } from "@/features/auth";

const ACCESS_TOKEN_KEY = "access_token";
const LEGACY_ACCESS_TOKEN_KEY = "cwAccessToken";
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

const readAccessToken = (): string =>
  localStorage.getItem(ACCESS_TOKEN_KEY) ||
  localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) ||
  "";

const clearAccessToken = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
};

const apiClient = axios.create({
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
});

apiClient.interceptors.request.use(async (config) => {
  let token = "";
  try {
    token = await getKeycloakToken();
  } catch {
    token = readAccessToken();
  }
  if (!token) {
    token = readAccessToken();
  }

  if (token) {
    if (config.headers && typeof (config.headers as any).set === "function") {
      (config.headers as any).set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = Number(error?.response?.status || 0);

    // Normalize timeout errors to provide a clear, user-friendly timeout message
    if (
      error?.code === "ECONNABORTED" ||
      String(error?.message || "").toLowerCase().includes("timeout")
    ) {
      error.message = `Request timed out after ${DEFAULT_REQUEST_TIMEOUT_MS / 1000} seconds`;
    }

    const originalRequest = error?.config;

    // Auto-refresh token on 401 if request hasn't been retried yet
    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshedToken = await refreshKeycloakToken();
        if (refreshedToken) {
          if (originalRequest.headers && typeof (originalRequest.headers as any).set === "function") {
            (originalRequest.headers as any).set("Authorization", `Bearer ${refreshedToken}`);
          } else {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["Authorization"] = `Bearer ${refreshedToken}`;
          }
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        console.warn("[apiClient] Token refresh failed on 401:", refreshErr);
      }
    }

    return Promise.reject(error);
  },
);

export { clearAccessToken, readAccessToken, DEFAULT_REQUEST_TIMEOUT_MS };
export default apiClient;

