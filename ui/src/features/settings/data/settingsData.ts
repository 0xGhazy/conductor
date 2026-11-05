/**
 * Data for the Settings pages.
 *
 * - CONFIGURATION_CATALOG and SAMPLE_USERS are placeholders: the server has no API for
 *   editable settings or for listing users yet. The pages label them as sample data.
 * - ROLES and PERMISSIONS describe the real access rules. Keep them in step with
 *   rest/.../security/ConductorSecurityConfiguration.java and the conductor.security.*-role settings.
 */

export type SettingApplies = "Live" | "Restart";

export interface ConfigurationEntry {
  key: string;
  /** Default value, in the server's property format. */
  value: string;
  type: "Integer" | "Boolean" | "Duration" | "Data size" | "Text";
  applies: SettingApplies;
  group: string;
  description: string;
}

/** Property names and defaults as defined in the server code. */
export const CONFIGURATION_CATALOG: ConfigurationEntry[] = [
  { key: "weaver.database.execute.max-rows", value: "1000", type: "Integer", applies: "Live", group: "Database API", description: "Most rows returned when running SQL from the API; extra rows are cut." },
  { key: "weaver.database.execute.max-timeout", value: "60s", type: "Duration", applies: "Live", group: "Database API", description: "Longest timeout allowed for SQL run from the API." },
  { key: "datasource.connection.strict-validation", value: "false", type: "Boolean", applies: "Live", group: "Database API", description: "Reject saving a database whose connection test fails." },
  { key: "weaver.default.http.request.timeout", value: "3000", type: "Integer", applies: "Live", group: "HTTP tasks", description: "Default HTTP task timeout in milliseconds." },
  { key: "weaver.translations.default-language", value: "en-US", type: "Text", applies: "Live", group: "Translations", description: "Language used when neither the caller nor the workflow sets one." },
  { key: "conductor.app.task-input-payload-size-threshold", value: "3072KB", type: "Data size", applies: "Live", group: "Payload limits", description: "Task input above this size is moved to external storage." },
  { key: "conductor.app.max-task-input-payload-size-threshold", value: "10240KB", type: "Data size", applies: "Live", group: "Payload limits", description: "Task input above this size fails the task." },
  { key: "conductor.app.workflow-input-payload-size-threshold", value: "5120KB", type: "Data size", applies: "Live", group: "Payload limits", description: "Workflow input above this size is moved to external storage." },
  { key: "conductor.app.max-workflow-variables-payload-size-threshold", value: "256KB", type: "Data size", applies: "Live", group: "Payload limits", description: "Largest total size of workflow variables (SET_VARIABLE)." },
  { key: "conductor.app.task-exec-log-size-limit", value: "10", type: "Integer", applies: "Live", group: "Indexing", description: "Most execution log entries kept per task." },
  { key: "conductor.app.task-indexing-enabled", value: "true", type: "Boolean", applies: "Live", group: "Indexing", description: "Index tasks so they can be searched." },
  { key: "conductor.audit.enabled", value: "true", type: "Boolean", applies: "Live", group: "Audit", description: "Record audit events for audited operations." },
  { key: "conductor.audit.capture-payloads", value: "true", type: "Boolean", applies: "Live", group: "Audit", description: "Include request details in audit events." },
  { key: "conductor.secrets.cache-ttl", value: "30m", type: "Duration", applies: "Restart", group: "Caches", description: "How long each server caches a secret value." },
  { key: "weaver.translations.cache-ttl", value: "24h", type: "Duration", applies: "Restart", group: "Caches", description: "How long translations stay cached." },
  { key: "conductor.datasource.pool.max-total-connections", value: "200", type: "Integer", applies: "Restart", group: "Connection pools", description: "Most open connections across all database pools." },
  { key: "weaver.scripting.js.max-concurrent", value: "8", type: "Integer", applies: "Restart", group: "Scripting", description: "JavaScript scripts that can run at the same time." },
  { key: "weaver.scripting.python.max-concurrent", value: "4", type: "Integer", applies: "Restart", group: "Scripting", description: "Python scripts that can run at the same time." },
];

/** Default role names (conductor.security.admin-role, ...); a deployment can rename them. */
export interface RoleDefinition {
  id: "admin" | "operator" | "viewer" | "worker";
  name: string;
  label: string;
  description: string;
}

export const ROLES: RoleDefinition[] = [
  { id: "admin", name: "conductor_admin", label: "Admin", description: "Full access, including server administration." },
  { id: "operator", name: "conductor_operator", label: "Operator", description: "Runs workflows and manages definitions, databases and queries." },
  { id: "viewer", name: "conductor_viewer", label: "Viewer", description: "Reads definitions, executions and data." },
  { id: "worker", name: "conductor_worker", label: "Worker", description: "Service accounts that poll and update tasks." },
];

export interface PermissionDefinition {
  id: string;
  label: string;
  /** What the rule covers, in API terms. */
  scope: string;
  roles: RoleDefinition["id"][];
  /** Shown under the label when the rule is broader than its name suggests. */
  note?: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  { id: "read", label: "View definitions, executions and data", scope: "GET /api/**", roles: ["admin", "operator", "viewer", "worker"] },
  { id: "ping", label: "Check database connections", scope: "POST /api/databases/ping, /api/databases/{id}/ping", roles: ["admin", "operator", "viewer", "worker"] },
  { id: "run", label: "Start and manage workflow executions", scope: "/api/workflow/**, /api/tasks/**", roles: ["admin", "operator", "viewer", "worker"], note: "Any signed-in user can do this today, viewers included." },
  { id: "definitions", label: "Create, change and delete workflow and task definitions", scope: "POST, PUT, DELETE /api/metadata/**", roles: ["admin", "operator"] },
  { id: "data", label: "Manage databases and queries, test connections, run SQL", scope: "POST, PUT, DELETE /api/databases/**, /api/queries/**", roles: ["admin", "operator"] },
  { id: "admin", label: "Server administration", scope: "/api/admin/**", roles: ["admin"] },
];

export interface SampleUser {
  id: string;
  name: string;
  username: string;
  email: string;
  roles: string[];
  enabled: boolean;
}

/** Mirrors the users in docker/keycloak/weaver-realm.json. */
export const SAMPLE_USERS: SampleUser[] = [
  { id: "sample-admin", name: "Conductor Admin", username: "admin", email: "admin@conductor.local", roles: ["conductor_admin", "conductor_operator", "conductor_viewer"], enabled: true },
  { id: "sample-operator", name: "Conductor Operator", username: "operator", email: "operator@conductor.local", roles: ["conductor_operator", "conductor_viewer"], enabled: true },
  { id: "sample-viewer", name: "Conductor Viewer", username: "viewer", email: "viewer@conductor.local", roles: ["conductor_viewer"], enabled: true },
  { id: "sample-worker", name: "Weaver worker (service account)", username: "service-account-weaver-worker", email: "", roles: ["conductor_worker"], enabled: true },
];
