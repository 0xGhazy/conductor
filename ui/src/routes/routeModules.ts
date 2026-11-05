// Page module loaders, shared by React.lazy in AppRoutes and by link prefetching.
// Calling a loader more than once is cheap: the browser caches the module after the first import.
export const pageLoaders = {
  home: () => import("@/pages/Home/HomeDashboardPage"),
  designer: () => import("@/pages/Designer/DesignerPage"),
  workflows: () => import("@/pages/Workflows/WorkflowsPage"),
  workflowView: () => import("@/pages/Workflows/WorkflowViewPage"),
  databases: () => import("@/pages/Databases/DatabasesPage"),
  databaseView: () => import("@/pages/Databases/DatabaseViewPage"),
  redisSources: () => import("@/pages/Redis/RedisSourcesPage"),
  redisSourceView: () => import("@/pages/Redis/RedisSourceViewPage"),
  queries: () => import("@/pages/Queries/QueriesPage"),
  queryView: () => import("@/pages/Queries/QueryViewPage"),
  collections: () => import("@/pages/Collections/CollectionsPage"),
  collectionView: () => import("@/pages/Collections/CollectionViewPage"),
  scripts: () => import("@/pages/Scripts/ScriptsPage"),
  scriptView: () => import("@/pages/Scripts/ScriptViewPage"),
  connections: () => import("@/pages/Connections/ConnectionsPage"),
  connectionView: () => import("@/pages/Connections/ConnectionViewPage"),
  secrets: () => import("@/pages/Secrets/SecretsPage"),
  secretView: () => import("@/pages/Secrets/SecretViewPage"),
  executions: () => import("@/pages/WorkflowMonitoring/WorkflowMonitoringPage"),
  executionView: () => import("@/pages/WorkflowMonitoring/WorkflowExecutionViewPage"),
  workbench: () => import("@/pages/Workbench/WorkbenchPage"),
  notFound: () => import("@/pages/Errors/NotFoundPage"),
  settingsMigrations: () => import("@/pages/Settings/SettingsMigrationsPage"),
  settingsConfigurations: () => import("@/pages/Settings/SettingsConfigurationsPage"),
  settingsAuditLogs: () => import("@/pages/Settings/SettingsAuditLogsPage"),
  settingsUsers: () => import("@/pages/Settings/SettingsUsersPage"),
  settingsRoles: () => import("@/pages/Settings/SettingsRolesPage"),
  translations: () => import("@/pages/Translations/TranslationsPage"),
  supportedLanguages: () => import("@/pages/Settings/SupportedLanguagesPage"),
} as const;

type PageKey = keyof typeof pageLoaders;

// Top-level path → page modules a user is likely to open from that link (list + detail).
const PREFETCH_BY_PATH: Record<string, PageKey[]> = {
  "/": ["home"],
  "/designer": ["designer"],
  "/workflows": ["workflows", "workflowView"],
  "/executions": ["executions", "executionView"],
  "/databases": ["databases", "databaseView"],
  "/redis": ["redisSources", "redisSourceView"],
  "/queries": ["queries", "queryView"],
  "/collections": ["collections", "collectionView"],
  "/scripts": ["scripts", "scriptView"],
  "/connections": ["connections", "connectionView"],
  "/secrets": ["secrets", "secretView"],
  "/translations": ["translations"],
  "/workbench": ["workbench"],
  "/settings/languages": ["supportedLanguages"],
  "/settings": ["settingsMigrations", "settingsConfigurations", "settingsAuditLogs", "settingsUsers", "settingsRoles"],
};

const prefetched = new Set<PageKey>();

export function prefetchRoute(path: string): void {
  const keys = PREFETCH_BY_PATH[path];
  if (!keys) return;
  for (const key of keys) {
    if (prefetched.has(key)) continue;
    prefetched.add(key);
    pageLoaders[key]().catch(() => {
      // Allow a retry on the next hover if the chunk failed to load.
      prefetched.delete(key);
    });
  }
}
