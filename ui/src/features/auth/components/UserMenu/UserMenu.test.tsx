import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserMenu from "./UserMenu";
import * as useAuthModule from "../../hooks/useAuth";

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockWriteText = vi.fn().mockResolvedValue(undefined);

const defaultUser = {
  id: "user-123",
  username: "hossam.hamdy",
  firstName: "Hossam",
  lastName: "Hamdy",
  fullName: "Hossam Hamdy",
  email: "hossam@example.com",
  roles: ["conductor_admin", "offline_access", "developer"],
};

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  const renderUserMenu = (authOverrides = {}) => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: defaultUser,
      token: "mock-jwt-token-xyz",
      login: mockLogin,
      logout: mockLogout,
      hasRole: vi.fn(),
      ...authOverrides,
    });

    return render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );
  };

  it("renders trigger button with user initials and first name in the header", () => {
    renderUserMenu();
    const button = screen.getByRole("button", { name: "User account menu" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("HH");
    expect(button).toHaveTextContent("Hossam");
  });

  it("opens profile card on click and displays user identity without roles", () => {
    renderUserMenu();
    const button = screen.getByRole("button", { name: "User account menu" });
    expect(screen.queryByRole("menu", { name: "User profile card" })).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByRole("menu", { name: "User profile card" })).toBeInTheDocument();
    expect(screen.getByText("Hossam Hamdy")).toBeInTheDocument();
    expect(screen.getByText("hossam@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Assigned Roles")).not.toBeInTheDocument();
    expect(screen.queryByText("conductor_admin")).not.toBeInTheDocument();
  });

  it("copies access token to clipboard and displays transient feedback", async () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "User account menu" }));

    const copyBtn = screen.getByRole("menuitem", { name: /Copy Access Token/i });
    fireEvent.click(copyBtn);

    expect(mockWriteText).toHaveBeenCalledWith("mock-jwt-token-xyz");
    await waitFor(() => {
      expect(screen.getByText("Token Copied!")).toBeInTheDocument();
    });
  });

  it("navigates to settings and closes the menu", () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "User account menu" }));

    const settingsLink = screen.getByRole("menuitem", { name: /Account & Settings/i });
    expect(settingsLink).toHaveAttribute("href", "/settings");

    fireEvent.click(settingsLink);
    expect(screen.queryByRole("menu", { name: "User profile card" })).not.toBeInTheDocument();
  });

  it("calls logout when clicking Sign Out", () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "User account menu" }));

    const logoutBtn = screen.getByRole("menuitem", { name: /Sign Out/i });
    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key press", () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "User account menu" }));
    expect(screen.getByRole("menu", { name: "User profile card" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "User profile card" })).not.toBeInTheDocument();
  });

  it("renders Sign In button when not authenticated", () => {
    renderUserMenu({ isAuthenticated: false, user: null });
    const signInBtn = screen.getByRole("button", { name: "Sign In" });
    expect(signInBtn).toBeInTheDocument();

    fireEvent.click(signInBtn);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});
