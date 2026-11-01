export interface UserLike {
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  id?: string;
  avatarUrl?: string;
  picture?: string;
  imageUrl?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

/**
 * Resolves a human-readable display name for a user representation.
 * Supports strings, user objects with name/fullName/username/email/id, or fallback values.
 */
export const getUserName = (
  user: unknown,
  fallback = "Unknown user"
): string => {
  if (!user) return fallback;
  if (typeof user === "string") return user.trim() || fallback;
  if (typeof user === "object") {
    const u = user as UserLike;
    return (
      u.name ||
      u.fullName ||
      u.username ||
      u.email ||
      u.id ||
      fallback
    );
  }
  return String(user) || fallback;
};

/**
 * Extracts avatar/profile image URL from a user object if available.
 */
export const getAvatarUrl = (user: unknown): string | undefined => {
  if (!user || typeof user !== "object") return undefined;
  const u = user as UserLike;
  return u.avatarUrl || u.picture || u.imageUrl;
};

/**
 * Extracts 1-2 uppercase initials from a name string or user object for avatars.
 * e.g., "Hossam Hamdy" -> "HH", "Admin" -> "A", "db_admin" -> "D"
 */
export const getInitials = (input?: unknown): string => {
  if (!input) return "?";
  if (typeof input === "string") {
    const parts = input.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }
  if (typeof input === "object") {
    const u = input as UserLike;
    const first = (u.firstName || "").trim();
    const last = (u.lastName || "").trim();
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }
    const name = getUserName(input, "");
    if (!name) return "?";
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }
  return "?";
};
