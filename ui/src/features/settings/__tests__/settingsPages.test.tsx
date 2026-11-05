import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SettingsConfigurationsPage from "@/pages/Settings/SettingsConfigurationsPage";
import SettingsUsersPage from "@/pages/Settings/SettingsUsersPage";
import SettingsRolesPage from "@/pages/Settings/SettingsRolesPage";

const renderPage = (page: ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

describe("Settings pages", () => {
  it("Configurations is a read-only preview of real settings", () => {
    renderPage(<SettingsConfigurationsPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Read-only preview");
    expect(screen.getByText("weaver.database.execute.max-rows")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save|edit|apply/i })).toBeNull();
    expect(document.title).toBe("Weaver - Settings - Configurations");
  });

  it("Users says it shows sample data and links to Keycloak", () => {
    renderPage(<SettingsUsersPage />);
    expect(screen.getByRole("note")).toHaveTextContent("Sample data");
    expect(screen.getByText("Conductor Admin")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Manage users in Keycloak/ });
    expect(link).toHaveAttribute("href", expect.stringMatching(/\/admin\/master\/console\/#\/weaver\/users$/));
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("button", { name: /add user|invite|delete/i })).toBeNull();
  });

  it("Roles & Permissions shows who may do what", () => {
    renderPage(<SettingsRolesPage />);
    const table = screen.getByRole("table", { name: "Permissions by role" });
    const adminRow = within(table).getByRole("row", { name: /Server administration/ });
    const cells = within(adminRow).getAllByRole("cell");
    // Admin, Operator, Viewer, Worker
    expect(within(cells[0]).getByLabelText("Allowed")).toBeInTheDocument();
    expect(within(cells[1]).getByLabelText("Not allowed")).toBeInTheDocument();
    expect(within(cells[2]).getByLabelText("Not allowed")).toBeInTheDocument();

    const definitionsRow = within(table).getByRole("row", { name: /workflow and task definitions/ });
    const defCells = within(definitionsRow).getAllByRole("cell");
    expect(within(defCells[1]).getByLabelText("Allowed")).toBeInTheDocument();
    expect(within(defCells[2]).getByLabelText("Not allowed")).toBeInTheDocument();
  });
});
