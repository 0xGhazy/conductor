import React, { useEffect, useRef } from "react";
import { Search, Sun, Moon } from "lucide-react";
import { useBackendHealthChecks } from "@/features/home";
import { UserMenu } from "@/features/auth";
import { useThemeMode } from "@/context/ThemeModeContext";
import styles from "./Header.module.css";

interface HeaderProps {
  search?: string;
  onSearchChange?: (value: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ search = "", onSearchChange }) => {
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

  return (
    <header className={styles.header} role="banner">
      {/* Left spacer for symmetrical grid centering */}
      <div className={styles.headerLeft} aria-hidden="true" />

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
