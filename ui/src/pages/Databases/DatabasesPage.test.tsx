import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DatabasesPage from "./DatabasesPage";

vi.mock("@/features/databases", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useDatasourcesList: () => ({
      data: {
        items: [
          {
            id: "db-1",
            name: "conductor-db",
            type: "POSTGRES",
            status: { status: "ACTIVE" },
            createdBy: { id: "u-1", name: "Conductor Admin" },
            updatedBy: { id: "u-1", name: "Conductor Admin" },
          },
        ],
        total: 1,
      },
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      error: null,
    }),
  };
});

vi.mock("@/components/common/notifications", () => ({
  useWeaverNotification: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DatabasesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("DatabasesPage", () => {
  it("has no summary cards", () => {
    renderPage();
    expect(screen.queryByRole("region", { name: "Database Fleet Metrics" })).toBeNull();
    expect(screen.queryByText("Active Databases")).toBeNull();
  });

  it("shows a + New Database button instead of a table options menu", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /New Database/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Global explorer actions")).toBeNull();
  });

  it("offers Created By and Updated By columns", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Manage field visibility" }));
    expect(screen.getByText("Created By")).toBeInTheDocument();
    expect(screen.getByText("Updated By")).toBeInTheDocument();
  });

  it("sets the page title", () => {
    renderPage();
    expect(document.title).toBe("Databases");
  });
});
