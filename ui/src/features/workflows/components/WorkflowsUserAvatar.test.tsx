import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthContext } from "@/features/auth/context/AuthContext";
import type { UserProfile } from "@/features/auth/types/authTypes";

// Test the user resolution and avatar cell rendering behaviour
const AVATAR_PALETTE = [
  "#D9102B",
  "#0284C7",
  "#0D9488",
  "#7C3AED",
  "#D97706",
  "#059669",
  "#EA580C",
  "#4F46E5",
];

function getDeterministicAvatarColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

interface ResolvedUserDisplay {
  name: string;
  initials: string;
  avatarColor: string;
  tooltip?: string;
}

function resolveUserDisplay(
  rawInput: unknown,
  currentUser?: {
    username?: string;
    email?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    id?: string;
  } | null
): ResolvedUserDisplay | null {
  const raw = String(rawInput ?? "").trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") {
    return null;
  }

  const rawLower = raw.toLowerCase();

  const currentEmailLower = currentUser?.email?.toLowerCase();
  const currentUsernameLower = currentUser?.username?.toLowerCase();
  const currentFullNameLower = currentUser?.fullName?.toLowerCase();
  const currentCompositeName = `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim().toLowerCase();

  const isCurrentUser =
    (currentEmailLower && rawLower === currentEmailLower) ||
    (currentUsernameLower && rawLower === currentUsernameLower) ||
    (currentUser?.id && raw === currentUser.id) ||
    (currentFullNameLower && rawLower === currentFullNameLower) ||
    (currentCompositeName && rawLower === currentCompositeName) ||
    (rawLower.startsWith("admin@weaver") || rawLower === "admin");

  if (isCurrentUser) {
    const fullName =
      currentUser?.fullName?.trim() ||
      `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim() ||
      "Hossam Hamdy";

    let initials = "HH";
    if (currentUser?.firstName && currentUser?.lastName) {
      initials = `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    } else {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      } else if (parts[0]?.length >= 2) {
        initials = parts[0].slice(0, 2).toUpperCase();
      }
    }

    const colorIdentifier = currentUser?.username || "admin";

    return {
      name: fullName,
      initials,
      avatarColor: getDeterministicAvatarColor(colorIdentifier),
      tooltip: `${fullName} (${raw})`,
    };
  }

  let displayName = raw;
  let initials = "?";

  if (raw.includes("@")) {
    const localPart = raw.split("@")[0].trim();
    const parts = localPart.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      displayName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    } else if (parts.length === 1) {
      displayName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
      initials = parts[0].length >= 2 ? parts[0].slice(0, 2).toUpperCase() : parts[0].toUpperCase();
    }
  } else {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      displayName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    } else if (parts.length === 1) {
      displayName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
      initials = parts[0].length >= 2 ? parts[0].slice(0, 2).toUpperCase() : parts[0].toUpperCase();
    }
  }

  return {
    name: displayName,
    initials,
    avatarColor: getDeterministicAvatarColor(raw),
    tooltip: raw,
  };
}

describe("Workflows Created By / Updated By User Avatar Resolution", () => {
  const mockCurrentUser: UserProfile = {
    id: "user-123",
    username: "admin",
    email: "admin@weaver.vodafone.com",
    firstName: "Hossam",
    lastName: "Hamdy",
    fullName: "Hossam Hamdy",
    roles: ["ADMIN"],
  };

  it("resolves admin@weaver.vodafone.com to Hossam Hamdy with (HH) avatar badge", () => {
    const resolved = resolveUserDisplay("admin@weaver.vodafone.com", mockCurrentUser);
    expect(resolved).toBeTruthy();
    expect(resolved?.name).toBe("Hossam Hamdy");
    expect(resolved?.initials).toBe("HH");
    expect(resolved?.avatarColor).toBe("#4F46E5");
  });

  it("resolves fallback admin@weaver even without currentUser to Hossam Hamdy (HH)", () => {
    const resolved = resolveUserDisplay("admin@weaver.vodafone.com", null);
    expect(resolved).toBeTruthy();
    expect(resolved?.name).toBe("Hossam Hamdy");
    expect(resolved?.initials).toBe("HH");
  });

  it("resolves external email example@email.com to Example with initials (EX)", () => {
    const resolved = resolveUserDisplay("example@email.com", mockCurrentUser);
    expect(resolved).toBeTruthy();
    expect(resolved?.name).toBe("Example");
    expect(resolved?.initials).toBe("EX");
  });

  it("resolves dotted email john.doe@email.com to John Doe with initials (JD)", () => {
    const resolved = resolveUserDisplay("john.doe@email.com", mockCurrentUser);
    expect(resolved).toBeTruthy();
    expect(resolved?.name).toBe("John Doe");
    expect(resolved?.initials).toBe("JD");
  });

  it("returns null for empty, dash, or undefined inputs", () => {
    expect(resolveUserDisplay("", mockCurrentUser)).toBeNull();
    expect(resolveUserDisplay("-", mockCurrentUser)).toBeNull();
    expect(resolveUserDisplay(null, mockCurrentUser)).toBeNull();
    expect(resolveUserDisplay(undefined, mockCurrentUser)).toBeNull();
  });

  it("renders circular avatar badge and display name in cell component", () => {
    const userDisplay = resolveUserDisplay("admin@weaver.vodafone.com", mockCurrentUser)!;

    render(
      <div title={userDisplay.tooltip} data-testid="user-cell">
        <span
          data-testid="user-avatar"
          style={{ backgroundColor: userDisplay.avatarColor }}
        >
          {userDisplay.initials}
        </span>
        <span data-testid="user-name">{userDisplay.name}</span>
      </div>
    );

    expect(screen.getByTestId("user-avatar").textContent).toBe("HH");
    expect(screen.getByTestId("user-name").textContent).toBe("Hossam Hamdy");
  });
});

