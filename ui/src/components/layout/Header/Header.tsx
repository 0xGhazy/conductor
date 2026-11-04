import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, ChevronRight, Sun, Moon } from "lucide-react";
import { useBackendHealthChecks } from "@/features/home";
import { UserMenu } from "@/features/auth";
import { useThemeMode } from "@/context/ThemeModeContext";
import styles from "./Header.module.css";

interface HeaderProps {
  search?: string;
  onSearchChange?: (value: string) => void;
}

interface BreadcrumbSegment {
  label: string;
  path?: string;
}

export const Header: React.FC<HeaderProps> = ({ search = "", onSearchChange }) => {
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { mode, toggleMode: handleToggleTheme } = useThemeMode();
  const darkMode = mode === "dark";

  const { weaver: weaverHealth, conductor: conductorHealth } = useBackendHealthChecks();
  const isHealthy = Boolean(
    (weaverHealth.data?.healthy ?? true) && (conductorHealth.data?.healthy ?? true)
  );

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);

  // Clear dynamic title on route change
  useEffect(() => {
    setDynamicTitle(null);
  }, [location.pathname]);

  // Listen for custom breadcrumb title events (e.g. from DatabaseViewPage when record loads)
  useEffect(() => {
    const handleBreadcrumbTitle = (e: any) => {
      if (!e.detail?.pathname || e.detail.pathname === location.pathname) {
        if (e.detail?.title) {
          setDynamicTitle(e.detail.title);
        }
      }
    };
    window.addEventListener("weaver:breadcrumb-title", handleBreadcrumbTitle);
    return () => window.removeEventListener("weaver:breadcrumb-title", handleBreadcrumbTitle);
  }, [location.pathname]);

  // Compute dynamic breadcrumbs from location
  const breadcrumbs = useMemo<BreadcrumbSegment[]>(() => {
    const pathname = location.pathname || "/";
    const searchParams = new URLSearchParams(location.search || "");
    const queryName =
      searchParams.get("workflowName") ||
      searchParams.get("datasourceName") ||
      searchParams.get("name") ||
      "";

    if (pathname === "/" || pathname === "/home" || pathname === "/dashboard") {
      return [{ label: "Command Center" }];
    }

    if (pathname.startsWith("/designer")) {
      const id = pathname.replace("/designer/", "").replace("/designer", "");
      const resolved = queryName || (id && id !== "/" ? decodeURIComponent(id) : null);
      return resolved
        ? [{ label: "Designer", path: "/designer" }, { label: resolved }]
        : [{ label: "Designer" }];
    }

    if (pathname.startsWith("/workflows")) {
      const id = pathname.replace("/workflows/", "").replace("/workflows", "");
      return id && id !== "/"
        ? [{ label: "Workflows", path: "/workflows" }, { label: decodeURIComponent(id) }]
        : [{ label: "Workflows" }];
    }

    if (pathname.startsWith("/executions")) {
      const id = pathname.replace("/executions/", "").replace("/executions", "");
      return id && id !== "/"
        ? [{ label: "Executions", path: "/executions" }, { label: decodeURIComponent(id) }]
        : [{ label: "Executions" }];
    }

    if (pathname.startsWith("/databases")) {
      const id = pathname.replace("/databases/", "").replace("/databases", "");
      if (!id || id === "/") {
        return [{ label: "Databases" }];
      }
      if (id === "new") {
        return [{ label: "Databases", path: "/databases" }, { label: "New Database" }];
      }
      const navStateName =
        (location.state as any)?.name || (location.state as any)?.databaseName;
      const displayLabel = dynamicTitle || navStateName || queryName || decodeURIComponent(id);
      return [
        { label: "Databases", path: "/databases" },
        { label: displayLabel },
      ];
    }

    if (pathname.startsWith("/redis")) {
      return [{ label: "Redis Sources" }];
    }

    if (pathname.startsWith("/queries")) {
      const id = pathname.replace("/queries/", "").replace("/queries", "");
      if (!id || id === "/") {
        return [{ label: "Queries" }];
      }
      if (id === "new") {
        return [{ label: "Queries", path: "/queries" }, { label: "New Query" }];
      }
      // The query's name: announced by the query page once loaded, or passed when navigating.
      const navStateName = (location.state as { name?: string } | null)?.name;
      return [
        { label: "Queries", path: "/queries" },
        { label: dynamicTitle || navStateName || "Query" },
      ];
    }

    if (pathname.startsWith("/collections")) {
      const id = pathname.replace("/collections/", "").replace("/collections", "");
      if (!id || id === "/") {
        return [{ label: "Collections" }];
      }
      if (id === "new") {
        return [{ label: "Collections", path: "/collections" }, { label: "New Collection" }];
      }
      const navStateName =
        (location.state as any)?.name || (location.state as any)?.collectionName;
      const displayLabel = dynamicTitle || navStateName || queryName || decodeURIComponent(id);
      return [
        { label: "Collections", path: "/collections" },
        { label: displayLabel },
      ];
    }

    if (pathname.startsWith("/scripts")) {
      return [{ label: "Scripts" }];
    }

    if (pathname.startsWith("/connections")) {
      return [{ label: "Connections" }];
    }

    if (pathname.startsWith("/secrets")) {
      const id = pathname.replace("/secrets/", "").replace("/secrets", "");
      if (!id || id === "/") {
        return [{ label: "Secrets" }];
      }
      if (id === "new") {
        return [{ label: "Secrets", path: "/secrets" }, { label: "New Secret" }];
      }
      const navStateName = (location.state as { name?: string } | null)?.name;
      return [
        { label: "Secrets", path: "/secrets" },
        { label: dynamicTitle || navStateName || decodeURIComponent(id) },
      ];
    }

    if (pathname.startsWith("/translations")) {
      return [{ label: "Translations" }];
    }

    if (pathname.startsWith("/workbench")) {
      return [{ label: "Workbench" }];
    }

    if (pathname.startsWith("/settings/languages")) {
      return [{ label: "Settings" }, { label: "Supported Languages" }];
    }

    if (pathname.startsWith("/settings/migration")) {
      return [{ label: "Settings" }, { label: "Migration" }];
    }

    // Default fallback
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((seg, i) => {
      const label = seg.charAt(0).toUpperCase() + seg.slice(1);
      return i === segments.length - 1
        ? { label }
        : { label, path: `/${segments.slice(0, i + 1).join("/")}` };
    });
  }, [location.pathname, location.search, location.state, dynamicTitle]);

  return (
    <header className={styles.header} role="banner">
      {/* Left: Dynamic Contextual Breadcrumbs */}
      <div className={styles.headerLeft}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
          <Link to="/" className={styles.crumbLink} title="Home">
            Home
          </Link>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.label}-${idx}`}>
                <span className={styles.crumbDivider} aria-hidden="true">
                  <ChevronRight size={13} />
                </span>
                {isLast || !crumb.path ? (
                  <span className={styles.crumbActive} aria-current={isLast ? "page" : undefined}>
                    {crumb.label}
                  </span>
                ) : (
                  <Link to={crumb.path} className={styles.crumbLink}>
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Center: Global Quick Search Trigger */}
      <div className={styles.headerCenter}>
        <div
          className={styles.searchTrigger}
          onClick={() => searchInputRef.current?.focus()}
          role="search"
        >
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            className={styles.searchInput}
            placeholder="Quick search workflows, APIs, queries..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            aria-label="Quick search"
          />
          <kbd className={styles.kbd}>Ctrl K</kbd>
        </div>
      </div>

      {/* Right: Telemetry, Theme & Profile */}
      <div className={styles.headerRight}>
        <div
          className={styles.clusterStatus}
          title={isHealthy ? "Conductor & Weaver clusters active" : "Cluster services degraded"}
        >
          <span className={styles.pulseDot} aria-hidden="true" />
          <span>{isHealthy ? "Cluster UP" : "Degraded"}</span>
        </div>

        <button
          type="button"
          onClick={handleToggleTheme}
          className={styles.themeToggleBtn}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <UserMenu />
      </div>
    </header>
  );
};

export default Header;
