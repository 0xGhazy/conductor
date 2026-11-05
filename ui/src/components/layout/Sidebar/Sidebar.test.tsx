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

  it.each(["/settings/migrations", "/settings/configurations", "/settings/identity/users"])(
    "highlights Settings on %s",
    (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <Sidebar />
        </MemoryRouter>
      );
      expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "Languages" })).not.toHaveAttribute("aria-current");
    }
  );

  it("highlights only Languages on the languages page", () => {
    render(
      <MemoryRouter initialEntries={["/settings/languages"]}>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Languages" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
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
});
