import { lazy, Suspense, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
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
  const { search } = useOutletContext<AppLayoutContext>() ?? { search: "" };
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isCreating) {
      document.title = "Weaver - Queries";
    }
  }, [isCreating]);

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
          search={search}
          onCreateQuery={() => setIsCreating(true)}
        />
      </div>
    </div>
  );
}
