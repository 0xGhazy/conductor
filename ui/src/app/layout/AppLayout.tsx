import { Suspense, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar/Sidebar";
import Header from "@/components/layout/Header/Header";
import PageLoadingSpinner from "@/components/common/feedback/PageLoadingSpinner";
import { prefetchRoute } from "@/routes/routeModules";
import type { AppLayoutContext } from "./useAppLayout";
export type { AppLayoutContext } from "./useAppLayout";
import styles from "./AppLayout.module.css";

// Routes whose list pages are cheap to warm up once the shell is idle.
const IDLE_PREFETCH_PATHS = [
  "/workflows",
  "/executions",
  "/databases",
  "/queries",
  "/collections",
  "/scripts",
  "/authentications",
  "/secrets",
  "/caching",
];

/**
 * Maps a pathname to the route pattern it renders, e.g. "/queries/42" -> "queries/:id".
 * Used as the Suspense key: navigating to another route mounts a fresh boundary, so the
 * in-content spinner shows immediately instead of React freezing the previous page while
 * the next page's chunk loads (navigations run inside a transition).
 */
const routePatternKey = (pathname: string): string => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  // One key for the Settings area, so its layout (and sidebar) stays mounted between pages.
  if (segments[0] === "settings") return segments[1] === "languages" ? pathname : "settings";
  return segments
    .map((segment, index) => {
      if (index === 0 || segment === "new" || segment === "endpoints") return segment;
      return ":id";
    })
    .join("/");
};

export default function AppLayout() {
  const [search, setSearch] = useState("");
  const location = useLocation();

  useEffect(() => {
    setSearch("");
  }, [location.pathname]);

  useEffect(() => {
    const prefetchAll = () => IDLE_PREFETCH_PATHS.forEach(prefetchRoute);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(prefetchAll, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const outletContext = useMemo<AppLayoutContext>(() => ({ search, setSearch }), [search]);

  return (
    <div className={styles.appShell}>
      <Sidebar />
      <div className={styles.mainWrapper}>
        <Header search={search} onSearchChange={setSearch} />
        <main className={styles.contentViewport}>
          <Suspense
            key={routePatternKey(location.pathname)}
            fallback={<PageLoadingSpinner fullScreen={false} />}
          >
            <Outlet context={outletContext} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
