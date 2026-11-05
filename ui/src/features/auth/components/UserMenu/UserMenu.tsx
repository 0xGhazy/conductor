import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  KeyRound,
  Check,
  Settings,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../services/keycloakService";
import styles from "./UserMenu.module.css";

const AVATAR_PALETTE = [
  "#D9102B", // Weaver Primary Crimson
  "#0284C7", // Sky Blue
  "#0D9488", // Teal
  "#7C3AED", // Violet
  "#D97706", // Amber
  "#059669", // Emerald
  "#EA580C", // Tangerine
  "#4F46E5", // Indigo
];

function getDeterministicAvatarColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

/**
 * Extracts a 2-character uppercase initials representation from the user's name.
 * e.g. "Hossam Hamdy" -> "HH"
 */
function getInitials(user: {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  username?: string;
}): string {
  const first = (user.firstName || "").trim();
  const last = (user.lastName || "").trim();
  if (first && last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }

  const nameToUse = (user.fullName || user.username || "").trim();
  if (!nameToUse) return "U";

  const parts = nameToUse.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  if (parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts[0].toUpperCase();
}

export default function UserMenu() {
  const { isAuthenticated, isLoading, user, token, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const identifier = user?.username || user?.email || user?.fullName || "default";
  const avatarBg = useMemo(() => getDeterministicAvatarColor(identifier), [identifier]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: Escape to close menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const initials = useMemo(() => {
    if (!user) return "U";
    return getInitials(user);
  }, [user]);

  const firstName = useMemo(() => {
    if (!user) return "";
    if (user.firstName?.trim()) return user.firstName.trim();
    if (user.fullName?.trim()) {
      const parts = user.fullName.trim().split(/\s+/);
      if (parts[0]) return parts[0];
    }
    return user.username || "";
  }, [user]);

  const handleCopyToken = useCallback(async () => {
    const rawToken = token || getAccessToken() || "";
    if (!rawToken) return;
    try {
      await navigator.clipboard.writeText(rawToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (err) {
      console.warn("Failed to copy access token", err);
    }
  }, [token]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsOpen(false);
    await logout();
  };

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        className={styles.loginButton}
        onClick={() => {
          sessionStorage.removeItem("weaver_logged_out");
          login();
        }}
      >
        Sign In
      </button>
    );
  }

  return (
    <div className={styles.userMenuContainer} ref={menuRef}>
      <button
        type="button"
        className={`${styles.triggerButton} ${isOpen ? styles.triggerButtonOpen : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={user.fullName || user.username}
        aria-label="User account menu"
      >
        <span
          className={styles.avatar}
          style={{ backgroundColor: avatarBg }}
          aria-hidden="true"
        >
          {initials}
        </span>
        {firstName && <span className={styles.triggerName}>{firstName}</span>}
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className={styles.dropdownCard}
          role="menu"
          aria-label="User profile card"
        >
          {/* Identity Header */}
          <div className={styles.identitySection}>
            <span
              className={styles.dropdownAvatar}
              style={{ backgroundColor: avatarBg }}
              aria-hidden="true"
            >
              {initials}
            </span>
            <div className={styles.identityDetails}>
              <div
                className={styles.profileName}
                title={user.fullName || user.username}
              >
                {user.fullName || user.username}
              </div>
              {user.email && (
                <div className={styles.profileEmail} title={user.email}>
                  {user.email}
                </div>
              )}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Quick Actions */}
          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.actionItem}
              onClick={handleCopyToken}
              title="Copy Keycloak JWT access token to clipboard"
              role="menuitem"
            >
              {copiedToken ? (
                <Check size={15} className={styles.copiedIcon} aria-hidden="true" />
              ) : (
                <KeyRound size={15} className={styles.actionIcon} aria-hidden="true" />
              )}
              <span className={copiedToken ? styles.copiedText : undefined}>
                {copiedToken ? "Token Copied!" : "Copy Access Token"}
              </span>
            </button>

            <Link
              to="/settings"
              className={styles.actionItem}
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              <Settings size={15} className={styles.actionIcon} aria-hidden="true" />
              <span>Account & Settings</span>
            </Link>
          </div>

          <div className={styles.divider} />

          {/* Destructive / Sign Out Action */}
          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.logoutButton}
              onClick={handleLogout}
              disabled={isLoggingOut}
              role="menuitem"
            >
              <LogOut size={15} className={styles.logoutIcon} aria-hidden="true" />
              <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
