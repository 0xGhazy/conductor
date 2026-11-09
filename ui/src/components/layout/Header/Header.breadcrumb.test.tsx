import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";

const mockToggleMode = vi.fn();

vi.mock("@/features/home", () => ({
  useBackendHealthChecks: () => ({ weaver: { data: { healthy: true } }, conductor: { data: { healthy: true } } }),
}));
vi.mock("@/features/auth", () => ({ UserMenu: () => <div data-testid="user-menu" /> }));
vi.mock("@/context/ThemeModeContext", () => ({
  useThemeMode: () => ({ mode: "light", toggleMode: mockToggleMode }),
}));

const renderHeader = (props = {}) =>
  render(
    <MemoryRouter>
      <Header {...props} />
    </MemoryRouter>
  );

describe("Header", () => {
  it("does not render breadcrumb navigation in the header", () => {
    renderHeader();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  it("renders the centered search input and triggers onSearchChange", () => {
    const onSearchChange = vi.fn();
    renderHeader({ search: "workflow", onSearchChange });

    const searchInput = screen.getByRole("searchbox", { name: "Quick search" });
    expect(searchInput).toHaveValue("workflow");

    fireEvent.change(searchInput, { target: { value: "database" } });
    expect(onSearchChange).toHaveBeenCalledWith("database");
  });

  it("focuses search input when Ctrl+K is pressed", () => {
    renderHeader();
    const searchInput = screen.getByRole("searchbox", { name: "Quick search" });
    expect(document.activeElement).not.toBe(searchInput);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(searchInput);
  });

  it("renders cluster health status indicator", () => {
    renderHeader();
    expect(screen.getByText("Cluster UP")).toBeInTheDocument();
  });

  it("calls toggleMode when the theme toggle button is clicked", () => {
    renderHeader();
    const themeBtn = screen.getByRole("button", { name: "Switch to dark mode" });
    fireEvent.click(themeBtn);
    expect(mockToggleMode).toHaveBeenCalledTimes(1);
  });

  it("renders mobile navigation button and toggles sidebar state", async () => {
    const { useSidebarStore } = await import("@/store/useSidebarStore");
    useSidebarStore.setState({ collapsed: false });

    renderHeader();
    const menuBtn = screen.getByRole("button", { name: "Collapse navigation" });
    expect(menuBtn).toBeInTheDocument();

    fireEvent.click(menuBtn);
    expect(useSidebarStore.getState().collapsed).toBe(true);
  });
});
