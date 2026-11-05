import React, { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Workflow,
  Layers,
  Activity,
  Database,
  Zap,
  Code,
  Folder,
  FileCode,
  Radio,
  KeyRound,
  Globe,
  FlaskConical,
  Languages,
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
      { label: "Designer", path: "/designer", icon: Workflow },
      { label: "Workflows", path: "/workflows", icon: Layers },
      { label: "Executions", path: "/executions", icon: Activity },
    ],
  },
  {
    label: "Definitions",
    items: [
      { label: "Databases", path: "/databases", icon: Database },
      { label: "Queries", path: "/queries", icon: Code },
      { label: "Redis Cache", path: "/redis", icon: Zap },
      { label: "Collections", path: "/collections", icon: Folder },
      { label: "Scripts", path: "/scripts", icon: FileCode },
      { label: "Connections", path: "/connections", icon: Radio },
      { label: "Secrets", path: "/secrets", icon: KeyRound },
      { label: "Translations", path: "/translations", icon: Globe },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Workbench", path: "/workbench", icon: FlaskConical },
      { label: "Languages", path: "/settings/languages", icon: Languages },
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
        ],
      },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);

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
        {NAVIGATION_GROUPS.map((group, groupIndex) => (
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
