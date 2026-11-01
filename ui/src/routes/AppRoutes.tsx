import React, { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import PageLoadingSpinner from "@/components/common/feedback/PageLoadingSpinner";
import AppLayout from "@/app/layout/AppLayout";
import ProtectedRoute from "@/routes/ProtectedRoute";
import { setNavigator } from "@/services/navigation";
import { pageLoaders } from "@/routes/routeModules";

const HomeDashboardPage = React.lazy(pageLoaders.home);
const DesignerPage = React.lazy(pageLoaders.designer);

const WorkflowsPage = React.lazy(pageLoaders.workflows);
const WorkflowViewPage = React.lazy(pageLoaders.workflowView);
const DatabasesPage = React.lazy(pageLoaders.databases);
const DatabaseViewPage = React.lazy(pageLoaders.databaseView);
const RedisSourcesPage = React.lazy(pageLoaders.redisSources);
const RedisSourceViewPage = React.lazy(pageLoaders.redisSourceView);
const QueriesPage = React.lazy(pageLoaders.queries);
const QueryViewPage = React.lazy(pageLoaders.queryView);
const CollectionsPage = React.lazy(pageLoaders.collections);
const CollectionViewPage = React.lazy(pageLoaders.collectionView);
const ScriptsPage = React.lazy(pageLoaders.scripts);
const ScriptViewPage = React.lazy(pageLoaders.scriptView);
const ConnectionsPage = React.lazy(pageLoaders.connections);
const ConnectionViewPage = React.lazy(pageLoaders.connectionView);
const SecretsPage = React.lazy(pageLoaders.secrets);
const SecretViewPage = React.lazy(pageLoaders.secretView);
const WorkflowMonitoringPage = React.lazy(pageLoaders.executions);
const WorkflowExecutionViewPage = React.lazy(pageLoaders.executionView);
const WorkbenchPage = React.lazy(pageLoaders.workbench);

const NotFoundPage = React.lazy(pageLoaders.notFound);
const MigrationPage = React.lazy(pageLoaders.migration);
const TranslationsPage = React.lazy(pageLoaders.translations);
const SupportedLanguagesPage = React.lazy(pageLoaders.supportedLanguages);

export default function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeDashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/workflows/:id" element={<WorkflowViewPage />} />
            <Route path="/databases" element={<DatabasesPage />} />
            <Route path="/databases/:id" element={<DatabaseViewPage />} />
            <Route path="/redis" element={<RedisSourcesPage />} />
            <Route path="/redis/new" element={<RedisSourceViewPage />} />
            <Route path="/redis/:id" element={<RedisSourceViewPage />} />
            <Route path="/queries" element={<QueriesPage />} />
            <Route path="/queries/new" element={<QueryViewPage isCreateMode={true} />} />
            <Route path="/queries/:id" element={<QueryViewPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/new" element={<CollectionViewPage />} />
            <Route path="/collections/:id" element={<CollectionViewPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/connections/new" element={<ConnectionViewPage />} />
            <Route path="/connections/:id" element={<ConnectionViewPage />} />
            <Route path="/secrets" element={<SecretsPage />} />
            <Route path="/secrets/new" element={<SecretViewPage isCreateMode={true} />} />
            <Route path="/secrets/:id" element={<SecretViewPage />} />
            <Route path="/scripts" element={<ScriptsPage />} />
            <Route path="/scripts/new" element={<ScriptViewPage />} />
            <Route path="/scripts/:id" element={<ScriptViewPage />} />
            <Route path="/translations" element={<TranslationsPage />} />
            <Route path="/executions" element={<WorkflowMonitoringPage />} />
            <Route path="/executions/:workflowId" element={<WorkflowExecutionViewPage />} />
            <Route path="/workbench" element={<WorkbenchPage />} />
            <Route path="/settings" element={<Navigate to="/settings/languages" replace />} />
            <Route path="/settings/languages" element={<SupportedLanguagesPage />} />
            <Route path="/settings/migration" element={<MigrationPage />} />
          </Route>

          <Route path="/designer" element={<DesignerPage />} />
          <Route path="/designer/:workflowId" element={<DesignerPage />} />
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
