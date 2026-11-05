import { Suspense } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { PageLoadingSpinner } from "@/components/common/feedback";
import { SettingsSidebar } from "../SettingsSidebar/SettingsSidebar";
import styles from "./SettingsLayout.module.css";

/**
 * Settings area: the Settings sidebar next to the selected page. Sits inside the app shell
 * (main sidebar + header stay as they are) and stays mounted while moving between pages,
 * so only the page area shows a loading state.
 */
export function SettingsLayout() {
  // Pass the app layout's context (search, ...) through to the pages.
  const appContext = useOutletContext();

  return (
    <div className={styles.layout}>
      <SettingsSidebar />
      <div className={styles.content}>
        <Suspense fallback={<PageLoadingSpinner fullScreen={false} />}>
          <Outlet context={appContext} />
        </Suspense>
      </div>
    </div>
  );
}

export default SettingsLayout;
