import React, { useContext, useEffect, useMemo } from "react";
import { AuthContext, hasAdminRole, hasDatabaseAccess } from "@/features/auth";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Layers,
  Activity,
  Database,
  Zap,
  Code,
  Folder,
  FileCode,
  Radio,
  KeyRound,
  FlaskConical,
  Settings as SettingsIcon,
} from "lucide-react";
import { useSidebarStore } from "@/store/useSidebarStore";
import { prefetchRoute } from "@/routes/routeModules";
import styles from "./Sidebar.module.css";

interface NavItemDef {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
  /** Paths that also mark this item active (when they are not under `path`). */
  activePaths?: string[];
}

interface NavGroupDef {
  label: string;
  items: NavItemDef[];
}

const NAVIGATION_GROUPS: NavGroupDef[] = [
  {
    label: "Orchestration",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard, exact: true },
      { label: "Workflows", path: "/workflows", icon: Layers },
      { label: "Executions", path: "/executions", icon: Activity },
      { label: "Workbench", path: "/workbench", icon: FlaskConical },
    ],
  },
  {
    label: "Definitions",
    items: [
      { label: "Databases", path: "/databases", icon: Database },
      { label: "Queries", path: "/queries", icon: Code },
      { label: "Caching", path: "/caching", icon: Zap },
      { label: "Collections", path: "/collections", icon: Folder },
      { label: "Scripts", path: "/scripts", icon: FileCode },
      { label: "Authentications", path: "/authentications", icon: Radio },
      { label: "Secrets", path: "/secrets", icon: KeyRound },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        label: "Settings",
        path: "/settings",
        icon: SettingsIcon,
        exact: true,
        activePaths: [
          "/settings/migrations",
          "/settings/configurations",
          "/settings/audit-logs",
          "/settings/identity",
          "/settings/languages",
        ],
      },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.user;
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);
  const setCollapsed = useSidebarStore((state) => state.setCollapsed);

  // Filter navigation groups based on realm roles and resource access
  const visibleGroups = useMemo(() => {
    // If rendered outside AuthProvider (e.g. unit tests without auth wrapper), default to all
    if (authContext === undefined) {
      return NAVIGATION_GROUPS;
    }

    return NAVIGATION_GROUPS.map((group) => {
      const filteredItems = group.items.filter((item) => {
        // Hide Settings tab in sidebar if user doesn't have "conductor_admin" realm role
        if (item.path === "/settings" || item.path.startsWith("/settings")) {
          return hasAdminRole(currentUser);
        }
        // Hide Databases tab in sidebar if user doesn't have database related resource_access
        if (item.path === "/databases" || item.path.startsWith("/databases")) {
          return hasDatabaseAccess(currentUser);
        }
        return true;
      });
      return {
        ...group,
        items: filteredItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [authContext, currentUser]);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const isItemActive = useMemo(() => {
    return (item: NavItemDef) => {
      const current = location.pathname;
      if (item.activePaths?.some((p) => current === p || current.startsWith(p + "/"))) {
        return true;
      }
      if (item.exact) {
        return current === item.path;
      }
      return current === item.path || current.startsWith(item.path + "/");
    };
  }, [location.pathname]);

  const sidebarClass = collapsed
    ? `${styles.sidebar} ${styles.collapsed}`
    : `${styles.sidebar} ${styles.expanded}`;

  return (
    <aside className={sidebarClass} aria-label="Application sidebar">
      {/* Brand Header */}
      {/* Clicking the logo opens / closes the sidebar (also Ctrl+B). */}
      <div className={styles.brandHeader}>
        <button
          type="button"
          onClick={toggleSidebar}
          className={styles.brandToggle}
          title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <img src="/logo.png" alt="" className={styles.brandLogo} />
          <div className={styles.brandInfo} aria-hidden={collapsed}>
            <span className={styles.brandName}>Weaver</span>
            <span className={styles.versionBadge}>v2.0</span>
          </div>
        </button>
      </div>

      {/* Navigation Groups (Flat clean list) */}
      <nav className={styles.navContainer}>
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.label} className={styles.navGroup}>
            {groupIndex > 0 && (
              <div className={styles.groupDivider} aria-hidden="true" />
            )}
            <h3 className={styles.groupLabel} aria-hidden={collapsed}>
              {group.label}
            </h3>

            {group.items.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              const itemClass = active
                ? `${styles.navItem} ${styles.navItemActive}`
                : styles.navItem;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={itemClass}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  onClick={() => {
                    if (item.path.startsWith("/settings")) {
                      setCollapsed(true);
                    }
                  }}
                  onMouseEnter={() => prefetchRoute(item.path)}
                  onFocus={() => prefetchRoute(item.path)}
                >
                  {active && <span className={styles.activeIndicator} aria-hidden="true" />}
                  <span className={styles.navIcon} aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <span className={styles.navLabel} aria-hidden="true">
                    {item.label}
                  </span>
                  <span className={styles.tooltipBubble} role="tooltip" aria-hidden="true">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
