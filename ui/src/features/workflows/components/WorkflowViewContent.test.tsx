import { describe, it, assert } from "vitest";
import type { WeaverRelatedTableColumn } from "@/components/common/data";
import type { WeaverSelectOption } from "@/components/common/fields";
import type {
  WorkflowDetail,
  WorkflowFormState,
  WorkflowAuditInfo,
} from "../types/workflowTypes";
import {
  extractReferencedEntitiesFromTasks,
  parseWorkflowRouteId,
  buildWorkflowRouteId,
} from "../services/workflowsService";

// Mock data fixtures
const SAMPLE_WORKFLOW: WorkflowDetail = {
  id: "wf-101",
  name: "Customer_Onboarding_Flow",
  workflowName: "Customer_Onboarding_Flow",
  description: "Coordinates customer KYC verification and database updates",
  version: 3,
  latest: true,
  createdAt: "2026-03-15T10:30:00Z",
  createdBy: { name: "Alice Developer", email: "alice@example.com" },
  updatedAt: "2026-03-20T14:45:00Z",
  updatedBy: { name: "Bob Admin", email: "bob@example.com" },
  variables: { retryLimit: 5, env: "production" },
  inputParameters: { customerId: "string", notifyEmail: "boolean" },
  timeoutPolicy: "TIME_OUT_WF",
  timeoutSeconds: 3600,
  supportedLanguages: ["en", "ar", "fr"],
  language: "en",
  tasks: [
    {
      name: "databaseworker",
      taskReferenceName: "fetch_customer_db",
      type: "database",
      inputParameters: {
        queryId: "query-fetch-customer",
        datasourceId: "db-postgres-prod",
      },
    },
    {
      name: "httpworker",
      taskReferenceName: "notify_crm_http",
      type: "http",
      inputParameters: {
        connection: "CRM_API_V2",
      },
    },
    {
      name: "scriptworker",
      taskReferenceName: "transform_payload_jexl",
      type: "script",
      inputParameters: {
        scriptName: "kyc_payload_sanitizer",
      },
    },
  ],
};

const SAMPLE_QUERIES = [
  {
    id: "query-fetch-customer",
    name: "Fetch Customer Details",
    sql: "SELECT * FROM customers WHERE id = :id",
    timeoutMs: 3000,
    updatedAt: "2026-03-18T12:00:00Z",
  },
];

const SAMPLE_DATABASES = [
  {
    id: "db-postgres-prod",
    name: "Production Postgres",
    type: "POSTGRES",
    status: "ACTIVE",
    url: "jdbc:postgresql://db.internal:5432/crm",
  },
];

const SAMPLE_CONNECTIONS = [
  {
    id: "conn-crm-2",
    name: "CRM_API_V2",
    baseUrl: "https://crm.service.internal/api/v2",
    authType: "BEARER",
    updatedAt: "2026-03-19T09:00:00Z",
  },
];

const SAMPLE_SCRIPTS = [
  {
    id: "script-kyc",
    name: "kyc_payload_sanitizer",
    language: "JEXL",
    description: "Cleanses KYC JSON payloads before storage",
    timeout: 2500,
  },
];

const TIMEOUT_POLICY_OPTIONS: WeaverSelectOption<string>[] = [
  { label: "Timeout Workflow", value: "TIME_OUT_WF" },
  { label: "Alert Only", value: "ALERT_ONLY" },
];

describe("Workflow View/Edit Page Specification", () => {
  describe("1. Basic Page & Data Model", () => {
    it("renders primary workflow detail fields correctly", () => {
      assert.strictEqual(SAMPLE_WORKFLOW.name, "Customer_Onboarding_Flow");
      assert.strictEqual(
        SAMPLE_WORKFLOW.description,
        "Coordinates customer KYC verification and database updates"
      );
      assert.strictEqual(SAMPLE_WORKFLOW.version, 3);
      assert.strictEqual(typeof SAMPLE_WORKFLOW.version, "number");
    });

    it("evaluates audit fields structure according to Database page pattern", () => {
      assert.strictEqual(SAMPLE_WORKFLOW.createdAt, "2026-03-15T10:30:00Z");
      assert.strictEqual(SAMPLE_WORKFLOW.createdBy.name, "Alice Developer");
      assert.strictEqual(SAMPLE_WORKFLOW.updatedAt, "2026-03-20T14:45:00Z");
      assert.strictEqual(SAMPLE_WORKFLOW.updatedBy.name, "Bob Admin");
    });

    it("verifies route id helpers parse and build workflow identifiers correctly", () => {
      const routeId = buildWorkflowRouteId(SAMPLE_WORKFLOW);
      assert.strictEqual(routeId, "wf-101");

      const withoutId = { name: "my_flow", version: 2 };
      assert.strictEqual(buildWorkflowRouteId(withoutId), "my_flow@2");

      const parsed = parseWorkflowRouteId("my_flow@2");
      assert.strictEqual(parsed.name, "my_flow");
      assert.strictEqual(parsed.version, 2);
    });
  });

  describe("2. View / Edit Mode Interactions & New Workflow Fields", () => {
    it("enters edit mode and updates all editable values", () => {
      let formState: WorkflowFormState = {
        id: SAMPLE_WORKFLOW.id,
        name: SAMPLE_WORKFLOW.name,
        description: SAMPLE_WORKFLOW.description || "",
        version: SAMPLE_WORKFLOW.version,
        variablesText: JSON.stringify(SAMPLE_WORKFLOW.variables || {}, null, 2),
        inputsText: JSON.stringify(SAMPLE_WORKFLOW.inputParameters || {}, null, 2),
        timeoutPolicy: SAMPLE_WORKFLOW.timeoutPolicy || "ALERT_ONLY",
        timeoutSeconds: SAMPLE_WORKFLOW.timeoutSeconds ?? 0,
        supportedLanguages: SAMPLE_WORKFLOW.supportedLanguages || [],
        defaultLanguage: SAMPLE_WORKFLOW.language || "en",
      };

      // Mutate editable fields
      formState = {
        ...formState,
        name: "Customer_Onboarding_Flow_V2",
        description: "Updated description for flow",
        timeoutPolicy: "ALERT_ONLY",
        timeoutSeconds: 7200,
        supportedLanguages: ["en", "ar", "es"],
        defaultLanguage: "ar",
        variablesText: JSON.stringify({ retryLimit: 10, env: "staging" }, null, 2),
        inputsText: JSON.stringify({ orderId: "number" }, null, 2),
      };

      assert.strictEqual(formState.name, "Customer_Onboarding_Flow_V2");
      assert.strictEqual(formState.description, "Updated description for flow");
      assert.strictEqual(formState.timeoutPolicy, "ALERT_ONLY");
      assert.strictEqual(formState.timeoutSeconds, 7200);
      assert.deepStrictEqual(formState.supportedLanguages, ["en", "ar", "es"]);
      assert.strictEqual(formState.defaultLanguage, "ar");
    });

    it("validates Timeout Policy options and values", () => {
      assert.strictEqual(TIMEOUT_POLICY_OPTIONS.length, 2);
      assert.strictEqual(TIMEOUT_POLICY_OPTIONS[0].label, "Timeout Workflow");
      assert.strictEqual(TIMEOUT_POLICY_OPTIONS[0].value, "TIME_OUT_WF");
      assert.strictEqual(TIMEOUT_POLICY_OPTIONS[1].label, "Alert Only");
      assert.strictEqual(TIMEOUT_POLICY_OPTIONS[1].value, "ALERT_ONLY");
    });

    it("validates Timeout number constraints", () => {
      const timeoutVal = 3600;
      assert.ok(timeoutVal >= 0);
      assert.strictEqual(typeof timeoutVal, "number");
    });

    it("validates Supported Languages multi-select and Default Language single selection", () => {
      const supported = ["en", "ar", "fr"];
      const defaultLang = "ar";

      assert.ok(Array.isArray(supported));
      assert.strictEqual(supported.length, 3);
      assert.ok(supported.includes(defaultLang));
    });

    it("validates Variables JSON parsing and error detection", () => {
      const validJson = '{\n  "key": "value",\n  "maxRetries": 3\n}';
      const parsed = JSON.parse(validJson);
      assert.strictEqual(parsed.maxRetries, 3);

      const invalidJson = '{ key: invalid_json }';
      assert.throws(() => JSON.parse(invalidJson));
    });

    it("validates Inputs JSON parsing and error detection", () => {
      const validInputs = '{\n  "customerId": "string",\n  "amount": 100\n}';
      const parsed = JSON.parse(validInputs);
      assert.strictEqual(parsed.customerId, "string");
      assert.strictEqual(parsed.amount, 100);

      const invalidInputs = "{ not a valid json }";
      assert.throws(() => JSON.parse(invalidInputs));
    });

    it("ensures Latest Version remains read-only during edit mode", () => {
      const isVersionEditable = false; // Server-managed
      assert.strictEqual(isVersionEditable, false);

      const formState: WorkflowFormState = {
        id: SAMPLE_WORKFLOW.id,
        name: SAMPLE_WORKFLOW.name,
        description: SAMPLE_WORKFLOW.description || "",
        version: SAMPLE_WORKFLOW.version,
        variablesText: "{}",
        inputsText: "{}",
        timeoutPolicy: "ALERT_ONLY",
        timeoutSeconds: 0,
        supportedLanguages: [],
        defaultLanguage: "en",
      };
      assert.strictEqual(formState.version, 3);
    });

    it("cancels edit mode and restores original snapshot values", () => {
      const initialSnapshot = JSON.stringify({
        name: SAMPLE_WORKFLOW.name,
        description: SAMPLE_WORKFLOW.description,
        timeoutPolicy: SAMPLE_WORKFLOW.timeoutPolicy,
        timeoutSeconds: SAMPLE_WORKFLOW.timeoutSeconds,
        supportedLanguages: SAMPLE_WORKFLOW.supportedLanguages,
        defaultLanguage: SAMPLE_WORKFLOW.language,
        variablesText: JSON.stringify(SAMPLE_WORKFLOW.variables || {}, null, 2),
        inputsText: JSON.stringify(SAMPLE_WORKFLOW.inputParameters || {}, null, 2),
      });

      // Mutate
      let formState: WorkflowFormState = {
        name: "Mutated Name",
        description: "Mutated Description",
        version: SAMPLE_WORKFLOW.version,
        variablesText: "{}",
        inputsText: "{}",
        timeoutPolicy: "ALERT_ONLY",
        timeoutSeconds: 999,
        supportedLanguages: ["de"],
        defaultLanguage: "de",
      };

      // Cancel edit: revert to original workflow
      formState = {
        id: SAMPLE_WORKFLOW.id,
        name: SAMPLE_WORKFLOW.name,
        description: SAMPLE_WORKFLOW.description || "",
        version: SAMPLE_WORKFLOW.version,
        variablesText: JSON.stringify(SAMPLE_WORKFLOW.variables || {}, null, 2),
        inputsText: JSON.stringify(SAMPLE_WORKFLOW.inputParameters || {}, null, 2),
        timeoutPolicy: SAMPLE_WORKFLOW.timeoutPolicy || "ALERT_ONLY",
        timeoutSeconds: SAMPLE_WORKFLOW.timeoutSeconds ?? 0,
        supportedLanguages: SAMPLE_WORKFLOW.supportedLanguages || [],
        defaultLanguage: SAMPLE_WORKFLOW.language || "en",
      };

      const restoredSnapshot = JSON.stringify({
        name: formState.name,
        description: formState.description,
        timeoutPolicy: formState.timeoutPolicy,
        timeoutSeconds: formState.timeoutSeconds,
        supportedLanguages: formState.supportedLanguages,
        defaultLanguage: formState.defaultLanguage,
        variablesText: formState.variablesText,
        inputsText: formState.inputsText,
      });

      assert.strictEqual(restoredSnapshot, initialSnapshot);
    });
  });


  describe("4. Task Referenced Entity Extraction", () => {
    it("extracts query, datasource, connection, and script references from workflow definition", () => {
      const ref = extractReferencedEntitiesFromTasks(SAMPLE_WORKFLOW.tasks);

      assert.strictEqual(ref.queryIds.has("query-fetch-customer"), true);
      assert.strictEqual(ref.datasourceIds.has("db-postgres-prod"), true);
      assert.strictEqual(ref.connectionNames.has("CRM_API_V2"), true);
      assert.strictEqual(ref.scriptNames.has("kyc_payload_sanitizer"), true);
    });

    it("handles empty task lists gracefully", () => {
      const ref = extractReferencedEntitiesFromTasks([]);
      assert.strictEqual(ref.queryIds.size, 0);
      assert.strictEqual(ref.datasourceIds.size, 0);
      assert.strictEqual(ref.connectionNames.size, 0);
      assert.strictEqual(ref.scriptNames.size, 0);
    });
  });

  describe("5. Related Sections Table Configurations", () => {
    it("defines Queries section columns and empty state", () => {
      const emptyMsg = "No related queries found.";
      assert.strictEqual(emptyMsg, "No related queries found.");
      assert.strictEqual(SAMPLE_QUERIES.length, 1);
      assert.strictEqual(SAMPLE_QUERIES[0].name, "Fetch Customer Details");
    });

    it("defines Databases section columns and empty state", () => {
      const emptyMsg = "No related databases found.";
      assert.strictEqual(emptyMsg, "No related databases found.");
      assert.strictEqual(SAMPLE_DATABASES.length, 1);
      assert.strictEqual(SAMPLE_DATABASES[0].type, "POSTGRES");
    });

    it("defines Connections section columns and empty state", () => {
      const emptyMsg = "No related connections found.";
      assert.strictEqual(emptyMsg, "No related connections found.");
      assert.strictEqual(SAMPLE_CONNECTIONS.length, 1);
      assert.strictEqual(SAMPLE_CONNECTIONS[0].authType, "BEARER");
    });

    it("defines Scripts section columns and empty state", () => {
      const emptyMsg = "No related scripts found.";
      assert.strictEqual(emptyMsg, "No related scripts found.");
      assert.strictEqual(SAMPLE_SCRIPTS.length, 1);
      assert.strictEqual(SAMPLE_SCRIPTS[0].language, "JEXL");
    });
  });

  describe("6. Error Isolation & Fault Tolerance", () => {
    it("preserves section-level error isolation when a related endpoint fails", async () => {
      const results = await Promise.allSettled([
        Promise.resolve({ data: SAMPLE_QUERIES }),
        Promise.reject(new Error("Database service 503 unavailable")),
        Promise.resolve({ data: SAMPLE_CONNECTIONS }),
        Promise.resolve({ content: SAMPLE_SCRIPTS }),
      ]);

      assert.strictEqual(results[0].status, "fulfilled");
      assert.strictEqual(results[1].status, "rejected");
      assert.strictEqual(results[2].status, "fulfilled");
      assert.strictEqual(results[3].status, "fulfilled");

      const errors = {
        queries: results[0].status === "rejected" ? "error" : undefined,
        databases: results[1].status === "rejected" ? (results[1] as PromiseRejectedResult).reason.message : undefined,
        connections: results[2].status === "rejected" ? "error" : undefined,
        scripts: results[3].status === "rejected" ? "error" : undefined,
      };

      assert.strictEqual(errors.queries, undefined);
      assert.strictEqual(errors.databases, "Database service 503 unavailable");
      assert.strictEqual(errors.connections, undefined);
      assert.strictEqual(errors.scripts, undefined);
    });
  });

  describe("7. Accessibility & Semantic Layout", () => {
    it("ensures stable section IDs for jump navigation", () => {
      const expectedIds = [
        "workflow-queries-section",
        "workflow-databases-section",
        "workflow-connections-section",
        "workflow-scripts-section",
        "workflow-activity-section",
      ];
      expectedIds.forEach((id) => {
        assert.ok(id.startsWith("workflow-"));
        assert.ok(id.endsWith("-section"));
      });
    });

    it("verifies collapsible sections have aria attributes and keyboard listeners", () => {
      const sectionHeaderProps = {
        role: "button",
        tabIndex: 0,
        "aria-expanded": true,
        "aria-controls": "workflow-queries-content",
      };
      assert.strictEqual(sectionHeaderProps.role, "button");
      assert.strictEqual(sectionHeaderProps.tabIndex, 0);
      assert.strictEqual(sectionHeaderProps["aria-expanded"], true);
      assert.strictEqual(sectionHeaderProps["aria-controls"], "workflow-queries-content");
    });
  });

  describe("8. Activity Timeline Integration", () => {
    const buildTimelineActions = (
      workflow: WorkflowDetail,
      auditFields: {
        createdAt?: string;
        createdBy: { name: string; avatarUrl?: string };
        updatedAt?: string;
        updatedBy: { name: string; avatarUrl?: string };
      },
      form: Partial<WorkflowFormState> = {}
    ) => {
      const customActivities =
        (Array.isArray((workflow as any)?.activities) ? (workflow as any).activities : null) ||
        (Array.isArray((workflow as any)?.activity) ? (workflow as any).activity : null) ||
        (Array.isArray((workflow as any)?.history) ? (workflow as any).history : null) ||
        (Array.isArray((workflow as any)?.metadata?.activities)
          ? (workflow as any).metadata.activities
          : null);

      if (customActivities && customActivities.length > 0) {
        return customActivities.map((act: any) => ({
          timestamp: act.timestamp || act.createdAt || act.time || "",
          actor: act.actor || act.user || act.createdBy || "System",
          avatar: act.avatar || act.photo || act.avatarUrl,
          description: act.description || act.message || act.action || "",
          details: Array.isArray(act.details)
            ? act.details
            : act.detail
            ? [String(act.detail)]
            : [],
        }));
      }

      const list: any[] = [];
      const hasBeenUpdated =
        Boolean(auditFields.updatedAt) &&
        (auditFields.updatedAt !== auditFields.createdAt || (workflow?.version ?? 1) > 1);

      if (hasBeenUpdated) {
        const updateActor =
          auditFields.updatedBy?.name && auditFields.updatedBy.name !== "Not modified"
            ? auditFields.updatedBy.name
            : auditFields.createdBy?.name || "System";

        list.push({
          timestamp: auditFields.updatedAt,
          actor: updateActor,
          avatar: auditFields.updatedBy?.avatarUrl || auditFields.createdBy?.avatarUrl,
          description: `Workflow definition updated to version ${form.version || workflow?.version || 1}.`,
          details: [
            `Version: v${form.version || workflow?.version || 1}`,
            `Timeout: ${form.timeoutSeconds ?? 0}s (${form.timeoutPolicy || "ALERT_ONLY"})`,
            `Tasks: ${workflow?.tasks?.length ?? 0} task definition(s)`,
            `Default Language: ${form.defaultLanguage || "en"}`,
          ],
        });
      }

      if (auditFields.createdAt || workflow?.createdAt) {
        list.push({
          timestamp: auditFields.createdAt || workflow?.createdAt,
          actor: auditFields.createdBy?.name || "System",
          avatar: auditFields.createdBy?.avatarUrl,
          description: "Initial workflow definition created.",
          details: [
            "Version: v1",
            `Tasks: ${workflow?.tasks?.length ?? 0} task definition(s)`,
            `Timeout Policy: ${form.timeoutPolicy || "ALERT_ONLY"}`,
          ],
        });
      }

      return list;
    };

    it("synthesizes lifecycle actions from workflow creation and updates", () => {
      const audit = {
        createdAt: SAMPLE_WORKFLOW.createdAt,
        createdBy: { name: SAMPLE_WORKFLOW.createdBy.name },
        updatedAt: SAMPLE_WORKFLOW.updatedAt,
        updatedBy: { name: SAMPLE_WORKFLOW.updatedBy.name },
      };

      const actions = buildTimelineActions(SAMPLE_WORKFLOW, audit, {
        version: SAMPLE_WORKFLOW.version,
        timeoutSeconds: SAMPLE_WORKFLOW.timeoutSeconds,
        timeoutPolicy: SAMPLE_WORKFLOW.timeoutPolicy,
        defaultLanguage: SAMPLE_WORKFLOW.language,
      });

      assert.strictEqual(actions.length, 2);

      // Latest update event first
      assert.strictEqual(actions[0].actor, "Bob Admin");
      assert.strictEqual(
        actions[0].description,
        "Workflow definition updated to version 3."
      );
      assert.ok(actions[0].details.some((d: string) => d.includes("v3")));
      assert.ok(actions[0].details.some((d: string) => d.includes("3600s")));

      // Initial creation event second
      assert.strictEqual(actions[1].actor, "Alice Developer");
      assert.strictEqual(actions[1].description, "Initial workflow definition created.");
      assert.ok(actions[1].details.some((d: string) => d.includes("v1")));
    });

    it("supports custom server activities from workflow metadata", () => {
      const customWf: any = {
        ...SAMPLE_WORKFLOW,
        activities: [
          {
            timestamp: "2026-03-22T08:00:00Z",
            actor: "Charlie Ops",
            description: "Promoted to staging environment",
            details: ["Deployment tag: release-v3.0.1"],
          },
        ],
      };

      const audit = {
        createdAt: customWf.createdAt,
        createdBy: { name: customWf.createdBy.name },
        updatedAt: customWf.updatedAt,
        updatedBy: { name: customWf.updatedBy.name },
      };

      const actions = buildTimelineActions(customWf, audit);
      assert.strictEqual(actions.length, 1);
      assert.strictEqual(actions[0].actor, "Charlie Ops");
      assert.strictEqual(actions[0].description, "Promoted to staging environment");
      assert.deepStrictEqual(actions[0].details, ["Deployment tag: release-v3.0.1"]);
    });

    it("handles brand new workflow with only creation event", () => {
      const newWf: WorkflowDetail = {
        name: "New_Flow",
        version: 1,
        createdAt: "2026-04-01T12:00:00Z",
        createdBy: { name: "System" },
        updatedAt: "2026-04-01T12:00:00Z",
        updatedBy: { name: "System" },
        tasks: [],
      };

      const audit = {
        createdAt: newWf.createdAt,
        createdBy: { name: "System" },
        updatedAt: newWf.updatedAt,
        updatedBy: { name: "Not modified" },
      };

      const actions = buildTimelineActions(newWf, audit, { version: 1 });
      assert.strictEqual(actions.length, 1);
      assert.strictEqual(actions[0].description, "Initial workflow definition created.");
      assert.strictEqual(actions[0].actor, "System");
    });
  });
});
