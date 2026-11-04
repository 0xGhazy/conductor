import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "@/services/apiClient";
import {
  fetchDatasourceById,
  fetchDatasources,
  createDatasource,
  pingDatasource,
  testDatasourceConnection,
} from "@/features/databases/services/databasesApi";
import {
  bulkDeleteQueries,
  executeQuery,
  executeSavedQuery,
  fetchQueriesByDatasourceId,
  fetchQueryById,
  createQuery,
} from "./queriesApi";

vi.mock("@/services/apiClient", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

const post = apiClient.post as unknown as ReturnType<typeof vi.fn>;
const get = apiClient.get as unknown as ReturnType<typeof vi.fn>;

describe("database and query endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("databases live under /api/databases", async () => {
    await fetchDatasources({ page: 0, size: 20 });
    expect(get.mock.calls[0][0]).toMatch(/\/api\/databases$/);

    await createDatasource({ name: "orders" } as never);
    expect(post.mock.calls[0][0]).toMatch(/\/api\/databases$/);

    await pingDatasource("db-1");
    expect(post.mock.calls[1][0]).toMatch(/\/api\/databases\/db-1\/ping$/);
  });

  it("loads a database with its queries in one request when asked", async () => {
    await fetchDatasourceById("db-1", { withQueries: true });
    expect(get.mock.calls[0][0]).toMatch(/\/api\/databases\/db-1$/);
    expect(get.mock.calls[0][1]).toEqual({ params: { withQueries: true } });

    await fetchDatasourceById("db-1");
    expect(get.mock.calls[1][1]).toEqual({ params: undefined });
  });

  it("tests a connection from form values without saving", async () => {
    await testDatasourceConnection({ id: "db-1", name: "orders", url: "jdbc:postgresql://h/db" } as never);

    expect(post.mock.calls[0][0]).toMatch(/\/api\/databases\/test$/);
    expect(post.mock.calls[0][1]).toMatchObject({ id: "db-1", connection: { url: "jdbc:postgresql://h/db" } });
  });

  it("lists a database's queries with includeSql", async () => {
    await fetchQueriesByDatasourceId("db-1", { includeSql: true, size: 100 });

    expect(get.mock.calls[0][0]).toMatch(/\/api\/databases\/db-1\/queries$/);
    expect(get.mock.calls[0][1]).toEqual({ params: { includeSql: true, size: 100 } });
  });

  it("reads one query with includeSql", async () => {
    await fetchQueryById("q-1", true);

    expect(get.mock.calls[0][0]).toMatch(/\/api\/queries\/q-1$/);
    expect(get.mock.calls[0][1]).toEqual({ params: { includeSql: true } });
  });

  it("sends datasourceId when creating a query from older form field names", async () => {
    await createQuery({ name: "q", sql: "SELECT 1", dataSource: "db-1" });

    expect(post.mock.calls[0][0]).toMatch(/\/api\/queries$/);
    expect(post.mock.calls[0][1]).toMatchObject({ datasourceId: "db-1" });
  });

  it("runs SQL on the database in the path", async () => {
    await executeQuery({ datasource: "db-1", sql: "SELECT 1", parameters: { a: 1 }, timeout: 3000, maxRows: 10 });

    expect(post.mock.calls[0][0]).toMatch(/\/api\/databases\/db-1\/execute$/);
    expect(post.mock.calls[0][1]).toEqual({ sql: "SELECT 1", parameters: { a: 1 }, timeout: 3000, maxRows: 10 });
  });

  it("refuses to run SQL without a database", async () => {
    await expect(executeQuery({ sql: "SELECT 1" })).rejects.toThrow("database is required");
    expect(post).not.toHaveBeenCalled();
  });

  it("runs a saved query and bulk deletes", async () => {
    await executeSavedQuery("q-1", { status: "COMPLETED" }, 5);
    expect(post.mock.calls[0][0]).toMatch(/\/api\/queries\/q-1\/execute$/);
    expect(post.mock.calls[0][1]).toEqual({ parameters: { status: "COMPLETED" }, maxRows: 5 });

    await bulkDeleteQueries(["q-1", "q-2"]);
    expect(post.mock.calls[1][0]).toMatch(/\/api\/queries\/bulk-delete$/);
    expect(post.mock.calls[1][1]).toEqual(["q-1", "q-2"]);
  });
});
