import { describe, it, expect } from "vitest";
import {
  hasRealmRole,
  hasAdminRole,
  hasDatabaseAccess,
  hasAuditAccess,
  getResourceRoles,
} from "../utils/authPermissions";
import type { UserProfile } from "../types/authTypes";

describe("authPermissions", () => {
  const exampleUserToken: UserProfile = {
    username: "admin",
    fullName: "Hossam Hamdy",
    roles: [
      "conductor_admin",
      "database:read",
      "database:write",
      "database:update",
      "audit_log:read",
      "database:delete",
    ],
    realmRoles: ["conductor_admin"],
    resourceAccess: {
      weaver: {
        roles: [
          "database:read",
          "database:write",
          "database:update",
          "audit_log:read",
          "database:delete",
        ],
      },
    },
  };

  it("detects conductor_admin realm role", () => {
    expect(hasAdminRole(exampleUserToken)).toBe(true);
    expect(hasRealmRole(exampleUserToken, "conductor_admin")).toBe(true);

    const nonAdminUser: UserProfile = {
      username: "user",
      roles: ["conductor_viewer"],
      realmRoles: ["conductor_viewer"],
    };
    expect(hasAdminRole(nonAdminUser)).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
    expect(hasAdminRole(undefined)).toBe(false);
  });

  it("detects database related resource_access", () => {
    expect(hasDatabaseAccess(exampleUserToken)).toBe(true);

    const userWithDbWriteOnly: UserProfile = {
      username: "writer",
      roles: [],
      resourceAccess: {
        weaver: { roles: ["database:write"] },
      },
    };
    expect(hasDatabaseAccess(userWithDbWriteOnly)).toBe(true);

    const userWithoutDb: UserProfile = {
      username: "viewer",
      roles: ["conductor_viewer"],
      realmRoles: ["conductor_viewer"],
      resourceAccess: {
        weaver: { roles: ["query:read", "audit_log:read"] },
      },
    };
    expect(hasDatabaseAccess(userWithoutDb)).toBe(false);
    expect(hasDatabaseAccess(null)).toBe(false);
    expect(hasDatabaseAccess(undefined)).toBe(false);
  });

  it("detects audit related resource_access", () => {
    expect(hasAuditAccess(exampleUserToken)).toBe(true);

    const userWithAuditRead: UserProfile = {
      username: "auditor",
      roles: [],
      resourceAccess: {
        weaver: { roles: ["audit:read"] },
      },
    };
    expect(hasAuditAccess(userWithAuditRead)).toBe(true);

    const userWithoutAudit: UserProfile = {
      username: "developer",
      roles: ["conductor_admin"],
      realmRoles: ["conductor_admin"],
      resourceAccess: {
        weaver: { roles: ["database:read", "database:write"] },
      },
    };
    expect(hasAuditAccess(userWithoutAudit)).toBe(false);
    expect(hasAuditAccess(null)).toBe(false);
    expect(hasAuditAccess(undefined)).toBe(false);
  });

  it("extracts resource roles across multiple clients", () => {
    const multiClientUser: UserProfile = {
      username: "service",
      roles: [],
      resourceAccess: {
        weaver: { roles: ["database:read"] },
        conductor: { roles: ["audit_log:read"] },
      },
    };
    const roles = getResourceRoles(multiClientUser);
    expect(roles).toContain("database:read");
    expect(roles).toContain("audit_log:read");
  });
});

