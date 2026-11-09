import { useContext, useEffect, useId, useMemo, useState } from "react";
import { AuthContext, hasAuditAccess, hasDatabaseAccess } from "@/features/auth";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Settings } from "lucide-react";
import {
  SETTINGS_NAVIGATION,
  findSettingsTrail,
  type SettingsNavItem,
} from "../../navigation/settingsNavigation";
import styles from "./SettingsSidebar.module.css";

interface SettingsSidebarProps {
  items?: SettingsNavItem[];
}

/**
 * Secondary navigation for the Settings area. Groups (such as Identity) expand and collapse,
 * and open by themselves when one of their pages is active. On narrow screens the list folds
 * behind a toggle that shows the current page.
 */
export function SettingsSidebar({ items = SETTINGS_NAVIGATION }: SettingsSidebarProps) {
  const { pathname } = useLocation();
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.user;

  const visibleItems = useMemo(() => {
    if (authContext === undefined) {
      return items;
    }

    return items.filter((item) => {
      // Do not show Audit Logs if user lacks audit related resource_access
      if (item.id === "audit-logs" || item.path?.includes("audit-logs")) {
        return hasAuditAccess(currentUser);
      }
      if (item.id === "databases" || item.path?.includes("databases")) {
        return hasDatabaseAccess(currentUser);
      }
      return true;
    });
  }, [items, authContext, currentUser]);

  const trail = findSettingsTrail(pathname, visibleItems);
  const activeIds = new Set(trail.map((item) => item.id));
  const current = trail[trail.length - 1];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(trail.filter((item) => item.children).map((item) => [item.id, true]))
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const listId = useId();

  // Opening a page inside a group opens that group; navigating closes the mobile menu.
  useEffect(() => {
    const activeGroups = findSettingsTrail(pathname, visibleItems).filter((item) => item.children);
    if (activeGroups.length) {
      setOpenGroups((prev) => {
        const next = { ...prev };
        activeGroups.forEach((group) => {
          next[group.id] = true;
        });
        return next;
      });
    }
    setMobileOpen(false);
  }, [pathname, items]);

  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderItems = (list: SettingsNavItem[], depth: number) =>
    list.map((item) => {
      const Icon = item.icon;
      const isActive = activeIds.has(item.id);

      if (item.children?.length) {
        const isOpen = Boolean(openGroups[item.id]);
        const childrenId = `${listId}-${item.id}`;
        return (
          <li key={item.id}>
            <button
              type="button"
              className={`${styles.item} ${styles.group} ${isActive ? styles.groupActive : ""}`}
              aria-expanded={isOpen}
              aria-controls={childrenId}
              onClick={() => toggleGroup(item.id)}
            >
              <Icon size={16} aria-hidden className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
              <ChevronDown
                size={15}
                aria-hidden
                className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
              />
            </button>
            <div className={`${styles.collapse} ${isOpen ? styles.collapseOpen : ""}`}>
              <ul id={childrenId} className={styles.childList}>
                {renderItems(item.children, depth + 1)}
              </ul>
            </div>
          </li>
        );
      }

      return (
        <li key={item.id}>
          <Link
            to={item.path ?? "#"}
            className={`${styles.item} ${depth > 0 ? styles.child : ""} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={depth > 0 ? 15 : 16} aria-hidden className={styles.icon} />
            <span className={styles.label}>{item.label}</span>
          </Link>
        </li>
      );
    });

  return (
    <aside className={styles.sidebar} aria-label="Settings">
      <div className={styles.heading}>
        <span className={styles.headingIcon} aria-hidden="true">
          <Settings size={16} />
        </span>
        <span className={styles.headingText}>Settings</span>
      </div>

      {/* Narrow screens: the menu hides behind the current page. */}
      <button
        type="button"
        className={styles.mobileToggle}
        aria-expanded={mobileOpen}
        aria-controls={listId}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className={styles.label}>{current?.label ?? "Settings"}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`${styles.chevron} ${mobileOpen ? styles.chevronOpen : ""}`}
        />
      </button>

      <nav aria-label="Settings sections">
        <ul id={listId} className={`${styles.list} ${mobileOpen ? styles.listMobileOpen : ""}`}>
          {renderItems(visibleItems, 0)}
        </ul>
      </nav>
    </aside>
  );
}

export default SettingsSidebar;
