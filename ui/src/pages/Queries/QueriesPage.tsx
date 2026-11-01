import { lazy, Suspense, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useWeaverNotification } from "@/components/common/notifications";
import { QueriesPageContent } from "@/features/queries";
import type { AppLayoutContext } from "@/app/layout/AppLayout";
import "@/styles/definitionPages.css";

const QueryViewPage = lazy(() => import("./QueryViewPage"));

const queryViewFallback = (
  <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
    <CircularProgress size={24} />
  </Box>
);

export default function QueriesPage() {
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };
  const [isCreating, setIsCreating] = useState(false);

  const notify = (payload: any) => {
    if (payload?.severity === "error") {
      showError(payload.message);
    } else if (payload?.message) {
      showSuccess(payload.message);
    }
  };

  if (isCreating) {
    return (
      <Suspense fallback={queryViewFallback}>
        <QueryViewPage
          isCreateMode={true}
          onBack={() => setIsCreating(false)}
        />
      </Suspense>
    );
  }

  return (
    <div className="definitions-page">

      <div className="definitions-content">
        <QueriesPageContent
          onNotify={notify}
          search={search}
          onCreateQuery={() => setIsCreating(true)}
        />
      </div>
    </div>
  );
}
