import { useCallback, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useWeaverNotification } from "@/components/common/notifications";
import { WorkflowsPageContent } from "@/features/workflows";
import type { AppLayoutContext } from "@/app/layout/AppLayout";
import "@/styles/definitionPages.css";

export default function WorkflowsPage() {
  useEffect(() => {
    document.title = "Workflows";
  }, []);

  const notify = useWeaverNotification();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };

  const handleNotify = useCallback((payload: { severity?: string; message?: string } | null) => {
    if (!payload?.message) return;
    if (payload.severity === "error") {
      notify.error(payload.message);
    } else if (payload.severity === "warning") {
      notify.warning(payload.message);
    } else if (payload.severity === "info") {
      notify.info(payload.message);
    } else {
      notify.success(payload.message);
    }
  }, [notify]);

  return (
    <div className="definitions-page">
      <div className="definitions-content">
        <WorkflowsPageContent onNotify={handleNotify} search={search} />
      </div>
    </div>
  );
}
