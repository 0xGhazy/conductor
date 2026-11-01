import { useCallback, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useWeaverNotification } from "@/components/common/notifications";
import { CollectionsPageContent } from "@/features/collections";
import type { AppLayoutContext } from "@/app/layout/AppLayout";
import "@/styles/definitionPages.css";

export default function CollectionsPage() {
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };

  useEffect(() => {
    document.title = "Collections";
  }, []);

  const notify = useCallback((payload) => {
    if (payload?.severity === "error") {
      showError(payload.message);
    } else if (payload?.message) {
      showSuccess(payload.message);
    }
  }, [showError, showSuccess]);

  return (
    <div className="definitions-page">

      <div className="definitions-content">
        <CollectionsPageContent onNotify={notify} search={search} />
      </div>
    </div>
  );
}
