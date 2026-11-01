import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { DatabaseNodeConfig } from "./DatabaseNodeConfig";
import { WeaverNodeConfigurationPanel } from "../../WeaverNodeConfigurationPanel/WeaverNodeConfigurationPanel";
import { fetchDatasources } from "@/features/databases/services/databasesApi";
import {
  fetchQueriesByDatasourceId,
  fetchQueryById,
} from "@/features/queries/services/queriesApi";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";
import { formatSql } from "@/utils/sqlFormat";

// Mock WeaverCodeEditor for testing
vi.mock("@/components/common/editors", () => ({
  WeaverCodeEditor: ({ value, language, onChange, suggestions }: any) => (
    <div
      data-testid={`mock-code-editor-${language}`}
      data-language={language}
      data-suggestions-count={suggestions?.length || 0}
    >
      <textarea
        data-testid={`textarea-${language}`}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));

// Mock databases API
vi.mock("@/features/databases/services/databasesApi", () => ({
  fetchDatasources: vi.fn(),
}));

// Mock queries API
vi.mock("@/features/queries/services/queriesApi", () => ({
  fetchQueriesByDatasourceId: vi.fn(),
  fetchQueryById: vi.fn(),
}));

describe("DatabaseNodeConfig Enhancements", () => {
  const mockNode: Node = {
    id: "db-node-1",
    type: "DATABASE_ACTION",
    position: { x: 0, y: 0 },
    data: {
      name: "Database Query",
      config: {},
    },
  };

  const mockDatasources = [
    { id: "ds-postgres-1", name: "Postgres Production" },
    { id: "ds-mysql-1", name: "MySQL Warehouse" },
  ];

  const mockQueries = [
    {
      id: "q-101",
      name: "Find Users By Status",
      sql: "SELECT * FROM users WHERE status = :status AND tenant_id = :tenantId",
      parameters: { status: "STRING", tenantId: "STRING" },
      timeout: 8000,
    },
    {
      id: "q-102",
      name: "Count Orders",
      sql: "SELECT count(*) FROM orders",
      parameters: null,
      timeout: undefined, // test fallback to 5000
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useWorkflowExecutionStore.getState().resetExecution();
    useDesignerStore.setState({
      nodes: [mockNode],
      edges: [],
      workflowName: "OrderProcessing",
      workflowVersion: 1,
      workflowVariables: { env: "prod", region: "us-east-1" },
    });

    (fetchDatasources as any).mockResolvedValue({ data: mockDatasources });
    (fetchQueriesByDatasourceId as any).mockResolvedValue({ data: mockQueries });
    (fetchQueryById as any).mockResolvedValue({ data: mockQueries[0] });
  });

  it("1 & 7. Removes datasource select placeholder and deletes 'Database connection to run query against'", async () => {
    render(
      <DatabaseNodeConfig
        node={mockNode}
        value={{}}
        onChange={vi.fn()}
      />
    );

    // Verify helper text is deleted
    expect(screen.queryByText("Database connection to run query against")).not.toBeInTheDocument();

    // Verify placeholder 'Select datasource' is deleted
    expect(screen.queryByText("Select datasource")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading datasources...")).not.toBeInTheDocument();
  });

  it("2. Renders query select field populated with queries for selected datasource", async () => {
    render(
      <DatabaseNodeConfig
        node={mockNode}
        value={{ datasourceId: "ds-postgres-1" }}
        onChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchQueriesByDatasourceId).toHaveBeenCalledWith("ds-postgres-1", { size: 100 });
    });

    // Query select field exists
    expect(screen.getByRole("combobox", { name: /^query$/i })).toBeInTheDocument();
  });

  it("3, 4, 8. Selecting a query populates SQL code, parameters, and timeout (with 5000 fallback)", async () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <DatabaseNodeConfig
        node={mockNode}
        value={{ datasourceId: "ds-postgres-1" }}
        onChange={handleChange}
      />
    );

    await waitFor(() => {
      expect(fetchQueriesByDatasourceId).toHaveBeenCalled();
    });

    const querySelect = screen.getByRole("combobox", { name: /^query$/i });
    fireEvent.mouseDown(querySelect);

    const option = await screen.findByRole("option", { name: /Find Users By Status/i });
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queryId: "q-101",
        queryName: "Find Users By Status",
        // Stored SQL is minified; the editor gets it formatted.
        query: formatSql("SELECT * FROM users WHERE status = :status AND tenant_id = :tenantId"),
        parameters: { status: "", tenantId: "" },
        timeout: 8000,
      })
    );

    // Test fallback to 5000 when query timeout is undefined
    const handleChangeFallback = vi.fn();
    rerender(
      <DatabaseNodeConfig
        node={mockNode}
        value={{ datasourceId: "ds-postgres-1" }}
        onChange={handleChangeFallback}
      />
    );

    fireEvent.mouseDown(querySelect);
    const optionNoTimeout = await screen.findByRole("option", { name: /Count Orders/i });
    fireEvent.click(optionNoTimeout);

    expect(handleChangeFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        queryId: "q-102",
        queryName: "Count Orders",
        query: formatSql("SELECT count(*) FROM orders"),
        timeout: 5000,
      })
    );
  });

  it("5. All sections of database node are expanded by default", () => {
    render(
      <DatabaseNodeConfig
        node={mockNode}
        value={{}}
        onChange={vi.fn()}
      />
    );

    // Check that all 4 section contents are visible and not collapsed
    expect(screen.getByText("SQL Query")).toBeInTheDocument();
    expect(screen.getByText("Parameters")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();

    expect(screen.getByTestId("mock-code-editor-sql")).toBeVisible();
    expect(screen.getByTestId("mock-code-editor-json")).toBeVisible();
    expect(screen.getByLabelText(/query timeout/i)).toBeVisible();
  });

  it("6. Logs tab is included in WeaverNodeConfigurationPanel for Database node", () => {
    render(<WeaverNodeConfigurationPanel selectedNode={mockNode} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent("Configuration");
    expect(tabs[1]).toHaveTextContent("JSON");
    expect(tabs[2]).toHaveTextContent("Result");
    expect(tabs[3]).toHaveTextContent("Logs");

    // Switching to Logs tab displays logs component
    fireEvent.click(tabs[3]);
    expect(tabs[3]).toHaveAttribute("aria-selected", "true");
  });

  it("9. SQL editor, parameters, and timeout receive suggestions of workflow variables and inputs", async () => {
    render(
      <DatabaseNodeConfig
        node={mockNode}
        value={{ datasourceId: "ds-postgres-1" }}
        onChange={vi.fn()}
      />
    );

    const sqlEditor = screen.getByTestId("mock-code-editor-sql");
    const jsonEditor = screen.getByTestId("mock-code-editor-json");

    // Both editors received suggestion tokens
    const sqlSuggestionsCount = Number(sqlEditor.getAttribute("data-suggestions-count"));
    const jsonSuggestionsCount = Number(jsonEditor.getAttribute("data-suggestions-count"));

    expect(sqlSuggestionsCount).toBeGreaterThan(0);
    expect(jsonSuggestionsCount).toBeGreaterThan(0);

    // Timeout field handles suggestions (Autocomplete / Ctrl+Space)
    const timeoutInput = screen.getByLabelText(/query timeout/i);
    expect(timeoutInput).toBeInTheDocument();
    expect(timeoutInput).toHaveValue("5000"); // default 5000
  });

  it("strictly scopes suggestions so the first node CANNOT see the second node outputs", () => {
    const node1: Node = {
      id: "node-1",
      type: "DATABASE_ACTION",
      position: { x: 100, y: 100 },
      data: {
        name: "First Query",
        config: { name: "db_first" },
      },
    };

    const node2: Node = {
      id: "node-2",
      type: "DATABASE_ACTION",
      position: { x: 300, y: 100 },
      data: {
        name: "Second Query",
        config: { name: "db_second" },
      },
    };

    const edges = [
      { id: "e1-2", source: "node-1", target: "node-2" },
    ];

    useDesignerStore.setState({
      nodes: [node1, node2],
      edges,
      workflowName: "ScopeTestWf",
      workflowVersion: 1,
      workflowVariables: { tenant: "acme" },
    });

    const { rerender } = render(
      <DatabaseNodeConfig
        node={node1}
        value={{}}
        onChange={vi.fn()}
      />
    );

    const sqlEditorNode1 = screen.getByTestId("mock-code-editor-sql");
    const countNode1 = Number(sqlEditorNode1.getAttribute("data-suggestions-count"));
    expect(countNode1).toBeGreaterThan(0);

    // Now test Node 2: Node 2 is downstream of Node 1, so Node 2 CAN see Node 1's outputs
    rerender(
      <DatabaseNodeConfig
        node={node2}
        value={{}}
        onChange={vi.fn()}
      />
    );

    const sqlEditorNode2 = screen.getByTestId("mock-code-editor-sql");
    const countNode2 = Number(sqlEditorNode2.getAttribute("data-suggestions-count"));
    // Node 2 has workflow variables/inputs PLUS node 1 outputs, so it has strictly more suggestions than Node 1!
    expect(countNode2).toBeGreaterThan(countNode1);
  });
});
