import { describe, it, expect } from "vitest";
import { normalizeQuery } from "./queriesService";

describe("normalizeQuery with the query's database object", () => {
  it("takes the database id and name from datasource", () => {
    const query = normalizeQuery({
      id: "q-1",
      name: "workflow-status-latest",
      datasource: { id: "6f1c2a7e-0d2b-4b8e-9c1a-0000000000d1", name: "conductor-db", type: "POSTGRES" },
    });

    expect(query.dataSource).toBe("6f1c2a7e-0d2b-4b8e-9c1a-0000000000d1");
    expect(query.dataSourceName).toBe("conductor-db");
  });
});
