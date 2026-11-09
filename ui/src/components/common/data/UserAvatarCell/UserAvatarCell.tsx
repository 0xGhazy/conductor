import React, { useContext, useMemo } from "react";
import { AuthContext } from "@/features/auth/context/AuthContext";
import type { UserProfile } from "@/features/auth/types/authTypes";
import styles from "./UserAvatarCell.module.css";

export const AVATAR_PALETTE = [
  "#D9102B", // Weaver Primary Crimson
  "#0284C7", // Sky Blue
  "#0D9488", // Teal
  "#7C3AED", // Violet
  "#D97706", // Amber
  "#059669", // Emerald
  "#EA580C", // Tangerine
  "#4F46E5", // Indigo
];

export function getDeterministicAvatarColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

export interface ResolvedUserDisplay {
  name: string;
  initials: string;
  avatarColor: string;
  tooltip?: string;
}

export function resolveUserDisplay(
  rawInput: unknown,
  currentUser?: UserProfile | null
): ResolvedUserDisplay | null {
  if (!rawInput) return null;

  let raw = "";
  if (typeof rawInput === "string") {
    raw = rawInput.trim();
  } else if (typeof rawInput === "object" && rawInput !== null) {
    const obj = rawInput as Record<string, any>;
    raw = String(obj.fullName || obj.name || obj.username || obj.email || obj.id || "").trim();
  } else {
    raw = String(rawInput).trim();
  }

  if (!raw || raw === "-" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") {
    return null;
  }

  const rawLower = raw.toLowerCase();

  // Match against current logged-in user profile
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
    // Development environment fallback: admin user created workflows / records
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

  // Parse email or custom string
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

export interface UserAvatarCellProps {
  value: unknown;
  currentUser?: UserProfile | null;
  fallback?: string;
  className?: string;
}

export const UserAvatarCell: React.FC<UserAvatarCellProps> = ({
  value,
  currentUser: explicitCurrentUser,
  fallback = "—",
  className = "",
}) => {
  const authContext = useContext(AuthContext);
  const currentUser = explicitCurrentUser !== undefined ? explicitCurrentUser : (authContext?.user || null);

  const userDisplay = useMemo(
    () => resolveUserDisplay(value, currentUser),
    [value, currentUser]
  );

  if (!userDisplay) {
    return <span className={`${styles.emptyUserCell} ${className}`}>{fallback}</span>;
  }

  return (
    <div
      className={`${styles.userAvatarCell} ${className}`}
      title={userDisplay.tooltip || userDisplay.name}
    >
      <span
        className={styles.userAvatar}
        style={{ backgroundColor: userDisplay.avatarColor }}
        aria-hidden="true"
      >
        {userDisplay.initials}
      </span>
      <span className={styles.userDisplayName}>{userDisplay.name}</span>
    </div>
  );
};

export default UserAvatarCell;

