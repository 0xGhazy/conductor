import React, {
  memo,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableSortLabel from "@mui/material/TableSortLabel";
import Checkbox from "@mui/material/Checkbox";
import Radio from "@mui/material/Radio";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";

import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { WeaverTextField } from "../../fields/WeaverTextField";
import { DataActionsMenu } from "../internal/DataActionsMenu";
import { DataPagination } from "../internal/DataPagination";
import type {
  WeaverRelatedTableProps,
  WeaverRelatedTableColumn,
} from "./WeaverRelatedTable.types";
import type {
  WeaverSort,
  WeaverPaginationModel,
  WeaverDataAction,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import styles from "./WeaverRelatedTable.module.css";

const resolveAlignment = (align?: WeaverRelatedTableColumn<any>["align"]) => {
  if (align === "center") return "center";
  if (align === "end" || align === "right") return "right";
  return "left";
};

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

interface RelatedTableRowProps<TRecord> {
  record: TRecord;
  recordId: string | number;
  columns: WeaverRelatedTableColumn<TRecord>[];
  isSelected: boolean;
  isClickable: boolean;
  showCheckbox: boolean;
  showRadio: boolean;
  rowActions?: WeaverDataAction<TRecord>[];
  /** Only provided when row actions exist, so selection changes don't re-render every row otherwise */
  actionSelectedIds?: Array<string | number>;
  onRowClick: (record: TRecord) => void;
  onToggleSelect: (id: string | number) => void;
}

/** Memoized data row: re-renders only when its own record/selection/columns change */
function RelatedTableRowInner<TRecord>({
  record,
  recordId,
  columns,
  isSelected,
  isClickable,
  showCheckbox,
  showRadio,
  rowActions,
  actionSelectedIds,
  onRowClick,
  onToggleSelect,
}: RelatedTableRowProps<TRecord>) {
  const hasRowActions = Boolean(rowActions && rowActions.length > 0);
  const rowClasses = [
    styles.tableRow,
    isClickable ? styles.tableRowClickable : "",
    isSelected ? styles.tableRowSelected : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TableRow
      className={rowClasses}
      hover
      selected={isSelected}
      onClick={() => onRowClick(record)}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onRowClick(record);
        }
      }}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? "button" : undefined}
    >
      {/* Row Checkbox */}
      {showCheckbox && (
        <TableCell width={40} padding="checkbox" onClick={stopPropagation}>
          <Checkbox
            size="small"
            checked={isSelected}
            onChange={() => onToggleSelect(recordId)}
            inputProps={{ "aria-label": `Select record ${recordId}` }}
          />
        </TableCell>
      )}

      {/* Row Radio */}
      {showRadio && (
        <TableCell width={40} padding="checkbox" onClick={stopPropagation}>
          <Radio
            size="small"
            checked={isSelected}
            onChange={() => onToggleSelect(recordId)}
            inputProps={{ "aria-label": `Select record ${recordId}` }}
          />
        </TableCell>
      )}

      {/* Row Cells */}
      {columns.map((col) => {
        const rawValue = col.getValue ? col.getValue(record) : (record as any)[col.key];

        let renderedCell: ReactNode;
        if (col.render) {
          renderedCell = col.render(record, rawValue);
        } else if (rawValue != null) {
          renderedCell = String(rawValue);
        } else {
          renderedCell = "-";
        }

        return (
          <TableCell
            key={col.key}
            align={resolveAlignment(col.align)}
            className={styles.tableCell}
            width={col.width}
            style={{ minWidth: col.minWidth }}
          >
            {renderedCell}
          </TableCell>
        );
      })}

      {/* Row Actions Menu */}
      {hasRowActions && (
        <TableCell className={styles.actionsCell} onClick={stopPropagation}>
          <DataActionsMenu
            actions={rowActions}
            context={{
              record,
              selectedIds: actionSelectedIds ?? [],
            }}
            ariaLabel={`Actions for record ${recordId}`}
          />
        </TableCell>
      )}
    </TableRow>
  );
}

const RelatedTableRow = memo(RelatedTableRowInner) as typeof RelatedTableRowInner;

export function WeaverRelatedTable<TRecord>({
  records = [],
  columns = [],
  getRecordId,
  dataMode = "client",
  loading = false,
  errorMessage,
  searchable = false,
  searchValue,
  defaultSearchValue = "",
  onSearchChange,
  searchPlaceholder = "Search records...",
  searchDebounceMs = 250,
  sortModel,
  defaultSortModel = [],
  onSortChange,
  pagination = true,
  paginationModel,
  defaultPaginationModel,
  onPaginationChange,
  totalRecords,
  pageSizeOptions = [5, 10, 25],
  selectionMode = "none",
  selectedIds,
  defaultSelectedIds = [],
  onSelectionChange,
  onRowClick,
  rowActions,
  bulkActions,
  primaryAction,
  filterContent,
  toolbarContent,
  emptyState,
  emptySearchMessage = "No related records match your search.",
  maxHeight,
  stickyHeader,
  className = "",
  style,
}: WeaverRelatedTableProps<TRecord>) {
  // ----------------------------------------------------
  // 1. Search State Management
  // ----------------------------------------------------
  const isSearchControlled = searchValue !== undefined;
  const [internalSearch, setInternalSearch] = useState<string>(
    defaultSearchValue
  );
  const effectiveSearch = isSearchControlled ? searchValue : internalSearch;

  // Debounced search propagation for uncontrolled search. Controlled search already
  // reports each keystroke immediately (see handleSearchInputChange), so it is skipped
  // here; the initial value is never re-reported on mount.
  const lastReportedSearchRef = useRef(effectiveSearch);
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  useEffect(() => {
    if (isSearchControlled) {
      lastReportedSearchRef.current = effectiveSearch;
      return;
    }
    if (effectiveSearch === lastReportedSearchRef.current) return;
    const timer = setTimeout(() => {
      lastReportedSearchRef.current = effectiveSearch;
      onSearchChangeRef.current?.(effectiveSearch);
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [effectiveSearch, isSearchControlled, searchDebounceMs]);

  const handleSearchInputChange = (val: string) => {
    if (!isSearchControlled) {
      setInternalSearch(val);
    } else {
      onSearchChange?.(val);
    }
  };

  // ----------------------------------------------------
  // 2. Sort State Management
  // ----------------------------------------------------
  const isSortControlled = sortModel !== undefined;
  const [internalSortModel, setInternalSortModel] = useState<WeaverSort[]>(
    defaultSortModel
  );
  const effectiveSortModel = isSortControlled ? sortModel : internalSortModel;

  const handleToggleSort = (fieldKey: string) => {
    const existing = effectiveSortModel.find((s) => s.field === fieldKey);
    let nextSort: WeaverSort[] = [];

    if (!existing) {
      nextSort = [{ field: fieldKey, direction: "asc" }];
    } else if (existing.direction === "asc") {
      nextSort = [{ field: fieldKey, direction: "desc" }];
    } else {
      nextSort = [];
    }

    if (!isSortControlled) {
      setInternalSortModel(nextSort);
    }
    onSortChange?.(nextSort);
  };

  // ----------------------------------------------------
  // 3. Pagination State Management
  // ----------------------------------------------------
  const isPaginationControlled = paginationModel !== undefined;
  const [internalPaginationModel, setInternalPaginationModel] =
    useState<WeaverPaginationModel>(
      () =>
        defaultPaginationModel ?? {
          page: 0,
          pageSize: pageSizeOptions[0] ?? 10,
        }
    );
  const effectivePaginationModel = isPaginationControlled
    ? paginationModel
    : internalPaginationModel;

  const handlePaginationChange = (newModel: WeaverPaginationModel) => {
    if (!isPaginationControlled) {
      setInternalPaginationModel(newModel);
    }
    onPaginationChange?.(newModel);
  };

  // ----------------------------------------------------
  // 4. Selection State Management
  // ----------------------------------------------------
  const isSelectionControlled = selectedIds !== undefined;
  const [internalSelectedIds, setInternalSelectedIds] = useState<
    Array<string | number>
  >(defaultSelectedIds);
  const effectiveSelectedIds = isSelectionControlled
    ? selectedIds
    : internalSelectedIds;

  // ----------------------------------------------------
  // 5. Data Pipeline (Client vs Server)
  // ----------------------------------------------------
  // A. Search filter
  const filteredRecords = useMemo(() => {
    if (dataMode === "server" || !searchable || !effectiveSearch.trim()) {
      return records;
    }
    const q = effectiveSearch.trim().toLowerCase();
    const searchableColumns = columns.filter((col) => col.searchable !== false);

    return records.filter((rec) =>
      searchableColumns.some((col) => {
        const val = col.getValue ? col.getValue(rec) : (rec as any)[col.key];
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [records, dataMode, searchable, effectiveSearch, columns]);

  // B. Sorting
  const sortedRecords = useMemo(() => {
    if (dataMode === "server" || effectiveSortModel.length === 0) {
      return filteredRecords;
    }

    const colMap = new Map(columns.map((c) => [c.key, c]));
    const sorted = [...filteredRecords];

    sorted.sort((a, b) => {
      for (const sort of effectiveSortModel) {
        const col = colMap.get(sort.field);
        if (!col) continue;

        const valA = col.getValue ? col.getValue(a) : (a as any)[col.key];
        const valB = col.getValue ? col.getValue(b) : (b as any)[col.key];

        if (valA === valB) continue;
        if (valA == null) return sort.direction === "asc" ? -1 : 1;
        if (valB == null) return sort.direction === "asc" ? 1 : -1;

        let cmp = 0;
        if (typeof valA === "number" && typeof valB === "number") {
          cmp = valA - valB;
        } else if (valA instanceof Date && valB instanceof Date) {
          cmp = valA.getTime() - valB.getTime();
        } else {
          cmp = String(valA).localeCompare(String(valB));
        }

        if (cmp !== 0) {
          return sort.direction === "asc" ? cmp : -cmp;
        }
      }
      return 0;
    });

    return sorted;
  }, [filteredRecords, dataMode, effectiveSortModel, columns]);

  // C. Pagination slicing
  const effectiveTotalCount =
    dataMode === "server" ? (totalRecords ?? records.length) : filteredRecords.length;

  const displayedRecords = useMemo(() => {
    if (dataMode === "server" || !pagination) {
      return sortedRecords;
    }
    const start =
      effectivePaginationModel.page * effectivePaginationModel.pageSize;
    return sortedRecords.slice(
      start,
      start + effectivePaginationModel.pageSize
    );
  }, [sortedRecords, dataMode, pagination, effectivePaginationModel]);

  // ----------------------------------------------------
  // 6. Selection Handlers
  // ----------------------------------------------------
  const handleToggleSelectRecord = useCallback(
    (id: string | number) => {
      let nextIds: Array<string | number>;
      if (selectionMode === "single") {
        nextIds = effectiveSelectedIds.includes(id) ? [] : [id];
      } else {
        nextIds = effectiveSelectedIds.includes(id)
          ? effectiveSelectedIds.filter((item) => item !== id)
          : [...effectiveSelectedIds, id];
      }

      if (!isSelectionControlled) {
        setInternalSelectedIds(nextIds);
      }

      const idSet = new Set(nextIds);
      const selectedRecords = records.filter((r) => idSet.has(getRecordId(r)));
      onSelectionChange?.(nextIds, selectedRecords);
    },
    [
      selectionMode,
      effectiveSelectedIds,
      isSelectionControlled,
      records,
      getRecordId,
      onSelectionChange,
    ]
  );

  const visibleRecordIds = useMemo(
    () => displayedRecords.map((r) => getRecordId(r)),
    [displayedRecords, getRecordId]
  );

  const isAllVisibleSelected =
    visibleRecordIds.length > 0 &&
    visibleRecordIds.every((id) => effectiveSelectedIds.includes(id));

  const isSomeVisibleSelected =
    visibleRecordIds.some((id) => effectiveSelectedIds.includes(id)) &&
    !isAllVisibleSelected;

  const handleToggleSelectAllVisible = () => {
    let nextIds: Array<string | number>;
    if (isAllVisibleSelected) {
      // Deselect visible
      const visibleSet = new Set(visibleRecordIds);
      nextIds = effectiveSelectedIds.filter((id) => !visibleSet.has(id));
    } else {
      // Select visible
      const combined = new Set([...effectiveSelectedIds, ...visibleRecordIds]);
      nextIds = Array.from(combined);
    }

    if (!isSelectionControlled) {
      setInternalSelectedIds(nextIds);
    }

    const idSet = new Set(nextIds);
    const selectedRecords = records.filter((r) => idSet.has(getRecordId(r)));
    onSelectionChange?.(nextIds, selectedRecords);
  };

  // ----------------------------------------------------
  // 7. Alignment & Styling Helpers
  // ----------------------------------------------------
  // Stable row callbacks (latest handlers via refs) so memoized rows can skip re-rendering
  const onRowClickRef = useRef(onRowClick);
  onRowClickRef.current = onRowClick;
  const toggleSelectRef = useRef(handleToggleSelectRecord);
  toggleSelectRef.current = handleToggleSelectRecord;
  const handleRowClick = useCallback((record: TRecord) => onRowClickRef.current?.(record), []);
  const handleRowToggleSelect = useCallback(
    (id: string | number) => toggleSelectRef.current(id),
    []
  );

  const hasRowActions = Boolean(rowActions && rowActions.length > 0);
  const showCheckbox = selectionMode === "multiple";
  const showRadio = selectionMode === "single";
  const isSticky = stickyHeader ?? Boolean(maxHeight);

  const hasToolbar =
    searchable ||
    filterContent ||
    toolbarContent ||
    primaryAction ||
    (bulkActions && effectiveSelectedIds.length > 0);

  return (
    <div
      className={`${styles.container} ${className}`}
      style={style}
      role="region"
      aria-label="Related records table"
    >
      {/* Optional Toolbar */}
      {hasToolbar ? (
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {/* Compact Search Field */}
            {searchable ? (
              <div className={styles.searchWrapper}>
                <WeaverTextField
                  size="small"
                  value={effectiveSearch}
                  placeholder={searchPlaceholder}
                  onChange={handleSearchInputChange}
                  clearable
                  onClear={() => handleSearchInputChange("")}
                  startAdornment={
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  }
                  fullWidth
                />
              </div>
            ) : null}

            {/* Selected Count & Bulk Actions */}
            {effectiveSelectedIds.length > 0 && bulkActions && bulkActions.length > 0 ? (
              <div className={styles.bulkActionsBar}>
                <span>{effectiveSelectedIds.length} selected</span>
                {bulkActions.map((action) => (
                  <Button
                    key={action.id}
                    size="small"
                    variant="text"
                    color={action.danger ? "error" : "primary"}
                    startIcon={action.icon}
                    onClick={() => {
                      const idSet = new Set(effectiveSelectedIds);
                      const selected = records.filter((r) => idSet.has(getRecordId(r)));
                      action.onClick({
                        selectedIds: effectiveSelectedIds,
                        selectedRecords: selected,
                      });
                    }}
                    sx={{ textTransform: "none", py: 0, px: 0.75, fontSize: "0.75rem" }}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {/* Custom Filter Slot */}
            {filterContent}

            {/* Custom Toolbar Elements */}
            {toolbarContent}
          </div>

          {/* Section Primary Action (e.g. + Add Query) */}
          <div className={styles.toolbarRight}>
            {primaryAction ? (
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={primaryAction.icon}
                disabled={primaryAction.disabled}
                onClick={primaryAction.onClick}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Embedded Error State */}
      {errorMessage ? (
        <div className={styles.errorAlert} role="alert">
          <ErrorOutlineIcon fontSize="small" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Table Container */}
      <TableContainer
        className={styles.tableContainer}
        sx={{ maxHeight }}
      >
        <Table stickyHeader={isSticky} size="small" className={styles.table}>
          <TableHead>
            <TableRow className={styles.tableHeadRow}>
              {/* Select All Checkbox */}
              {showCheckbox && (
                <TableCell width={40} padding="checkbox" className={styles.tableHeadCell}>
                  <Checkbox
                    size="small"
                    checked={isAllVisibleSelected}
                    indeterminate={isSomeVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    inputProps={{ "aria-label": "Select all visible records" }}
                  />
                </TableCell>
              )}

              {/* Radio Spacer */}
              {showRadio && (
                <TableCell width={40} padding="checkbox" className={styles.tableHeadCell} />
              )}

              {/* Data Columns */}
              {columns.map((col) => {
                const sortConfig = effectiveSortModel.find((s) => s.field === col.key);
                const isSortable = col.sortable === true;
                const align = resolveAlignment(col.align);

                return (
                  <TableCell
                    key={col.key}
                    width={col.width}
                    align={align === "center" ? "left" : align}
                    className={styles.tableHeadCell}
                    sortDirection={sortConfig ? sortConfig.direction : false}
                    style={{ minWidth: col.minWidth }}
                  >
                    {isSortable ? (
                      <TableSortLabel
                        active={Boolean(sortConfig)}
                        direction={sortConfig ? sortConfig.direction : "asc"}
                        onClick={() => handleToggleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                );
              })}

              {/* Actions Column */}
              {hasRowActions && (
                <TableCell width={48} align="left" className={styles.tableHeadCell}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {/* Loading Skeletons */}
            {loading ? (
              Array.from({ length: 4 }).map((_, rIdx) => (
                <TableRow key={`skeleton-${rIdx}`} className={styles.tableRow}>
                  {(showCheckbox || showRadio) && (
                    <TableCell width={40} padding="checkbox">
                      <Skeleton variant="rectangular" width={18} height={18} />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={`sk-col-${col.key}`} width={col.width}>
                      <Skeleton variant="text" width="75%" height={20} />
                    </TableCell>
                  ))}
                  {hasRowActions && (
                    <TableCell width={48} align="right">
                      <Skeleton variant="circular" width={22} height={22} sx={{ ml: "auto" }} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : displayedRecords.length === 0 ? (
              /* Empty Row */
              <TableRow>
                <TableCell
                  colSpan={columns.length + (showCheckbox || showRadio ? 1 : 0) + (hasRowActions ? 1 : 0)}
                  sx={{ p: 0, border: "none" }}
                >
                  {emptyState ? (
                    emptyState
                  ) : (
                    <div className={styles.emptyContainer}>
                      <Typography className={styles.emptyText}>
                        {effectiveSearch.trim() ? emptySearchMessage : "No related records found."}
                      </Typography>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              /* Data Rows */
              displayedRecords.map((record) => {
                const recordId = getRecordId(record);
                return (
                  <RelatedTableRow
                    key={String(recordId)}
                    record={record}
                    recordId={recordId}
                    columns={columns}
                    isSelected={effectiveSelectedIds.includes(recordId)}
                    isClickable={Boolean(onRowClick)}
                    showCheckbox={showCheckbox}
                    showRadio={showRadio}
                    rowActions={hasRowActions ? rowActions : undefined}
                    actionSelectedIds={hasRowActions ? effectiveSelectedIds : undefined}
                    onRowClick={handleRowClick}
                    onToggleSelect={handleRowToggleSelect}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Footer */}
      {pagination && (
        <div className={styles.paginationWrapper}>
          <DataPagination
            paginationModel={effectivePaginationModel}
            onPaginationChange={handlePaginationChange}
            totalRecords={effectiveTotalCount}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      )}
    </div>
  );
}
