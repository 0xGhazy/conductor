import React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type {
  WeaverDataAction,
  WeaverDataField,
  WeaverSort,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import { formatDisplayValue } from "./dataExplorerUtils";
import { DataActionsMenu } from "./DataActionsMenu";
import styles from "./DataTableView.module.css";

interface DataTableViewProps<TRecord> {
  records: TRecord[];
  getRecordId: (record: TRecord) => string | number;
  visibleFields: WeaverDataField<TRecord>[];
  selectionMode?: "none" | "single" | "multiple";
  selectedIds: Array<string | number>;
  onToggleSelectRecord: (id: string | number) => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  sortModel: WeaverSort[];
  onToggleSort: (fieldKey: string) => void;
  rowActions?: WeaverDataAction<TRecord>[];
  loading?: boolean;
  stickyHeader?: boolean;
  height?: number | string;
}

export function DataTableView<TRecord>({
  records,
  getRecordId,
  visibleFields,
  selectionMode = "multiple",
  selectedIds,
  onToggleSelectRecord,
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
  sortModel,
  onToggleSort,
  rowActions,
  loading = false,
  height,
}: DataTableViewProps<TRecord>) {
  const hasActions = Boolean(rowActions && rowActions.length > 0);
  const showCheckbox = selectionMode === "multiple";
  const showRadio = selectionMode === "single";

  // Active sort helper
  const getSortDirection = (key: string) => {
    const found = sortModel.find((s) => s.field === key);
    return found ? found.direction : false;
  };

  const checkboxRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isSomeSelected && !isAllSelected;
    }
  }, [isSomeSelected, isAllSelected]);

  if (loading) {
    return (
      <div className={styles.tableContainer} style={{ maxHeight: height, minHeight: 240 }}>
        <table className={styles.tableRoot}>
          <thead>
            <tr className={styles.headerRow}>
              {(showCheckbox || showRadio) && <th className={styles.checkboxCell} />}
              {visibleFields.map((f) => (
                <th key={f.key} className={styles.headerCell} style={{ width: f.width }}>
                  {f.label}
                </th>
              ))}
              {hasActions && <th className={styles.actionsCell} />}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, idx) => (
              <tr key={idx} className={styles.bodyRow}>
                {(showCheckbox || showRadio) && (
                  <td className={styles.checkboxCell}>
                    <div style={{ width: 15, height: 15, borderRadius: 3, background: "var(--color-surface-soft)" }} />
                  </td>
                )}
                {visibleFields.map((f) => (
                  <td key={f.key} className={styles.bodyCell}>
                    <div
                      style={{
                        height: 14,
                        width: "75%",
                        borderRadius: 4,
                        background: "var(--color-surface-soft)",
                      }}
                    />
                  </td>
                ))}
                {hasActions && (
                  <td className={styles.actionsCell}>
                    <div
                      style={{
                        height: 20,
                        width: 20,
                        borderRadius: "50%",
                        background: "var(--color-surface-soft)",
                        marginLeft: "auto",
                      }}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      className={styles.tableContainer}
      style={{ maxHeight: height }}
      tabIndex={0}
      role="region"
      aria-label="Records data table"
    >
      <table className={styles.tableRoot}>
        <thead>
          <tr className={styles.headerRow}>
            {showCheckbox && (
              <th className={styles.checkboxCell}>
                <input
                  ref={checkboxRef}
                  type="checkbox"
                  className={styles.selectionControl}
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Select all records on current page"
                />
              </th>
            )}

            {showRadio && <th className={styles.checkboxCell} />}

            {visibleFields.map((field) => {
              const sortDir = getSortDirection(field.key);
              const isSortable = field.sortable !== false;

              return (
                <th
                  key={field.key}
                  className={`${styles.headerCell} ${isSortable ? styles.headerCellSortable : ""}`}
                  style={{ width: field.width }}
                  onClick={isSortable ? () => onToggleSort(field.key) : undefined}
                  role={isSortable ? "button" : undefined}
                  tabIndex={isSortable ? 0 : undefined}
                  onKeyDown={
                    isSortable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onToggleSort(field.key);
                          }
                        }
                      : undefined
                  }
                  aria-sort={
                    sortDir === "asc"
                      ? "ascending"
                      : sortDir === "desc"
                      ? "descending"
                      : "none"
                  }
                >
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    {field.label}
                    {isSortable && (
                      <span className={styles.sortIndicator} aria-hidden="true">
                        {sortDir === "asc" ? (
                          <ArrowUp size={13} />
                        ) : sortDir === "desc" ? (
                          <ArrowDown size={13} />
                        ) : (
                          <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}

            {hasActions && (
              <th className={styles.actionsCell} aria-label="Actions">
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {records.map((record) => {
            const id = getRecordId(record);
            const isSelected = selectedIds.includes(id);

            const rowClass = [
              styles.bodyRow,
              selectionMode !== "none" ? styles.bodyRowClickable : "",
              isSelected ? styles.bodyRowSelected : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <tr
                key={id}
                className={rowClass}
                onClick={() => onToggleSelectRecord(id)}
              >
                {showCheckbox && (
                  <td className={styles.checkboxCell} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className={styles.selectionControl}
                      checked={isSelected}
                      onChange={() => onToggleSelectRecord(id)}
                      aria-label={`Select record ${id}`}
                    />
                  </td>
                )}

                {showRadio && (
                  <td className={styles.checkboxCell} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="radio"
                      className={styles.selectionControl}
                      checked={isSelected}
                      onChange={() => onToggleSelectRecord(id)}
                      aria-label={`Select record ${id}`}
                    />
                  </td>
                )}

                {visibleFields.map((field) => {
                  const rawVal = field.getValue(record);
                  const renderedVal = field.render
                    ? field.render(rawVal, record)
                    : formatDisplayValue(rawVal);

                  return (
                    <td
                      key={field.key}
                      className={styles.bodyCell}
                      style={{
                        maxWidth: field.width || 320,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {renderedVal}
                    </td>
                  );
                })}

                {hasActions && (
                  <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                    <DataActionsMenu
                      actions={rowActions}
                      context={{
                        record,
                        selectedIds,
                      }}
                      ariaLabel={`Actions for record ${id}`}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTableView;
