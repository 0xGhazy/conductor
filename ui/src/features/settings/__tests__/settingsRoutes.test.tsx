import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, useLocation } from "react-router-dom";
import AppRoutes from "@/routes/AppRoutes";

// Only what is outside the Settings area is stubbed: auth, the app shell and the code editor.
vi.mock("@/routes/ProtectedRoute", () => ({ default: () => <Outlet /> }));
vi.mock("@/app/layout/AppLayout", () => ({ default: () => <Outlet context={{ search: "", setSearch: () => {} }} /> }));
vi.mock("@/components/common/editors", () => ({ WeaverCodeEditor: () => <div data-testid="code-editor" /> }));
vi.mock("@/pages/Settings/SupportedLanguagesPage", () => ({ default: () => <h1>Languages</h1> }));
vi.mock("@/features/settings/hooks/useAuditLogs", () => ({
  auditLogKeys: { all: ["auditLogs"] },
  useAuditEvents: () => ({ data: { items: [], total: 0 }, isPending: false, isFetching: false, refetch: vi.fn() }),
  useAuditEvent: () => ({ data: undefined, isPending: false }),
  useAuditFacets: () => ({ data: { enabled: true, readable: true, resourceTypes: [], statuses: [], actions: [] } }),
  useAuditHistogram: () => ({ data: [], isPending: false, isFetching: false }),
}));

const Location = () => <div data-testid="location">{useLocation().pathname}</div>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <Location />
    </MemoryRouter>
  );

describe("Settings routes", () => {
  it.each([
    ["/settings/migrations", "Migrations"],
    ["/settings/configurations", "Configurations"],
    ["/settings/audit-logs", "Audit Logs"],
    ["/settings/identity/users", "Users"],
    ["/settings/identity/roles", "Roles & Permissions"],
    ["/settings/languages", "Languages"],
  ])("%s shows the %s page inside the Settings layout", { timeout: 20000 }, async (path, title) => {
    renderAt(path);
    // Pages load lazily; Migrations pulls in the designer code, so allow time for it.
    expect(
      await screen.findByRole("heading", { level: 1, name: title }, { timeout: 15000 })
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Settings" })).toBeInTheDocument();
  });

  it.each([
    ["/settings", "/settings/migrations"],
    ["/settings/identity", "/settings/identity/users"],
    ["/settings/migration", "/settings/migrations"],
  ])("%s redirects to %s", { timeout: 20000 }, async (from, to) => {
    renderAt(from);
    await screen.findByRole("heading", { level: 1 }, { timeout: 15000 });
    expect(screen.getByTestId("location")).toHaveTextContent(to);
  });


});
