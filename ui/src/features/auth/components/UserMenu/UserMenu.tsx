import { useState, useRef, useEffect, useMemo } from "react";
import { FiLogOut, FiChevronDown } from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";
import styles from "./UserMenu.module.css";

const AVATAR_COLORS = [
  "#E5484D", // Coral Primary
  "#FF8A3D", // Orange Accent
  "#2C8C84", // Teal Support
  "#B66A00", // Warm Amber
  "#FF7043", // Coral Sunset
  "#35424D", // Graphite
  "#FF9B45", // Tangerine
  "#5BC8BC", // Mint Teal
  "#C93136", // Crimson
  "#667085", // Slate
];

const getRandomColor = (): string => {
  const index = Math.floor(Math.random() * AVATAR_COLORS.length);
  return AVATAR_COLORS[index];
};

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
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Random color for the circle avatar that changes on every new login session
  const [avatarBg, setAvatarBg] = useState<string>(() => {
    return sessionStorage.getItem("user_avatar_color") || getRandomColor();
  });

  useEffect(() => {
    if (isAuthenticated) {
      let saved = sessionStorage.getItem("user_avatar_color");
      if (!saved) {
        saved = getRandomColor();
        sessionStorage.setItem("user_avatar_color", saved);
      }
      setAvatarBg(saved);
    } else {
      sessionStorage.removeItem("user_avatar_color");
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = useMemo(() => {
    if (!user) return "U";
    return getInitials(user);
  }, [user]);

  const displayRoles = useMemo(() => {
    if (!user?.roles) return [];
    const EXCLUDED_ROLES = new Set([
      "offline_access",
      "dashboard.read",
      "uma_authorization",
    ]);

    return user.roles
      .filter((role) => {
        const normalized = role.trim().toLowerCase();
        if (normalized.startsWith("default-roles")) return false;
        return !EXCLUDED_ROLES.has(normalized);
      })
      .slice(0, 4);
  }, [user?.roles]);

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

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsOpen(false);
    sessionStorage.removeItem("user_avatar_color");
    await logout();
  };

  return (
    <div className={styles.userMenuContainer} ref={menuRef}>
      <button
        type="button"
        className={`${styles.triggerButton} ${isOpen ? styles.triggerButtonOpen : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={user.fullName || user.username}
        aria-label="User menu"
      >
        <span className={styles.avatar} style={{ background: avatarBg }}>
          {initials}
        </span>
        <FiChevronDown size={14} className={styles.chevron} />
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu} role="menu">
          <div className={styles.userInfoSection}>
            <div className={styles.dropdownAvatarRow}>
              <span className={styles.dropdownAvatar} style={{ background: avatarBg }}>
                {initials}
              </span>
              <div className={styles.dropdownUserDetails}>
                <div className={styles.profileName}>{user.fullName || user.username}</div>
                {user.email && <div className={styles.profileEmail}>{user.email}</div>}
              </div>
            </div>

            {displayRoles.length > 0 && (
              <div className={styles.rolesContainer}>
                {displayRoles.map((role) => (
                  <span key={role} className={styles.roleChip}>
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <FiLogOut size={16} />
            <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
