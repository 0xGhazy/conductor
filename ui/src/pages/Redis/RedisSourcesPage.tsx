import { useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useWeaverNotification } from "@/components/common/notifications";
import { RedisSourcesPageContent } from "@/features/redis";
import type { AppLayoutContext } from "@/app/layout/AppLayout";
import "@/styles/definitionPages.css";

export default function RedisSourcesPage() {
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };

  const notify = useCallback((payload: any) => {
    if (payload?.severity === "error") {
      showError(payload.message);
    } else if (payload?.message) {
      showSuccess(payload.message);
    }
  }, [showError, showSuccess]);

  return (
    <div className="definitions-page">

      <div className="definitions-content">
        <RedisSourcesPageContent onNotify={notify} search={search} />
      </div>
    </div>
  );
}
