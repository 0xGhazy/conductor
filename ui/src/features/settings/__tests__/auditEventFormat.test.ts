import { describe, it, expect } from "vitest";
import {
  actionSentence,
  eventChanges,
  eventSubject,
  exactTimeWithZone,
  fieldLabel,
  hasResourceId,
  isCreation,
  recordedArguments,
} from "@/pages/Settings/auditEventFormat";

const base = { id: "e", timestamp: 1, action: "a", resourceType: "QUERY", status: "SUCCESS" };

describe("audit event formatting", () => {
  it("turns actions into plain sentences", () => {
    expect(actionSentence("updateQuery")).toBe("Updated query");
    expect(actionSentence("createDatabase")).toBe("Created database");
    expect(actionSentence("executeSql")).toBe("Ran SQL");
    expect(actionSentence("startWorkflow")).toBe("Started workflow");
    expect(actionSentence("getAllPollData")).toBe("Get all poll data");
    expect(actionSentence("")).toBe("Event");
  });

  it("labels recorded fields", () => {
    expect(fieldLabel("connection.maxPoolSize")).toBe("Max pool size");
    expect(fieldLabel("datasourceId")).toBe("Database");
    expect(fieldLabel("connection.somethingNew")).toBe("Something new");
  });

  it("reads changes, marks secrets and long values, and spots a create", () => {
    const update = eventChanges({
      ...base,
      details: {
        changes: {
          timeout: { from: 1000, to: 5000 },
          sql: { from: "SELECT 1", to: "SELECT\n  status\nFROM workflow_index" },
          "connection.password": { from: "******", to: "****** (changed)" },
        },
      },
    })!;
    expect(update.map((c) => c.field)).toEqual(["timeout", "sql", "connection.password"]);
    expect(update[0]).toMatchObject({ label: "Timeout (ms)", hasFrom: true, long: false, secret: false });
    expect(update[1].long).toBe(true);
    expect(update[2].secret).toBe(true);
    expect(isCreation(update)).toBe(false);

    const create = eventChanges({ ...base, details: { changes: { name: { to: "orders" } } } })!;
    expect(isCreation(create)).toBe(true);
  });

  it("returns no changes for older events, and their raw arguments in order", () => {
    const legacy = { ...base, details: { arg1: "QueryModel(...)", arg0: "6f1c" } };
    expect(eventChanges(legacy)).toBeNull();
    expect(recordedArguments(legacy)).toEqual([
      ["Argument 1", "6f1c"],
      ["Argument 2", "QueryModel(...)"],
    ]);
  });

  it("names the subject from the recorded name, else the type; never a raw id", () => {
    expect(eventSubject({ ...base, resourceId: "q-1", details: { name: "orders" } })).toBe("orders");
    expect(eventSubject({ ...base, action: "executeSql", resourceType: "DATABASE", resourceId: "q-1" })).toBe(
      "Database"
    );
    // The sentence already says it.
    expect(eventSubject({ ...base, action: "updateQuery", resourceId: "q-1" })).toBeNull();
  });

  it("doesn't treat a read call's arguments as a resource", () => {
    expect(hasResourceId({ ...base, action: "updateQuery", resourceId: "q-1" })).toBe(true);
    expect(hasResourceId({ ...base, action: "searchWorkflows", resourceId: "startTime:DESC" })).toBe(false);
    expect(hasResourceId({ ...base, action: "createQuery", resourceId: "unknown" })).toBe(false);
  });

  it("shows driver properties by name when only their values changed", () => {
    const [change] = eventChanges({
      ...base,
      details: { changes: { "connection.properties": { from: ["sslmode"], to: "sslmode (values changed)" } } },
    })!;
    expect(change).toMatchObject({ to: "sslmode", valuesHidden: true, secret: false });
  });

  it("gives the exact time with its UTC offset", () => {
    expect(exactTimeWithZone(Date.UTC(2026, 10, 5, 12))).toMatch(/\(UTC[+-]\d{2}:\d{2}\)$/);
  });
});
