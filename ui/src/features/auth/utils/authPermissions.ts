import type { UserProfile } from "../types/authTypes";

/**
 * Extracts all resource roles across all clients in resource_access.
 */
export function getResourceRoles(user: UserProfile | null | undefined): string[] {
  if (!user) return [];
  if (Array.isArray(user.resourceRoles) && user.resourceRoles.length > 0) {
    return user.resourceRoles;
  }
  if (user.resourceAccess && typeof user.resourceAccess === "object") {
    const collected: string[] = [];
    Object.values(user.resourceAccess).forEach((entry) => {
      if (Array.isArray(entry?.roles)) {
        collected.push(...entry.roles);
      }
    });
    if (collected.length > 0) {
      return Array.from(new Set(collected));
    }
  }
  if (Array.isArray(user.clientRoles) && user.clientRoles.length > 0) {
    return user.clientRoles;
  }
  // Fallback: roles containing a colon like "database:read", "audit_log:read"
  return (user.roles || []).filter((r) => r.includes(":"));
}

/**
 * Checks if the user has a specific realm role from realm_access.roles (or roles array).
 */
export function hasRealmRole(user: UserProfile | null | undefined, roleName: string): boolean {
  if (!user) return false;
  const realmRoles =
    Array.isArray(user.realmRoles) && user.realmRoles.length > 0
      ? user.realmRoles
      : user.roles || [];
  return realmRoles.includes(roleName);
}

/**
 * Checks if the user has the "conductor_admin" realm role.
 */
export function hasAdminRole(user: UserProfile | null | undefined): boolean {
  return hasRealmRole(user, "conductor_admin");
}

/**
 * Checks if the user has database-related resource_access permissions
 * (e.g. database:read, database:write, database:update, database:delete).
 */
export function hasDatabaseAccess(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const roles = getResourceRoles(user);
  return roles.some(
    (role) =>
      role === "database" ||
      role.startsWith("database:") ||
      role.includes("database")
  );
}

/**
 * Checks if the user has audit-related resource_access permissions
 * (e.g. audit_log:read, audit:read).
 */
export function hasAuditAccess(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const roles = getResourceRoles(user);
  return roles.some(
    (role) =>
      role === "audit" ||
      role === "audit_log" ||
      role.startsWith("audit:") ||
      role.startsWith("audit_log:") ||
      role.includes("audit")
  );
}

