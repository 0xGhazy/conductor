import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthContextType, UserProfile } from "../types/authTypes";
import {
  getUserProfile,
  hasRole as checkHasRole,
  initKeycloak,
  login as keycloakLogin,
  logout as keycloakLogout,
  getKeycloakInstance,
  subscribeToTokenChanges,
} from "../services/keycloakService";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    initKeycloak("check-sso")
      .then((authenticated) => {
        if (!isMounted) return;

        setIsAuthenticated(authenticated);
        if (authenticated) {
          sessionStorage.removeItem("weaver_logged_out");
          setUser(getUserProfile());
          setToken(getKeycloakInstance().token || null);
        } else {
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToTokenChanges((nextToken) => {
      if (!isMounted) return;

      const authenticated = !!nextToken && !!getKeycloakInstance().authenticated;
      setIsAuthenticated(authenticated);
      setToken(nextToken);
      setUser(authenticated ? getUserProfile() : null);
      if (authenticated) {
        sessionStorage.removeItem("weaver_logged_out");
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async () => {
    sessionStorage.removeItem("weaver_logged_out");
    await keycloakLogin();
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    await keycloakLogout();
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
  }, []);

  const hasRole = useCallback((role: string): boolean => checkHasRole(role), []);

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      token,
      login,
      logout,
      hasRole,
    }),
    [isAuthenticated, isLoading, user, token, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
