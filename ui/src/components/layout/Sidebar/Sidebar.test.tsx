import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSidebarStore } from "@/store/useSidebarStore";
import { AuthContext } from "@/features/auth";

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

describe("Sidebar", () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: false });
  });

  it("lists Queries right after Databases", () => {
    renderSidebar();
    const databases = screen.getByRole("link", { name: "Databases" });
    const queries = screen.getByRole("link", { name: "Queries" });
    expect(databases.nextElementSibling).toBe(queries);
  });

  it("places Workbench in the Orchestration group", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Workbench" })).toBeInTheDocument();
  });

  it("opens and closes when the Weaver logo is clicked", () => {
    renderSidebar();
    const logo = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(logo).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(logo);
    expect(useSidebarStore.getState().collapsed).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it("has no separate collapse button", () => {
    renderSidebar();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("collapses the sidebar automatically when clicking on Settings", () => {
    renderSidebar();
    expect(useSidebarStore.getState().collapsed).toBe(false);

    const settingsLink = screen.getByRole("link", { name: "Settings" });
    fireEvent.click(settingsLink);

    expect(useSidebarStore.getState().collapsed).toBe(true);
  });

  it.each([
    "/settings/migrations",
    "/settings/configurations",
    "/settings/identity/users",
    "/settings/languages",
  ])("highlights Settings on %s", (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  it("maintains stable DOM references during rapid toggling without unmounting links", () => {
    renderSidebar();
    const dbLinkBefore = screen.getByRole("link", { name: "Databases" });
    const logo = screen.getByRole("button", { name: "Collapse sidebar" });

    // Rapid toggle multiple times
    fireEvent.click(logo);
    fireEvent.click(logo);
    fireEvent.click(logo);

    const dbLinkAfter = screen.getByRole("link", { name: "Databases" });
    expect(dbLinkBefore).toBe(dbLinkAfter);
  });

  it("hides Settings when user lacks conductor_admin realm role", () => {
    const userWithoutAdmin = {
      username: "user",
      roles: ["database:read"],
      realmRoles: [],
      resourceAccess: {
        weaver: { roles: ["database:read"] },
      },
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            isAuthenticated: true,
            isLoading: false,
            user: userWithoutAdmin,
            token: "tok",
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: vi.fn(),
          }}
        >
          <Sidebar />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows Settings when user has conductor_admin realm role", () => {
    const adminUser = {
      username: "admin",
      roles: ["conductor_admin", "database:read"],
      realmRoles: ["conductor_admin"],
      resourceAccess: {
        weaver: { roles: ["database:read"] },
      },
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            isAuthenticated: true,
            isLoading: false,
            user: adminUser,
            token: "tok",
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: vi.fn(),
          }}
        >
          <Sidebar />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides Databases when user lacks database related resource_access", () => {
    const userWithoutDb = {
      username: "user",
      roles: ["conductor_admin"],
      realmRoles: ["conductor_admin"],
      resourceAccess: {
        weaver: { roles: ["audit_log:read"] },
      },
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            isAuthenticated: true,
            isLoading: false,
            user: userWithoutDb,
            token: "tok",
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: vi.fn(),
          }}
        >
          <Sidebar />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Databases" })).not.toBeInTheDocument();
  });

  it("shows Databases when user has database related resource_access", () => {
    const userWithDb = {
      username: "user",
      roles: ["database:read"],
      realmRoles: [],
      resourceAccess: {
        weaver: { roles: ["database:read"] },
      },
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            isAuthenticated: true,
            isLoading: false,
            user: userWithDb,
            token: "tok",
            login: vi.fn(),
            logout: vi.fn(),
            hasRole: vi.fn(),
          }}
        >
          <Sidebar />
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Databases" })).toBeInTheDocument();
  });
});
