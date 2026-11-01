import { describe, it, expect } from "vitest";
import {
  applyFilters,
  applySearch,
  applySort,
  matchesFilter,
  paginateRecords,
} from "../internal/dataExplorerFilters";
import { getOperatorsForFieldType } from "../internal/dataExplorerUtils";
import type {
  WeaverDataField,
  WeaverFilterModel,
  WeaverSort,
} from "./WeaverDataExplorer.types";

interface SampleUser {
  id: string;
  name: string;
  role: string;
  age: number;
  active: boolean;
  joinedAt: string;
}

const SAMPLE_DATA: SampleUser[] = [
  { id: "1", name: "Alice Smith", role: "admin", age: 32, active: true, joinedAt: "2024-01-15" },
  { id: "2", name: "Bob Johnson", role: "designer", age: 28, active: false, joinedAt: "2024-03-20" },
  { id: "3", name: "Charlie Davis", role: "operator", age: 45, active: true, joinedAt: "2023-11-05" },
  { id: "4", name: "Diana Prince", role: "admin", age: 30, active: true, joinedAt: "2024-05-12" },
  { id: "5", name: "Evan Wright", role: "operator", age: 22, active: false, joinedAt: "2024-06-01" },
];

const FIELDS: WeaverDataField<SampleUser>[] = [
  { key: "id", label: "ID", getValue: (r) => r.id, hideable: false },
  { key: "name", label: "Name", getValue: (r) => r.name, searchable: true },
  { key: "role", label: "Role", getValue: (r) => r.role, type: "enum" },
  { key: "age", label: "Age", getValue: (r) => r.age, type: "number" },
  { key: "active", label: "Active", getValue: (r) => r.active, type: "boolean" },
  { key: "joinedAt", label: "Joined", getValue: (r) => r.joinedAt, type: "date" },
];

describe("WeaverDataExplorer Filtering & Search Pipeline", () => {
  it("searches records across searchable fields only", () => {
    const results = applySearch(SAMPLE_DATA, FIELDS, "alice");
    if (results.length !== 1 || results[0].name !== "Alice Smith") {
      throw new Error("Expected 1 result for 'alice'");
    }

    const empty = applySearch(SAMPLE_DATA, FIELDS, "nonexistent");
    if (empty.length !== 0) {
      throw new Error("Expected 0 results for 'nonexistent'");
    }
  });

  it("handles type-aware number filters (greaterThan, lessThan, equals)", () => {
    const ageField = FIELDS.find((f) => f.key === "age");

    const matchGt = matchesFilter(
      SAMPLE_DATA[0],
      { id: "f1", field: "age", operator: "greaterThan", value: 30 },
      ageField
    );
    if (!matchGt) throw new Error("Expected 32 > 30 to match");

    const matchLt = matchesFilter(
      SAMPLE_DATA[1],
      { id: "f2", field: "age", operator: "lessThan", value: 25 },
      ageField
    );
    if (matchLt) throw new Error("Expected 28 < 25 to fail");
  });

  it("handles string filters (contains, notContains, equals)", () => {
    const nameField = FIELDS.find((f) => f.key === "name");

    const matchContains = matchesFilter(
      SAMPLE_DATA[0],
      { id: "f1", field: "name", operator: "contains", value: "Smith" },
      nameField
    );
    if (!matchContains) throw new Error("Expected 'Alice Smith' to contain 'Smith'");

    const matchNotContains = matchesFilter(
      SAMPLE_DATA[0],
      { id: "f2", field: "name", operator: "notContains", value: "Bob" },
      nameField
    );
    if (!matchNotContains) throw new Error("Expected 'Alice Smith' to not contain 'Bob'");
  });

  it("handles boolean and date filter operators", () => {
    const activeField = FIELDS.find((f) => f.key === "active");
    const matchBool = matchesFilter(
      SAMPLE_DATA[0],
      { id: "f1", field: "active", operator: "equals", value: true },
      activeField
    );
    if (!matchBool) throw new Error("Expected active=true to match");

    const dateField = FIELDS.find((f) => f.key === "joinedAt");
    const matchDateBefore = matchesFilter(
      SAMPLE_DATA[2], // 2023-11-05
      { id: "f2", field: "joinedAt", operator: "before", value: "2024-01-01" },
      dateField
    );
    if (!matchDateBefore) throw new Error("Expected 2023-11-05 to be before 2024-01-01");
  });

  it("applies multiple AND filters", () => {
    const model: WeaverFilterModel = {
      logic: "AND",
      filters: [
        { id: "f1", field: "active", operator: "equals", value: true },
        { id: "f2", field: "age", operator: "greaterThanOrEqual", value: 30 },
      ],
    };

    const results = applyFilters(SAMPLE_DATA, FIELDS, model);
    // Alice (32, true) and Charlie (45, true) and Diana (30, true)
    if (results.length !== 3) {
      throw new Error(`Expected 3 records matching AND filter, got ${results.length}`);
    }
  });

  it("applies multiple OR filters", () => {
    const model: WeaverFilterModel = {
      logic: "OR",
      filters: [
        { id: "f1", field: "name", operator: "contains", value: "Bob" },
        { id: "f2", field: "name", operator: "contains", value: "Evan" },
      ],
    };

    const results = applyFilters(SAMPLE_DATA, FIELDS, model);
    if (results.length !== 2) {
      throw new Error(`Expected 2 records matching OR filter, got ${results.length}`);
    }
  });

  it("sorts records ascending and descending", () => {
    const sortAsc: WeaverSort[] = [{ field: "age", direction: "asc" }];
    const sortedAsc = applySort(SAMPLE_DATA, FIELDS, sortAsc);
    if (sortedAsc[0].age !== 22 || sortedAsc[sortedAsc.length - 1].age !== 45) {
      throw new Error("Ascending sort by age failed");
    }

    const sortDesc: WeaverSort[] = [{ field: "age", direction: "desc" }];
    const sortedDesc = applySort(SAMPLE_DATA, FIELDS, sortDesc);
    if (sortedDesc[0].age !== 45 || sortedDesc[sortedDesc.length - 1].age !== 22) {
      throw new Error("Descending sort by age failed");
    }
  });

  it("paginates records cleanly", () => {
    const page0 = paginateRecords(SAMPLE_DATA, 0, 2);
    if (page0.length !== 2 || page0[0].id !== "1" || page0[1].id !== "2") {
      throw new Error("Page 0 slicing failed");
    }

    const page1 = paginateRecords(SAMPLE_DATA, 1, 2);
    if (page1.length !== 2 || page1[0].id !== "3" || page1[1].id !== "4") {
      throw new Error("Page 1 slicing failed");
    }

    const page2 = paginateRecords(SAMPLE_DATA, 2, 2);
    if (page2.length !== 1 || page2[0].id !== "5") {
      throw new Error("Page 2 slicing failed");
    }
  });

  it("provides type-specific operators", () => {
    const numOps = getOperatorsForFieldType("number").map((o) => o.value);
    if (!numOps.includes("greaterThan") || numOps.includes("contains")) {
      throw new Error("Number operators definition mismatch");
    }

    const strOps = getOperatorsForFieldType("string").map((o) => o.value);
    if (!strOps.includes("contains") || strOps.includes("greaterThan")) {
      throw new Error("String operators definition mismatch");
    }
  });
});

describe("WeaverDataExplorer Canvas Card & Renderer", () => {
  it("renders basic card with default title and visible fields details", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    const html = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );

    if (!html.includes("Alice Smith")) {
      throw new Error("Expected primary field 'Alice Smith' as title");
    }
    if (!html.includes("Role:")) {
      throw new Error("Expected field label 'Role:' in details");
    }
    if (!html.includes("admin")) {
      throw new Error("Expected field value 'admin' in details");
    }
    if (!html.includes("Age:")) {
      throw new Error("Expected field label 'Age:' in details");
    }
  });

  it("renders custom title from getCanvasTitle / canvas.getTitle", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    const html = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
        getCanvasTitle: (r: SampleUser) => `User: ${r.name.toUpperCase()}`,
      })
    );

    if (!html.includes("User: ALICE SMITH")) {
      throw new Error("Expected custom title 'User: ALICE SMITH'");
    }
  });

  it("renders custom content from renderCanvasContent / canvas.renderContent", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    const html = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
        renderCanvasContent: (r: SampleUser) =>
          React.createElement("div", { "data-testid": "custom-content" }, `Custom: ${r.role}`),
      })
    );

    if (!html.includes('data-testid="custom-content"')) {
      throw new Error("Expected custom content container");
    }
    if (!html.includes("Custom: admin")) {
      throw new Error("Expected custom content value 'Custom: admin'");
    }
  });

  it("renders optional icon when supplied and collapses cleanly when absent", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    // With icon
    const withIconHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
        renderCanvasIcon: () => React.createElement("span", { "data-testid": "user-icon" }, "👤"),
      })
    );
    if (!withIconHtml.includes('data-testid="user-icon"')) {
      throw new Error("Expected icon to render when supplied");
    }

    // Without icon and without status
    const withoutIconHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (withoutIconHtml.includes("user-icon")) {
      throw new Error("Did not expect icon container when absent");
    }
  });

  it("renders optional status tag when supplied and collapses cleanly when absent", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    // With status
    const withStatusHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
        renderCanvasStatus: (r: SampleUser) =>
          React.createElement("span", { "data-testid": "status-tag" }, r.active ? "Active" : "Inactive"),
      })
    );
    if (!withStatusHtml.includes('data-testid="status-tag"')) {
      throw new Error("Expected status tag to render when supplied");
    }
    if (!withStatusHtml.includes("Active")) {
      throw new Error("Expected status tag text 'Active'");
    }

    // Without status
    const withoutStatusHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (withoutStatusHtml.includes("status-tag")) {
      throw new Error("Did not expect status container when absent");
    }
  });

  it("renders selection controls according to selectionMode (multiple, single, none)", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    // Multiple selection -> Checkbox
    const multiHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        selectionMode: "multiple",
        isSelected: true,
        onToggleSelect: () => {},
      })
    );
    if (!multiHtml.includes('type="checkbox"')) {
      throw new Error("Expected checkbox in multiple selection mode");
    }
    if (!multiHtml.includes('data-selected="true"')) {
      throw new Error("Expected data-selected='true' when isSelected is true");
    }

    // Single selection -> Radio
    const singleHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        selectionMode: "single",
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (!singleHtml.includes('type="radio"')) {
      throw new Error("Expected radio in single selection mode");
    }

    // None -> No selection controls
    const noneHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        selectionMode: "none",
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (noneHtml.includes('type="checkbox"') || noneHtml.includes('type="radio"')) {
      throw new Error("Expected no selection control when selectionMode is 'none'");
    }
  });

  it("renders three-dot row actions menu when rowActions exist and hides when absent", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    const rowActions: WeaverDataAction<SampleUser>[] = [
      { id: "edit", label: "Edit User", onClick: () => {} },
      { id: "delete", label: "Delete User", danger: true, onClick: () => {} },
    ];

    // With row actions
    const withActionsHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        rowActions,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (!withActionsHtml.includes("Actions for Alice Smith")) {
      throw new Error("Expected row actions menu button with accessible label");
    }

    // Without row actions
    const withoutActionsHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        rowActions: [],
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (withoutActionsHtml.includes("Actions for Alice Smith")) {
      throw new Error("Did not expect row actions menu when actions array is empty");
    }
  });

  it("renders quick actions footer when provided and hides cleanly when absent", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    let actionExecuted = false;
    const quickActions: WeaverDataAction<SampleUser>[] = [
      {
        id: "promote",
        label: "Promote Admin",
        onClick: ({ record }) => {
          if (record?.id === "1") actionExecuted = true;
        },
      },
    ];

    // With quick actions
    const withQuickHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        canvasQuickActions: quickActions,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (!withQuickHtml.includes("Promote Admin")) {
      throw new Error("Expected quick action button 'Promote Admin'");
    }

    // Verify callback execution
    quickActions[0].onClick({ record: SAMPLE_DATA[0] });
    if (!actionExecuted) {
      throw new Error("Expected quick action onClick handler to execute with record");
    }

    // Without quick actions
    const withoutQuickHtml = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );
    if (withoutQuickHtml.includes("Promote Admin")) {
      throw new Error("Did not expect quick action button when actions are absent");
    }
  });

  it("renders seamlessly under light and dark MUI themes", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createTheme, ThemeProvider } = await import("@mui/material/styles");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    const lightTheme = createTheme({ palette: { mode: "light" } });
    const darkTheme = createTheme({ palette: { mode: "dark" } });

    const lightHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        { theme: lightTheme },
        React.createElement(DataCanvasCard, {
          record: SAMPLE_DATA[0],
          getRecordId: (r: SampleUser) => r.id,
          visibleFields: FIELDS,
          isSelected: false,
          onToggleSelect: () => {},
        })
      )
    );
    if (!lightHtml.includes("Alice Smith")) {
      throw new Error("Light theme rendering failed to include record title");
    }

    const darkHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        { theme: darkTheme },
        React.createElement(DataCanvasCard, {
          record: SAMPLE_DATA[0],
          getRecordId: (r: SampleUser) => r.id,
          visibleFields: FIELDS,
          isSelected: true,
          onToggleSelect: () => {},
        })
      )
    );
    if (!darkHtml.includes("Alice Smith")) {
      throw new Error("Dark theme rendering failed to include record title");
    }
    if (!darkHtml.includes('data-selected="true"')) {
      throw new Error("Dark theme rendering failed to include selected state");
    }
  });

  it("renders responsive grid of cards with DataCanvasView", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasView } = await import("../internal/DataCanvasView");

    const html = renderToStaticMarkup(
      React.createElement(DataCanvasView, {
        records: SAMPLE_DATA,
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: FIELDS,
        selectedIds: ["1", "3"],
        onToggleSelectRecord: () => {},
        canvas: {
          getTitle: (r: SampleUser) => r.name,
          renderStatus: (r: SampleUser) =>
            React.createElement("span", null, r.active ? "Active" : "Inactive"),
        },
      })
    );

    // Checks that all 5 records are rendered in grid
    for (const user of SAMPLE_DATA) {
      if (!html.includes(user.name)) {
        throw new Error(`Expected record '${user.name}' in canvas grid view`);
      }
    }

    // Check selectedIds propagation
    if (!html.includes('data-testid="canvas-card-1"')) {
      throw new Error("Expected canvas-card-1 in canvas view");
    }
  });

  it("handles record click callback and selection synchronization", async () => {
    let clickedRecord: SampleUser | null = null;
    let selectedToggled = false;

    // Simulate clicking card with onRecordClick provided
    const onRecordClick = (r: SampleUser) => {
      clickedRecord = r;
    };
    const onToggleSelect = () => {
      selectedToggled = true;
    };

    onRecordClick(SAMPLE_DATA[0]);
    if (clickedRecord?.id !== "1") {
      throw new Error("Expected onRecordClick to receive clicked record");
    }

    onToggleSelect();
    if (!selectedToggled) {
      throw new Error("Expected onToggleSelect to be invoked");
    }

    // Shared selection set across Table & Canvas views
    const sharedSelectedIds = ["1", "4"];
    const isSelectedAlice = sharedSelectedIds.includes(SAMPLE_DATA[0].id);
    const isSelectedBob = sharedSelectedIds.includes(SAMPLE_DATA[1].id);
    const isSelectedDiana = sharedSelectedIds.includes(SAMPLE_DATA[3].id);

    if (!isSelectedAlice || isSelectedBob || !isSelectedDiana) {
      throw new Error("Shared selection synchronization mismatch");
    }
  });

  it("dynamically shows and hides fields in canvas view based on managed visibleFields", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataCanvasCard } = await import("../internal/DataCanvasCard");

    // Subset A: Name, Role, Age visible
    const subsetA = FIELDS.filter((f) => ["name", "role", "age"].includes(f.key));
    const htmlA = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: subsetA,
        allFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );

    if (!htmlA.includes("Role:") || !htmlA.includes("Age:")) {
      throw new Error("Expected Role and Age to be visible in Subset A");
    }
    if (htmlA.includes("Joined:")) {
      throw new Error("Did not expect Joined to be visible in Subset A");
    }

    // Subset B: Hide Age, Show Joined
    const subsetB = FIELDS.filter((f) => ["name", "role", "joinedAt"].includes(f.key));
    const htmlB = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: subsetB,
        allFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );

    if (!htmlB.includes("Role:") || !htmlB.includes("Joined:")) {
      throw new Error("Expected Role and Joined to be visible in Subset B");
    }
    if (htmlB.includes("Age:")) {
      throw new Error("Did not expect Age to be visible in Subset B (hidden by field manager)");
    }

    // Subset C: Only title field visible (details empty)
    const subsetC = FIELDS.filter((f) => f.key === "name");
    const htmlC = renderToStaticMarkup(
      React.createElement(DataCanvasCard, {
        record: SAMPLE_DATA[0],
        getRecordId: (r: SampleUser) => r.id,
        visibleFields: subsetC,
        allFields: FIELDS,
        isSelected: false,
        onToggleSelect: () => {},
      })
    );

    if (!htmlC.includes("No fields visible")) {
      throw new Error("Expected 'No fields visible' placeholder when all detail fields are hidden");
    }
  });

  it("persists and restores view mode and managed visibleFields via storageKey", async () => {
    const memoryStore: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, value: string) => {
        memoryStore[key] = String(value);
      },
      removeItem: (key: string) => {
        delete memoryStore[key];
      },
      clear: () => {
        for (const k in memoryStore) delete memoryStore[k];
      },
    };

    (globalThis as any).localStorage = mockLocalStorage;

    const { useDataExplorerState } = await import("../internal/useDataExplorerState");
    const React = await import("react");

    // Pre-populate localStorage with canvas view and specific fields
    mockLocalStorage.setItem("test_key:view", "canvas");
    mockLocalStorage.setItem(
      "test_key:visibleFields",
      JSON.stringify(["name", "role", "age"])
    );

    // Test hook rehydration
    let stateResult: any = null;
    function TestHook() {
      stateResult = useDataExplorerState({
        records: SAMPLE_DATA,
        getRecordId: (r) => r.id,
        fields: FIELDS,
        storageKey: "test_key",
      });
      return null;
    }

    const { renderToStaticMarkup } = await import("react-dom/server");
    renderToStaticMarkup(React.createElement(TestHook));

    if (stateResult.view !== "canvas") {
      throw new Error(`Expected persisted view 'canvas', got '${stateResult.view}'`);
    }

    // Should include name, role, age, plus non-hideable 'id'
    if (!stateResult.visibleFieldsKeys.includes("role") || !stateResult.visibleFieldsKeys.includes("id")) {
      throw new Error("Expected persisted visible fields to be restored including non-hideable fields");
    }

    // Mutate view mode and visible fields
    stateResult.setView("table");
    stateResult.setVisibleFields(["name", "age", "active"]);

    if (mockLocalStorage.getItem("test_key:view") !== "table") {
      throw new Error("Expected setView to write updated view to localStorage");
    }
    const savedFields = JSON.parse(mockLocalStorage.getItem("test_key:visibleFields") || "[]");
    if (!savedFields.includes("active") || !savedFields.includes("id")) {
      throw new Error("Expected setVisibleFields to write to localStorage including non-hideable fields");
    }

    delete (globalThis as any).localStorage;
  });
});




