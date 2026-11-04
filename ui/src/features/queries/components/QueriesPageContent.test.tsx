import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import QueriesPageContent from "./QueriesPageContent";
import QueriesPage from "@/pages/Queries/QueriesPage";

const LocationProbe = () => <div data-testid="location">{useLocation().pathname}</div>;

vi.mock("@/features/queries/hooks/useQueryDefinitions", () => ({
  useQueryDefinitionsList: () => ({
    isFetching: false,
    error: null,
    data: {
      data: {
        data: [
          {
            id: "q-1",
            name: "workflow-status-latest",
            datasource: { id: "db-1", name: "conductor-db", type: "POSTGRES" },
            timeout: 5000,
          },
        ],
        details: { totalElements: 1 },
      },
    },
  }),
}));

const renderPage = (onCreateQuery = vi.fn()) => {
  render(
    <MemoryRouter>
      <QueriesPageContent onCreateQuery={onCreateQuery} />
      <LocationProbe />
    </MemoryRouter>
  );
  return onCreateQuery;
};

describe("QueriesPageContent", () => {
  it("shows a + New Query button that opens the create view", () => {
    const onCreateQuery = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /New Query/ }));
    expect(onCreateQuery).toHaveBeenCalled();
  });

  it("has no selection checkboxes and no actions menus", () => {
    renderPage();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByLabelText("Global explorer actions")).toBeNull();
    // Row menus are labelled "Actions for record <id>"; the column header is "Actions".
    expect(screen.queryByLabelText(/^Actions for record/)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull();
  });

  it("shows the database as text that opens the database page", () => {
    renderPage();
    const database = screen.getByRole("button", { name: "conductor-db" });
    expect(database.closest("[class*='tag' i]")).toBeNull();

    fireEvent.click(database);
    expect(screen.getByTestId("location")).toHaveTextContent("/databases/db-1");
  });

  it("offers Created By and Updated By columns", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Manage field visibility" }));
    expect(screen.getByText("Created By")).toBeInTheDocument();
    expect(screen.getByText("Updated By")).toBeInTheDocument();
  });

  it("sets the page title", () => {
    render(
      <MemoryRouter>
        <QueriesPage />
      </MemoryRouter>
    );
    expect(document.title).toBe("Weaver - Queries");
  });
});
