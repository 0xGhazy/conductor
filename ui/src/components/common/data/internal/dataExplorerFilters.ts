import type {
  WeaverDataField,
  WeaverFilter,
  WeaverFilterModel,
  WeaverSort,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";

/**
 * Searches records across fields where `field.searchable !== false`.
 */
export function applySearch<TRecord>(
  records: TRecord[],
  fields: WeaverDataField<TRecord>[],
  query: string
): TRecord[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return records;

  const searchableFields = fields.filter((f) => f.searchable !== false);
  if (searchableFields.length === 0) return records;

  return records.filter((record) => {
    return searchableFields.some((field) => {
      const val = field.getValue(record);
      if (val == null) return false;
      return String(val).toLowerCase().includes(trimmed);
    });
  });
}

/**
 * Checks if a single record matches a single filter condition.
 */
export function matchesFilter<TRecord>(
  record: TRecord,
  filter: WeaverFilter,
  fieldDef?: WeaverDataField<TRecord>
): boolean {
  if (!fieldDef) return true;

  const rawVal = fieldDef.getValue(record);
  const operator = filter.operator;
  const filterVal = filter.value;

  // No-value operators
  if (operator === "isEmpty") {
    return rawVal == null || String(rawVal).trim() === "";
  }
  if (operator === "isNotEmpty") {
    return rawVal != null && String(rawVal).trim() !== "";
  }

  // If filter value is undefined or empty string (and not a boolean or 0)
  if (filterVal === undefined || filterVal === null || filterVal === "") {
    return true;
  }

  // Numeric comparisons
  if (fieldDef.type === "number") {
    const num = Number(rawVal);
    const target = Number(filterVal);
    if (!Number.isFinite(num) || !Number.isFinite(target)) return false;

    switch (operator) {
      case "equals":
        return num === target;
      case "notEquals":
        return num !== target;
      case "greaterThan":
        return num > target;
      case "greaterThanOrEqual":
        return num >= target;
      case "lessThan":
        return num < target;
      case "lessThanOrEqual":
        return num <= target;
      default:
        return true;
    }
  }

  // Date / Datetime comparisons
  if (fieldDef.type === "date" || fieldDef.type === "datetime") {
    const recordTime = rawVal ? new Date(rawVal as any).getTime() : NaN;
    const filterTime = filterVal ? new Date(filterVal as any).getTime() : NaN;
    if (Number.isNaN(recordTime) || Number.isNaN(filterTime)) return false;

    switch (operator) {
      case "equals": {
        // Compare same day
        const d1 = new Date(recordTime).toDateString();
        const d2 = new Date(filterTime).toDateString();
        return d1 === d2;
      }
      case "before":
        return recordTime < filterTime;
      case "after":
        return recordTime > filterTime;
      case "beforeOrEqual":
        return recordTime <= filterTime;
      case "afterOrEqual":
        return recordTime >= filterTime;
      default:
        return true;
    }
  }

  // Boolean comparisons
  if (fieldDef.type === "boolean") {
    const bool = Boolean(rawVal);
    const target =
      typeof filterVal === "boolean"
        ? filterVal
        : String(filterVal).toLowerCase() === "true";

    return operator === "equals" ? bool === target : bool !== target;
  }

  // Enum / Array 'in' / 'notIn'
  if (operator === "in" || operator === "notIn") {
    const list = Array.isArray(filterVal)
      ? filterVal.map((v) => String(v).toLowerCase())
      : String(filterVal)
          .split(",")
          .map((v) => v.trim().toLowerCase());

    const itemStr = String(rawVal ?? "").toLowerCase();
    const contains = list.includes(itemStr);
    return operator === "in" ? contains : !contains;
  }

  // Default string comparisons
  const str = String(rawVal ?? "").toLowerCase();
  const targetStr = String(filterVal).toLowerCase();

  switch (operator) {
    case "contains":
      return str.includes(targetStr);
    case "notContains":
      return !str.includes(targetStr);
    case "equals":
      return str === targetStr;
    case "notEquals":
      return str !== targetStr;
    case "startsWith":
      return str.startsWith(targetStr);
    case "endsWith":
      return str.endsWith(targetStr);
    default:
      return true;
  }
}

/**
 * Applies AND/OR chained filters to records.
 */
export function applyFilters<TRecord>(
  records: TRecord[],
  fields: WeaverDataField<TRecord>[],
  filterModel?: WeaverFilterModel
): TRecord[] {
  if (!filterModel || !filterModel.filters || filterModel.filters.length === 0) {
    return records;
  }

  const fieldMap = new Map<string, WeaverDataField<TRecord>>();
  fields.forEach((f) => fieldMap.set(f.key, f));

  const activeFilters = filterModel.filters.filter((f) => Boolean(f.field));
  if (activeFilters.length === 0) return records;

  const isAnd = filterModel.logic === "AND";

  return records.filter((record) => {
    if (isAnd) {
      return activeFilters.every((filter) =>
        matchesFilter(record, filter, fieldMap.get(filter.field))
      );
    }
    return activeFilters.some((filter) =>
      matchesFilter(record, filter, fieldMap.get(filter.field))
    );
  });
}

/**
 * Sorts records according to sortModel.
 */
export function applySort<TRecord>(
  records: TRecord[],
  fields: WeaverDataField<TRecord>[],
  sortModel?: WeaverSort[]
): TRecord[] {
  if (!sortModel || sortModel.length === 0) return records;

  const fieldMap = new Map<string, WeaverDataField<TRecord>>();
  fields.forEach((f) => fieldMap.set(f.key, f));

  const sorted = [...records];

  sorted.sort((a, b) => {
    for (const sort of sortModel) {
      const fieldDef = fieldMap.get(sort.field);
      if (!fieldDef) continue;

      const valA = fieldDef.getValue(a);
      const valB = fieldDef.getValue(b);

      if (valA === valB) continue;
      if (valA == null || valA === "") return 1;
      if (valB == null || valB === "") return -1;

      let comparison = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime();
      } else if (fieldDef.type === "datetime" || fieldDef.type === "date") {
        const timeA = new Date(valA as any).getTime() || 0;
        const timeB = new Date(valB as any).getTime() || 0;
        comparison = timeA - timeB;
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      if (comparison !== 0) {
        return sort.direction === "asc" ? comparison : -comparison;
      }
    }
    return 0;
  });

  return sorted;
}

/**
 * Slices records for current page and pageSize.
 */
export function paginateRecords<TRecord>(
  records: TRecord[],
  page: number,
  pageSize: number
): TRecord[] {
  const start = page * pageSize;
  return records.slice(start, start + pageSize);
}
