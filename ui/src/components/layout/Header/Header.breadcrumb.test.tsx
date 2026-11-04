import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";

vi.mock("@/features/home", () => ({
  useBackendHealthChecks: () => ({ weaver: { data: null }, conductor: { data: null } }),
}));
vi.mock("@/features/auth", () => ({ UserMenu: () => null }));
vi.mock("@/context/ThemeModeContext", () => ({
  useThemeMode: () => ({ mode: "light", toggleMode: vi.fn() }),
}));

const QUERY_ID = "6f1c2a7e-0d2b-4b8e-9c1a-0000000000a1";

const renderAt = (entry: string | { pathname: string; state?: unknown }) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Header />
    </MemoryRouter>
  );

const breadcrumb = () => screen.getByRole("navigation", { name: "Breadcrumb" });

describe("Header breadcrumb for a query", () => {
  it("never shows the query id", () => {
    renderAt(`/queries/${QUERY_ID}`);
    expect(breadcrumb()).not.toHaveTextContent(QUERY_ID);
  });

  it("uses the name passed when navigating", () => {
    renderAt({ pathname: `/queries/${QUERY_ID}`, state: { name: "workflow-status-latest" } });
    expect(breadcrumb()).toHaveTextContent("workflow-status-latest");
  });

  it("shows the name the query page announces once loaded", () => {
    renderAt(`/queries/${QUERY_ID}`);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("weaver:breadcrumb-title", {
          detail: { title: "workflow-status-summary", pathname: `/queries/${QUERY_ID}` },
        })
      );
    });
    expect(breadcrumb()).toHaveTextContent("workflow-status-summary");
  });

  it("labels the create page", () => {
    renderAt("/queries/new");
    expect(breadcrumb()).toHaveTextContent("New Query");
  });
});
