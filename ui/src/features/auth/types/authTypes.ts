export interface UserProfile {
  id?: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  roles: string[];
  realmRoles?: string[];
  clientRoles?: string[];
  resourceRoles?: string[];
  resourceAccess?: Record<string, { roles: string[] }>;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  token: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
}
