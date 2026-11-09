import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";

const renderNotFound = (props = {}) =>
  render(
    <MemoryRouter>
      <NotFoundPage {...props} />
    </MemoryRouter>
  );

describe("NotFoundPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets document title to 404 - Not Found", () => {
    renderNotFound();
    expect(document.title).toBe("404 - Not Found");
  });

  it("renders heading and dashboard navigation", () => {
    renderNotFound();
    expect(screen.getByRole("heading", { name: /Page or resource not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Dashboard/i })).toHaveAttribute("href", "/");
  });

  it("does not render removed badge, popular destinations, or diagnostics", () => {
    renderNotFound();
    expect(screen.queryByText(/Error 404 • Resource Not Found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Popular Destinations/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Go Back/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Technical details & route diagnostics/i)).not.toBeInTheDocument();
  });
});
