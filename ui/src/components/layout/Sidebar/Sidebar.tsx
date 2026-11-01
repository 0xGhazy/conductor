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
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSidebarStore } from "@/store/useSidebarStore";
import { prefetchRoute } from "@/routes/routeModules";
import styles from "./Sidebar.module.css";

interface NavItemDef {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
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
      { label: "Redis Cache", path: "/redis", icon: Zap },
      { label: "Queries", path: "/queries", icon: Code },
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
      { label: "Migration", path: "/settings/migration", icon: ArrowRightLeft },
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
      <div className={styles.brandHeader}>
        <Link to="/" className={styles.brandLink} title="Weaver Home">
          <img src="/logo.png" alt="Weaver" className={styles.brandLogo} />
          {!collapsed && (
            <div className={styles.brandInfo}>
              <span className={styles.brandName}>Weaver</span>
              <span className={styles.versionBadge}>v2.0</span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className={styles.collapseBtn}
          title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Groups (Flat clean list) */}
      <nav className={styles.navContainer}>
        {NAVIGATION_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className={styles.navGroup}>
            {collapsed ? (
              groupIndex > 0 && <div className={styles.groupDivider} />
            ) : (
              <h3 className={styles.groupLabel}>{group.label}</h3>
            )}

            {group.items.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              const itemClass = active
                ? `${styles.navItem} ${styles.navItemActive}`
                : styles.navItem;

              const navLink = (
                <Link
                  key={item.path}
                  to={item.path}
                  className={itemClass}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={() => prefetchRoute(item.path)}
                  onFocus={() => prefetchRoute(item.path)}
                >
                  {active && <span className={styles.activeIndicator} aria-hidden="true" />}
                  <span className={styles.navIcon} aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <div key={item.path} className={styles.tooltipWrapper}>
                    {navLink}
                    <div className={styles.tooltipBubble} role="tooltip">
                      {item.label}
                    </div>
                  </div>
                );
              }

              return navLink;
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
