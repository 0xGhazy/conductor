import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WeaverDataExplorerProps,
  WeaverDataView,
  WeaverFilterModel,
  WeaverPaginationModel,
  WeaverSort,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import {
  applyFilters,
  applySearch,
  applySort,
  paginateRecords,
} from "./dataExplorerFilters";

export interface UseDataExplorerStateOptions<TRecord>
  extends WeaverDataExplorerProps<TRecord> { }

export function useDataExplorerState<TRecord>({
  records,
  getRecordId,
  fields,
  storageKey,
  view: controlledView,
  defaultView = "table",
  onViewChange,
  visibleFields: controlledVisibleFields,
  defaultVisibleFields,
  onVisibleFieldsChange,
  searchable = true,
  searchValue: controlledSearchValue,
  defaultSearchValue = "",
  onSearchChange,
  filterModel: controlledFilterModel,
  defaultFilterModel,
  onFilterChange,
  sortModel: controlledSortModel,
  defaultSortModel = [],
  onSortChange,
  pagination = true,
  paginationModel: controlledPaginationModel,
  defaultPaginationModel = { page: 0, pageSize: 10 },
  onPaginationChange,
  totalRecords,
  dataMode = "client",
  selectionMode = "multiple",
  selectedIds: controlledSelectedIds,
  defaultSelectedIds = [],
  onSelectionChange,
}: UseDataExplorerStateOptions<TRecord>) {
  // 1. View state (with optional localStorage persistence)
  const [internalView, setInternalView] = useState<WeaverDataView>(() => {
    if (storageKey && typeof localStorage !== "undefined") {
      try {
        const saved =
          localStorage.getItem(`${storageKey}:view`) ||
          localStorage.getItem(`viewMode:${storageKey}`);
        if (saved === "table" || saved === "canvas") {
          return saved;
        }
      } catch {
        // ignore localStorage error
      }
    }
    return defaultView;
  });

  const view = controlledView ?? internalView;
  const setView = useCallback(
    (nextView: WeaverDataView) => {
      if (controlledView === undefined) setInternalView(nextView);
      if (storageKey && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(`${storageKey}:view`, nextView);
          localStorage.setItem(`viewMode:${storageKey}`, nextView);
        } catch {
          // ignore
        }
      }
      onViewChange?.(nextView);
    },
    [controlledView, onViewChange, storageKey]
  );

  // 2. Visible fields state (with optional localStorage persistence)
  const initialVisibleKeys = useMemo(() => {
    if (defaultVisibleFields) return defaultVisibleFields;
    return fields
      .filter((f) => {
        if (f.visibleByDefault !== undefined) return f.visibleByDefault;
        // Default is to not show ID fields
        if (f.key.toLowerCase() === "id") return false;
        return true;
      })
      .map((f) => f.key);
  }, [defaultVisibleFields, fields]);

  const [internalVisibleFields, setInternalVisibleFields] = useState<string[]>(
    () => {
      if (storageKey && typeof localStorage !== "undefined") {
        try {
          const raw = localStorage.getItem(`${storageKey}:visibleFields`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const allKeys = new Set(fields.map((f) => f.key));
              const validKeys = parsed.filter((k) => allKeys.has(k));
              const nonHideableKeys = fields
                .filter((f) => f.hideable === false)
                .map((f) => f.key);
              if (validKeys.length > 0) {
                return Array.from(new Set([...validKeys, ...nonHideableKeys]));
              }
            }
          }
        } catch {
          // ignore localStorage error
        }
      }
      return initialVisibleKeys;
    }
  );

  const visibleFieldsKeys = controlledVisibleFields ?? internalVisibleFields;

  const setVisibleFields = useCallback(
    (nextFields: string[]) => {
      // Ensure non-hideable fields are always preserved
      const nonHideableKeys = fields
        .filter((f) => f.hideable === false)
        .map((f) => f.key);
      const combined = Array.from(new Set([...nextFields, ...nonHideableKeys]));

      if (controlledVisibleFields === undefined) {
        setInternalVisibleFields(combined);
      }
      if (storageKey && typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(
            `${storageKey}:visibleFields`,
            JSON.stringify(combined)
          );
        } catch {
          // ignore
        }
      }
      onVisibleFieldsChange?.(combined);
    },
    [controlledVisibleFields, fields, onVisibleFieldsChange, storageKey]
  );

  const activeVisibleFields = useMemo(() => {
    const keySet = new Set(visibleFieldsKeys);
    return fields.filter((f) => keySet.has(f.key));
  }, [fields, visibleFieldsKeys]);

  // 3. Search state
  const [internalSearch, setInternalSearch] = useState<string>(defaultSearchValue);
  const searchValue = controlledSearchValue ?? internalSearch;

  const setSearch = useCallback(
    (nextQuery: string) => {
      if (controlledSearchValue === undefined) setInternalSearch(nextQuery);
      onSearchChange?.(nextQuery);
      // Auto reset page when search changes
      if (dataMode === "client") {
        setPagination({ page: 0, pageSize: paginationState.pageSize });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controlledSearchValue, dataMode, onSearchChange]
  );

  // 4. Filter state
  const [internalFilterModel, setInternalFilterModel] = useState<WeaverFilterModel>(
    defaultFilterModel ?? { logic: "AND", filters: [] }
  );
  const filterModel = controlledFilterModel ?? internalFilterModel;

  const setFilterModel = useCallback(
    (nextModel: WeaverFilterModel) => {
      if (controlledFilterModel === undefined) setInternalFilterModel(nextModel);
      onFilterChange?.(nextModel);
      // Auto reset page when filter changes
      if (dataMode === "client") {
        setPagination({ page: 0, pageSize: paginationState.pageSize });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controlledFilterModel, dataMode, onFilterChange]
  );

  // 5. Sort state
  const [internalSortModel, setInternalSortModel] =
    useState<WeaverSort[]>(defaultSortModel);
  const sortModel = controlledSortModel ?? internalSortModel;

  const setSortModel = useCallback(
    (nextSort: WeaverSort[]) => {
      if (controlledSortModel === undefined) setInternalSortModel(nextSort);
      onSortChange?.(nextSort);
    },
    [controlledSortModel, onSortChange]
  );

  const toggleSort = useCallback(
    (fieldKey: string) => {
      const fieldDef = fields.find((f) => f.key === fieldKey);
      if (!fieldDef || fieldDef.sortable === false) return;

      const current = sortModel.find((s) => s.field === fieldKey);
      let next: WeaverSort[];
      if (!current) {
        next = [{ field: fieldKey, direction: "asc" }];
      } else if (current.direction === "asc") {
        next = [{ field: fieldKey, direction: "desc" }];
      } else {
        next = [];
      }
      setSortModel(next);
    },
    [fields, setSortModel, sortModel]
  );

  // 6. Pagination state
  const [internalPagination, setInternalPagination] =
    useState<WeaverPaginationModel>(defaultPaginationModel);
  const paginationState = controlledPaginationModel ?? internalPagination;

  const setPagination = useCallback(
    (nextPagination: WeaverPaginationModel) => {
      if (controlledPaginationModel === undefined) {
        setInternalPagination(nextPagination);
      }
      onPaginationChange?.(nextPagination);
    },
    [controlledPaginationModel, onPaginationChange]
  );

  // 7. Data pipeline derivation (client vs server)
  const { derivedRecords, totalCount } = useMemo(() => {
    if (dataMode === "server") {
      let current = records;
      if (sortModel.length > 0) {
        current = applySort(current, fields, sortModel);
      }
      return {
        derivedRecords: current,
        totalCount: totalRecords ?? records.length,
      };
    }

    // Client pipeline: records -> search -> filters -> sort -> pagination
    let current = records;
    if (searchable && searchValue) {
      current = applySearch(current, fields, searchValue);
    }
    if (filterModel.filters.length > 0) {
      current = applyFilters(current, fields, filterModel);
    }
    if (sortModel.length > 0) {
      current = applySort(current, fields, sortModel);
    }

    const total = current.length;

    if (pagination) {
      current = paginateRecords(
        current,
        paginationState.page,
        paginationState.pageSize
      );
    }

    return { derivedRecords: current, totalCount: total };
  }, [
    dataMode,
    fields,
    filterModel,
    pagination,
    paginationState.page,
    paginationState.pageSize,
    records,
    searchValue,
    searchable,
    sortModel,
    totalRecords,
  ]);

  // 8. Selection state
  const [internalSelectedIds, setInternalSelectedIds] = useState<
    Array<string | number>
  >(defaultSelectedIds);
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;

  const setSelectedIds = useCallback(
    (nextIds: Array<string | number>) => {
      if (controlledSelectedIds === undefined) setInternalSelectedIds(nextIds);

      // Find matching records
      const recordMap = new Map<string | number, TRecord>();
      records.forEach((r) => recordMap.set(getRecordId(r), r));
      const selectedRecords = nextIds
        .map((id) => recordMap.get(id))
        .filter(Boolean) as TRecord[];

      onSelectionChange?.(nextIds, selectedRecords);
    },
    [controlledSelectedIds, getRecordId, onSelectionChange, records]
  );

  const toggleSelectRecord = useCallback(
    (id: string | number) => {
      if (selectionMode === "none") return;
      if (selectionMode === "single") {
        const next = selectedIds.includes(id) ? [] : [id];
        setSelectedIds(next);
        return;
      }

      // multiple
      const next = selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id];
      setSelectedIds(next);
    },
    [selectedIds, selectionMode, setSelectedIds]
  );

  // Current page selection helpers
  const currentPageIds = useMemo(() => {
    return derivedRecords.map((r) => getRecordId(r));
  }, [derivedRecords, getRecordId]);

  const isCurrentPageAllSelected = useMemo(() => {
    if (currentPageIds.length === 0) return false;
    return currentPageIds.every((id) => selectedIds.includes(id));
  }, [currentPageIds, selectedIds]);

  const isCurrentPageSomeSelected = useMemo(() => {
    if (isCurrentPageAllSelected) return false;
    return currentPageIds.some((id) => selectedIds.includes(id));
  }, [currentPageIds, isCurrentPageAllSelected, selectedIds]);

  const toggleSelectAllCurrentPage = useCallback(() => {
    if (selectionMode !== "multiple") return;

    if (isCurrentPageAllSelected) {
      // Deselect all on current page
      const next = selectedIds.filter((id) => !currentPageIds.includes(id));
      setSelectedIds(next);
    } else {
      // Select all on current page
      const next = Array.from(new Set([...selectedIds, ...currentPageIds]));
      setSelectedIds(next);
    }
  }, [
    currentPageIds,
    isCurrentPageAllSelected,
    selectedIds,
    selectionMode,
    setSelectedIds,
  ]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, [setSelectedIds]);

  return {
    view,
    setView,
    fields,
    visibleFieldsKeys,
    activeVisibleFields,
    setVisibleFields,
    searchValue,
    setSearch,
    filterModel,
    setFilterModel,
    sortModel,
    setSortModel,
    toggleSort,
    paginationState,
    setPagination,
    derivedRecords,
    totalCount,
    selectedIds,
    setSelectedIds,
    toggleSelectRecord,
    isCurrentPageAllSelected,
    isCurrentPageSomeSelected,
    toggleSelectAllCurrentPage,
    clearSelection,
  };
}
