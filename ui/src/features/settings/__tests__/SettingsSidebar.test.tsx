import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsSidebar } from "../components/SettingsSidebar/SettingsSidebar";
import { AuthContext } from "@/features/auth";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsSidebar />
    </MemoryRouter>
  );

const identity = () => screen.getByRole("button", { name: "Identity" });

describe("SettingsSidebar", () => {
  it("lists the Settings pages", () => {
    renderAt("/settings/migrations");
    expect(screen.getByRole("link", { name: "Migrations" })).toHaveAttribute("href", "/settings/migrations");
    expect(screen.getByRole("link", { name: "Configurations" })).toHaveAttribute("href", "/settings/configurations");
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/settings/identity/users");
    expect(screen.getByRole("link", { name: "Roles & Permissions" })).toHaveAttribute(
      "href",
      "/settings/identity/roles"
    );
  });

  it("marks the current page", () => {
    renderAt("/settings/configurations");
    expect(screen.getByRole("link", { name: "Configurations" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Migrations" })).not.toHaveAttribute("aria-current");
  });

  it("keeps Identity closed when none of its pages is open, and opens it on click", () => {
    renderAt("/settings/migrations");
    expect(identity()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(identity());
    expect(identity()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(identity());
    expect(identity()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens Identity by itself when one of its pages is active", () => {
    renderAt("/settings/identity/roles");
    expect(identity()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Roles & Permissions" })).toHaveAttribute("aria-current", "page");
  });

  it("links the Identity button to the list it controls", () => {
    renderAt("/settings/identity/users");
    const controlled = document.getElementById(identity().getAttribute("aria-controls") || "");
    expect(controlled).toContainElement(screen.getByRole("link", { name: "Users" }));
  });

  it("has a narrow-screen menu toggle that names the current page", () => {
    renderAt("/settings/identity/users");
    const toggle = screen.getByRole("button", { name: "Users" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("hides Audit Logs when user lacks audit related resource_access", () => {
    const userWithoutAudit = {
      username: "user",
      roles: ["conductor_admin", "database:read"],
      realmRoles: ["conductor_admin"],
      resourceAccess: {
        weaver: { roles: ["database:read"] },
      },
    };

    render(
      <MemoryRouter initialEntries={["/settings/migrations"]}>
        <AuthContext.Provider
          value={{
            isAuthenticated: true,
            isLoading: false,
            user: userWithoutAudit,
            token: "tok",
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: vi.fn(),
          }}
        >
          <SettingsSidebar />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Audit Logs" })).not.toBeInTheDocument();
  });

  it("shows Audit Logs when user has audit related resource_access", () => {
    const userWithAudit = {
      username: "user",
      roles: ["conductor_admin", "audit_log:read"],
      realmRoles: ["conductor_admin"],
      resourceAccess: {
        weaver: { roles: ["audit_log:read"] },
      },
    };

    render(
      <MemoryRouter initialEntries={["/settings/migrations"]}>
        <AuthContext.Provider
          value={{
            isAuthenticated: true,
            isLoading: false,
            user: userWithAudit,
            token: "tok",
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: vi.fn(),
          }}
        >
          <SettingsSidebar />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Audit Logs" })).toBeInTheDocument();
  });
});
