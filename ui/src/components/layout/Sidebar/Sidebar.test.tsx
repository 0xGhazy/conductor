import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSidebarStore } from "@/store/useSidebarStore";

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
});
