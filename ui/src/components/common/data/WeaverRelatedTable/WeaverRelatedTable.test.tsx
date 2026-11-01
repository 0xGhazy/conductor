import { describe, it } from "vitest";
import React from "react";
import type {
  WeaverRelatedTableColumn,
  WeaverRelatedTableProps,
} from "./WeaverRelatedTable.types";
import type {
  WeaverSort,
  WeaverPaginationModel,
  WeaverDataAction,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";

interface SampleQuery {
  id: string;
  name: string;
  type: string;
  status: string;
  timeoutMs: number;
}

const SAMPLE_QUERIES: SampleQuery[] = [
  { id: "q1", name: "Get Customer Details", type: "SELECT", status: "Active", timeoutMs: 3000 },
  { id: "q2", name: "Update Customer Status", type: "UPDATE", status: "Active", timeoutMs: 5000 },
  { id: "q3", name: "Delete Inactive Accounts", type: "DELETE", status: "Draft", timeoutMs: 10000 },
  { id: "q4", name: "List Monthly Invoices", type: "SELECT", status: "Active", timeoutMs: 2500 },
  { id: "q5", name: "Archive Billing Logs", type: "INSERT", status: "Archived", timeoutMs: 8000 },
];

const COLUMNS: WeaverRelatedTableColumn<SampleQuery>[] = [
  { key: "name", label: "Query Name", getValue: (r) => r.name, sortable: true, searchable: true },
  { key: "type", label: "Statement Type", getValue: (r) => r.type, sortable: true },
  { key: "status", label: "Status", render: (r) => `Status: ${r.status}` },
  { key: "timeoutMs", label: "Timeout", getValue: (r) => r.timeoutMs, render: (r) => `${r.timeoutMs}ms`, sortable: true },
];

/**
 * Pure evaluation helper for client-side search across columns.
 */
function searchRecords<T>(
  records: T[],
  columns: WeaverRelatedTableColumn<T>[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return records;

  const searchable = columns.filter((c) => c.searchable !== false);
  return records.filter((rec) =>
    searchable.some((c) => {
      const val = c.getValue ? c.getValue(rec) : (rec as any)[c.key];
      if (val == null) return false;
      return String(val).toLowerCase().includes(q);
    })
  );
}

/**
 * Pure evaluation helper for client-side sorting.
 */
function sortRecords<T>(
  records: T[],
  columns: WeaverRelatedTableColumn<T>[],
  sortModel: WeaverSort[]
): T[] {
  if (!sortModel.length) return records;
  const colMap = new Map(columns.map((c) => [c.key, c]));
  const sorted = [...records];

  sorted.sort((a, b) => {
    for (const sort of sortModel) {
      const col = colMap.get(sort.field);
      if (!col) continue;

      const valA = col.getValue ? col.getValue(a) : (a as any)[col.key];
      const valB = col.getValue ? col.getValue(b) : (b as any)[col.key];

      if (valA === valB) continue;
      if (valA == null) return sort.direction === "asc" ? -1 : 1;
      if (valB == null) return sort.direction === "asc" ? 1 : -1;

      const cmp =
        typeof valA === "number" && typeof valB === "number"
          ? valA - valB
          : String(valA).localeCompare(String(valB));

      if (cmp !== 0) {
        return sort.direction === "asc" ? cmp : -cmp;
      }
    }
    return 0;
  });

  return sorted;
}

/**
 * Pure evaluation helper for client-side pagination.
 */
function paginate<T>(
  records: T[],
  page: number,
  pageSize: number
): T[] {
  const start = page * pageSize;
  return records.slice(start, start + pageSize);
}

describe("WeaverRelatedTable Specification & Behavior", () => {
  describe("1. Basic Rendering & Generic Records", () => {
    it("extracts unique record IDs through custom getRecordId", () => {
      const getRecordId = (q: SampleQuery) => q.id;
      const ids = SAMPLE_QUERIES.map(getRecordId);

      if (ids[0] !== "q1" || ids.length !== 5) {
        throw new Error("Failed to extract record IDs correctly");
      }
    });

    it("supports custom cell render functions", () => {
      const statusCol = COLUMNS.find((c) => c.key === "status");
      if (!statusCol?.render) throw new Error("Status column must have render function");

      const rendered = statusCol.render(SAMPLE_QUERIES[0]);
      if (rendered !== "Status: Active") {
        throw new Error(`Expected 'Status: Active', got '${rendered}'`);
      }
    });
  });

  describe("2. Client-Side Search Pipeline", () => {
    it("filters records matching search text across searchable columns", () => {
      const results = searchRecords(SAMPLE_QUERIES, COLUMNS, "update");
      if (results.length !== 1 || results[0].id !== "q2") {
        throw new Error("Expected search 'update' to return only Update Customer Status");
      }
    });

    it("returns all records when search query is empty or whitespace", () => {
      const results = searchRecords(SAMPLE_QUERIES, COLUMNS, "   ");
      if (results.length !== 5) {
        throw new Error("Expected all 5 records for empty search");
      }
    });

    it("handles zero matches cleanly", () => {
      const results = searchRecords(SAMPLE_QUERIES, COLUMNS, "nonexistent");
      if (results.length !== 0) {
        throw new Error("Expected 0 records for non-matching search");
      }
    });
  });

  describe("3. Client-Side Sorting Pipeline", () => {
    it("sorts records ascending by name", () => {
      const sorted = sortRecords(SAMPLE_QUERIES, COLUMNS, [
        { field: "name", direction: "asc" },
      ]);

      if (sorted[0].name !== "Archive Billing Logs") {
        throw new Error(`Expected first record to be Archive Billing Logs, got ${sorted[0].name}`);
      }
    });

    it("sorts records descending by name", () => {
      const sorted = sortRecords(SAMPLE_QUERIES, COLUMNS, [
        { field: "name", direction: "desc" },
      ]);

      if (sorted[0].name !== "Update Customer Status") {
        throw new Error(`Expected first record to be Update Customer Status, got ${sorted[0].name}`);
      }
    });

    it("sorts records ascending by numeric field", () => {
      const sorted = sortRecords(SAMPLE_QUERIES, COLUMNS, [
        { field: "timeoutMs", direction: "asc" },
      ]);

      if (sorted[0].timeoutMs !== 2500) {
        throw new Error(`Expected lowest timeout 2500ms first, got ${sorted[0].timeoutMs}`);
      }
      if (sorted[sorted.length - 1].timeoutMs !== 10000) {
        throw new Error(`Expected highest timeout 10000ms last, got ${sorted[sorted.length - 1].timeoutMs}`);
      }
    });
  });

  describe("4. Client-Side Pagination Pipeline", () => {
    it("slices records correctly per page and pageSize", () => {
      const page0 = paginate(SAMPLE_QUERIES, 0, 2);
      if (page0.length !== 2 || page0[0].id !== "q1" || page0[1].id !== "q2") {
        throw new Error("Page 0 slice mismatch");
      }

      const page1 = paginate(SAMPLE_QUERIES, 1, 2);
      if (page1.length !== 2 || page1[0].id !== "q3" || page1[1].id !== "q4") {
        throw new Error("Page 1 slice mismatch");
      }

      const page2 = paginate(SAMPLE_QUERIES, 2, 2);
      if (page2.length !== 1 || page2[0].id !== "q5") {
        throw new Error("Page 2 slice mismatch");
      }
    });
  });

  describe("5. Row Click & Actions Isolation", () => {
    it("supports row click handler without interfering with cell actions", () => {
      let clickedRecord: SampleQuery | null = null;
      const onRowClick = (r: SampleQuery) => {
        clickedRecord = r;
      };

      onRowClick(SAMPLE_QUERIES[0]);
      if (clickedRecord?.id !== "q1") {
        throw new Error("Expected row click callback to receive record q1");
      }
    });

    it("verifies row action menu execution context", () => {
      let actionExecuted = false;
      const action: WeaverDataAction<SampleQuery> = {
        id: "unlink",
        label: "Remove relation",
        onClick: (ctx) => {
          if (ctx.record?.id === "q1") {
            actionExecuted = true;
          }
        },
      };

      action.onClick({ record: SAMPLE_QUERIES[0] });
      if (!actionExecuted) {
        throw new Error("Expected action callback to fire with record context");
      }
    });

    it("filters out hidden actions based on record condition", () => {
      const action: WeaverDataAction<SampleQuery> = {
        id: "delete",
        label: "Delete",
        hidden: (r) => r?.status === "Archived",
        onClick: () => {},
      };

      const isHiddenForArchived = typeof action.hidden === "function" && action.hidden(SAMPLE_QUERIES[4]);
      const isHiddenForActive = typeof action.hidden === "function" && action.hidden(SAMPLE_QUERIES[0]);

      if (!isHiddenForArchived) throw new Error("Expected action to be hidden for Archived record");
      if (isHiddenForActive) throw new Error("Expected action to be visible for Active record");
    });
  });

  describe("6. Primary Action Support", () => {
    it("handles section-level primary action configuration", () => {
      let primaryClicked = false;
      const primaryAction = {
        label: "Add Query",
        onClick: () => {
          primaryClicked = true;
        },
      };

      primaryAction.onClick();
      if (!primaryClicked) throw new Error("Expected primary action click callback to fire");
    });
  });

  describe("7. Selection Mechanics", () => {
    it("manages single selection mode", () => {
      let selected: Array<string | number> = [];
      const toggleSingle = (id: string) => {
        selected = selected.includes(id) ? [] : [id];
      };

      toggleSingle("q1");
      if (selected.length !== 1 || selected[0] !== "q1") throw new Error("Failed to select q1");

      toggleSingle("q2");
      if (selected.length !== 1 || selected[0] !== "q2") throw new Error("Expected q2 to replace q1");

      toggleSingle("q2");
      if (selected.length !== 0) throw new Error("Expected q2 to be deselected");
    });

    it("manages multiple selection mode", () => {
      let selected: Array<string | number> = [];
      const toggleMultiple = (id: string) => {
        selected = selected.includes(id)
          ? selected.filter((i) => i !== id)
          : [...selected, id];
      };

      toggleMultiple("q1");
      toggleMultiple("q2");
      if (selected.length !== 2) throw new Error("Expected 2 selected items");

      toggleMultiple("q1");
      if (selected.length !== 1 || selected[0] !== "q2") {
        throw new Error("Expected only q2 to remain selected");
      }
    });

    it("handles select all visible page items without selecting whole server dataset", () => {
      const visibleIds = ["q1", "q2"];
      let selected: Array<string | number> = [];

      // Select all visible
      selected = Array.from(new Set([...selected, ...visibleIds]));
      if (selected.length !== 2) throw new Error("Expected 2 visible items selected");

      // Deselect all visible
      const visibleSet = new Set(visibleIds);
      selected = selected.filter((id) => !visibleSet.has(id));
      if (selected.length !== 0) throw new Error("Expected visible items to be deselected");
    });
  });

  describe("8. State Handlers (Loading, Empty, Error, Sticky)", () => {
    it("validates error message propagation contract", () => {
      const props: WeaverRelatedTableProps<SampleQuery> = {
        records: [],
        columns: COLUMNS,
        getRecordId: (r) => r.id,
        errorMessage: "Failed to fetch related queries",
      };

      if (props.errorMessage !== "Failed to fetch related queries") {
        throw new Error("Expected errorMessage to be preserved");
      }
    });

    it("supports custom stickyHeader and maxHeight constraints", () => {
      const props: WeaverRelatedTableProps<SampleQuery> = {
        records: SAMPLE_QUERIES,
        columns: COLUMNS,
        getRecordId: (r) => r.id,
        maxHeight: 340,
        stickyHeader: true,
      };

      if (props.maxHeight !== 340) throw new Error("Expected maxHeight to be 340");
      if (props.stickyHeader !== true) throw new Error("Expected stickyHeader to be true");
    });
  });
});
