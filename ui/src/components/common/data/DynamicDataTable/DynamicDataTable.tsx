import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import DensityMediumOutlinedIcon from "@mui/icons-material/DensityMediumOutlined";
import CheckIcon from "@mui/icons-material/Check";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import AddIcon from "@mui/icons-material/Add";
import { alpha, type Theme } from "@mui/material/styles";
import {
  DataGrid,
  GridToolbarContainer,
  GridPreferencePanelsValue,
  useGridApiRef,
  type GridColDef,
  type GridPaginationModel,
  type GridRowId,
  type GridRowParams,
  type GridDensity,
} from "@mui/x-data-grid";

const CHECKBOX_FIELD = "__check__";

/** Stable empty selection used when multi-select is disabled (avoids a new model every render) */
const EMPTY_ROW_SELECTION: { type: "include"; ids: Set<GridRowId> } = {
  type: "include",
  ids: new Set<GridRowId>(),
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const getAutoRowHeight = () => "auto" as const;

/** Per-object fallback ids for rows that are not part of the current `rows` array */
const fallbackRowIds = new WeakMap<object, string>();
let fallbackRowIdCounter = 0;

function getFallbackRowId(row: unknown): GridRowId {
  if (!row || typeof row !== "object") return `row-${String(row)}`;
  let id = fallbackRowIds.get(row);
  if (!id) {
    fallbackRowIdCounter += 1;
    id = `row-auto-${fallbackRowIdCounter}`;
    fallbackRowIds.set(row, id);
  }
  return id;
}

export type FilterOperator =
  | "contains"
  | "doesNotContain"
  | "equals"
  | "doesNotEqual"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual";

export interface CustomFilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export type FilterLogic = "and" | "or";

export const FILTER_OPERATORS: { value: FilterOperator; label: string; noValue?: boolean }[] = [
  { value: "contains", label: "contains" },
  { value: "doesNotContain", label: "does not contain" },
  { value: "equals", label: "equals" },
  { value: "doesNotEqual", label: "does not equal" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "isEmpty", label: "is empty", noValue: true },
  { value: "isNotEmpty", label: "is not empty", noValue: true },
  { value: "greaterThan", label: "> (greater than)" },
  { value: "lessThan", label: "< (less than)" },
  { value: "greaterThanOrEqual", label: ">= (greater or equal)" },
  { value: "lessThanOrEqual", label: "<= (less or equal)" },
];

export const isRuleActive = (rule: CustomFilterRule): boolean => {
  if (!rule.field) return false;
  if (rule.operator === "isEmpty" || rule.operator === "isNotEmpty") return true;
  return Boolean(rule.value && rule.value.trim().length > 0);
};

const toTitleCase = (value: unknown): string =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatCellValue = (value: unknown): string => {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();

  if (typeof value === "object") {
    const seen = new WeakSet();
    try {
      return JSON.stringify(value, (key, v) => {
        if (typeof v === "bigint") return v.toString();
        if (v instanceof Date) return v.toISOString();
        if (v && typeof v === "object") {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        return v;
      });
    } catch {
      return String(value);
    }
  }

  return String(value);
};

export function evaluateFilterRule(row: any, rule: CustomFilterRule, columnDef?: GridColDef): boolean {
  if (!rule.field) return true;
  let rawValue = row?.[rule.field];

  if (columnDef && typeof columnDef.valueGetter === "function") {
    try {
      const derived = columnDef.valueGetter(rawValue, row, columnDef, undefined as any);
      if (derived !== undefined) rawValue = derived;
    } catch {
      // fallback
    }
  }

  if (rule.operator === "isEmpty") {
    return (
      rawValue == null ||
      String(rawValue).trim() === "" ||
      (Array.isArray(rawValue) && rawValue.length === 0)
    );
  }
  if (rule.operator === "isNotEmpty") {
    return (
      rawValue != null &&
      String(rawValue).trim() !== "" &&
      (!Array.isArray(rawValue) || rawValue.length > 0)
    );
  }

  const filterVal = (rule.value ?? "").trim();
  if (!filterVal) return true;

  if (rawValue == null) {
    return rule.operator === "doesNotContain" || rule.operator === "doesNotEqual";
  }

  if (
    rule.operator === "greaterThan" ||
    rule.operator === "lessThan" ||
    rule.operator === "greaterThanOrEqual" ||
    rule.operator === "lessThanOrEqual"
  ) {
    const numRaw = Number(rawValue);
    const numFilter = Number(filterVal);
    if (!Number.isNaN(numRaw) && !Number.isNaN(numFilter)) {
      switch (rule.operator) {
        case "greaterThan":
          return numRaw > numFilter;
        case "lessThan":
          return numRaw < numFilter;
        case "greaterThanOrEqual":
          return numRaw >= numFilter;
        case "lessThanOrEqual":
          return numRaw <= numFilter;
      }
    }
  }

  let formattedVal = "";
  if (columnDef && typeof columnDef.valueFormatter === "function") {
    try {
      const res = columnDef.valueFormatter(rawValue, row, columnDef, undefined as any);
      if (res != null) formattedVal = String(res);
    } catch {
      // fallback
    }
  }

  const strRaw = (formattedVal || formatCellValue(rawValue)).toLowerCase();
  const lowerFilter = filterVal.toLowerCase();

  switch (rule.operator) {
    case "contains":
      return strRaw.includes(lowerFilter);
    case "doesNotContain":
      return !strRaw.includes(lowerFilter);
    case "equals":
      return strRaw === lowerFilter;
    case "doesNotEqual":
      return strRaw !== lowerFilter;
    case "startsWith":
      return strRaw.startsWith(lowerFilter);
    case "endsWith":
      return strRaw.endsWith(lowerFilter);
    default:
      return strRaw.includes(lowerFilter);
  }
}

export interface DynamicDataTableProps<TData = any> {
  data?: TData[];
  columns?: GridColDef[];
  allowedColumns?: string[];
  defaultVisibleColumns?: string[];
  pageSizeOptions?: number[];
  initialPageSize?: number;
  getRowId?: (row: TData) => GridRowId;
  onDeleteSelected?: (params: {
    selectedIds: (string | number)[];
    selectedRows: TData[];
    clearSelection: () => void;
  }) => void;
  paginationModel?: GridPaginationModel;
  onPaginationModelChange?: (model: GridPaginationModel) => void;
  paginationMode?: "client" | "server";
  rowCount?: number;
  onRowClick?: (params: GridRowParams, event: React.MouseEvent, details?: any) => void;
  onRowDoubleClick?: (params: GridRowParams, event: React.MouseEvent, details?: any) => void;
  onClick?: (params: GridRowParams, event: React.MouseEvent, details?: any) => void;
  onDoubleClick?: (params: GridRowParams, event: React.MouseEvent, details?: any) => void;
  onContextMenu?: (params: { row: TData } | GridRowParams | null, event: React.MouseEvent, details?: any) => void;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  onNew?: (() => void) | null;
  newLabel?: string;
  title?: string;
  height?: number | string;
  showSelectionBar?: boolean;
  allowMultipleSelect?: boolean;
  loading?: boolean;
  autoRowHeight?: boolean;
  columnVisibilityStorageKey?: string | null;
  onSelectionChange?: (params: {
    selectedIds: (string | number)[];
    selectedRows: TData[];
  }) => void;
  showToolbar?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  showQuickViewTools?: boolean;
  filterRules?: CustomFilterRule[];
  onFilterRulesChange?: (rules: CustomFilterRule[], logic: FilterLogic) => void;
  defaultFilterLogic?: FilterLogic;
}

interface DefaultToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  showDelete?: boolean;
  onNew?: (() => void) | null;
  newLabel?: string;
  onOpenColumns?: () => void;
  onOpenFilters?: (event: React.MouseEvent<HTMLElement>) => void;
  onOpenDensityMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  showQuickViewTools?: boolean;
  activeFilterCount?: number;
}

function DefaultToolbar({
  selectedCount,
  onDelete,
  leftSlot,
  rightSlot,
  showDelete = true,
  onNew,
  newLabel = "+ New",
  onOpenColumns,
  onOpenFilters,
  onOpenDensityMenu,
  showQuickViewTools = true,
  activeFilterCount = 0,
}: DefaultToolbarProps) {
  return (
    <GridToolbarContainer sx={{ px: 1, py: 0.75, width: "100%" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
        {leftSlot ? <Box sx={{ ml: 0.5 }}>{leftSlot}</Box> : null}

        <Box sx={{ flex: 1 }} />

        {showQuickViewTools ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 0.5 }}>
            <Tooltip title="Manage columns" arrow>
              <IconButton size="small" onClick={onOpenColumns} sx={{ color: "text.secondary" }}>
                <ViewColumnOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={activeFilterCount > 0 ? `Filter records (${activeFilterCount} active)` : "Filter records"} arrow>
              <IconButton
                size="small"
                onClick={onOpenFilters}
                sx={{
                  color: activeFilterCount > 0 ? "primary.main" : "text.secondary",
                  bgcolor: activeFilterCount > 0 ? (theme) => alpha(theme.palette.primary.main, 0.1) : "transparent",
                  "&:hover": {
                    bgcolor: activeFilterCount > 0 ? (theme) => alpha(theme.palette.primary.main, 0.18) : undefined,
                  },
                }}
              >
                <Badge
                  badgeContent={activeFilterCount}
                  color="primary"
                  sx={{
                    "& .MuiBadge-badge": {
                      fontSize: "0.65rem",
                      height: 16,
                      minWidth: 16,
                      padding: "0 4px",
                    },
                  }}
                >
                  <FilterAltOutlinedIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Adjust row density" arrow>
              <IconButton size="small" onClick={onOpenDensityMenu} sx={{ color: "text.secondary" }}>
                <DensityMediumOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null}

        {rightSlot ? <Box sx={{ mr: 0.5 }}>{rightSlot}</Box> : null}

        {typeof onNew === "function" ? (
          <Button
            size="small"
            variant="contained"
            onClick={onNew}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              minHeight: 32,
              minWidth: 0,
              px: 1.5,
              borderRadius: 1.25,
              boxShadow: "none",
            }}
          >
            {newLabel || "+ New"}
          </Button>
        ) : null}

        {showDelete ? (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={onDelete}
            disabled={selectedCount === 0}
            sx={{ textTransform: "none" }}
          >
            Delete
          </Button>
        ) : null}
      </Stack>
    </GridToolbarContainer>
  );
}

function DataGridBodyLoadingOverlay() {
  return (
    <Box
      sx={(theme) => ({
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: alpha(theme.palette.background.default, 0.4),
        backdropFilter: "blur(1px)",
      })}
    >
      <CircularProgress size={28} thickness={5} />
    </Box>
  );
}

function DataGridEmptyOverlay({
  title = "No records found",
  description = "No items match your filter criteria.",
  onNew,
  newLabel,
}: {
  title?: string;
  description?: string;
  onNew?: (() => void) | null;
  newLabel?: string;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 6,
        px: 2,
        textAlign: "center",
      }}
    >
      <InboxOutlinedIcon sx={{ fontSize: 42, color: "text.disabled", mb: 1 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary" }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.disabled", maxWidth: 360, mt: 0.5 }}>
        {description}
      </Typography>
      {typeof onNew === "function" ? (
        <Button size="small" variant="outlined" onClick={onNew} sx={{ mt: 2, textTransform: "none" }}>
          {newLabel || "+ New"}
        </Button>
      ) : null}
    </Box>
  );
}

/** DataGrid styling; depends only on the loading flag so it can be memoized */
function buildDataGridSx(loading: boolean) {
  return (theme: Theme) => {
    const thumb = alpha(theme.palette.text.primary, 0.22);
    const thumbHover = alpha(theme.palette.text.primary, 0.32);
    const track = "transparent";
    const border = theme.palette.divider;
    const paper = theme.palette.background.paper;
    const rowSelected = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.28 : 0.12);
    const rowSelectedHover = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.34 : 0.16);
    const scrollbar = {
      scrollbarColor: `${thumb} ${track}`,
      "&::-webkit-scrollbar": { width: 10, height: 10 },
      "&::-webkit-scrollbar-track": { backgroundColor: track },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: thumb,
        borderRadius: 10,
        border: `2px solid ${paper}`,
      },
      "&::-webkit-scrollbar-thumb:hover": { backgroundColor: thumbHover },
    };

    return {
      borderColor: border,
      ...(loading
        ? {
            "& .MuiDataGrid-virtualScrollerContent, & .MuiDataGrid-virtualScrollerRenderZone": {
              filter: "blur(2px)",
              opacity: 0.66,
              transition: "filter 180ms ease, opacity 180ms ease",
            },
            "& .MuiDataGrid-virtualScroller": {
              pointerEvents: "none",
              userSelect: "none",
            },
          }
        : {}),
      "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
        outline: "none",
      },
      "& .MuiDataGrid-columnHeaderTitle": {
        fontWeight: 700,
        textAlign: "left",
      },
      "& .MuiDataGrid-columnHeaderTitleContainer": {
        justifyContent: "flex-start",
      },
      "& .MuiDataGrid-columnHeader": {
        textAlign: "left",
      },
      "& .MuiDataGrid-columnHeaders": { borderBottomColor: border },
      "& .MuiDataGrid-row[aria-selected='true'] .MuiDataGrid-cell": {
        backgroundColor: rowSelected,
      },
      "& .MuiDataGrid-row[aria-selected='true']:hover .MuiDataGrid-cell": {
        backgroundColor: rowSelectedHover,
      },
      "& .MuiDataGrid-cell": { borderBottomColor: border },
      "& .MuiDataGrid-virtualScroller": {
        backgroundColor: paper,
        ...scrollbar,
      },
      "& .MuiDataGrid-scrollbar": scrollbar,
    };
  };
}

const getTogglableGridColumns = (cols: GridColDef[]) =>
  (Array.isArray(cols) ? cols : [])
    .map((c) => c.field)
    .filter((field) => field !== CHECKBOX_FIELD);

/** Module-level slots: an inline component here would remount the overlay every render */
const DATA_GRID_SLOTS = {
  toolbar: DefaultToolbar,
  loadingOverlay: DataGridBodyLoadingOverlay,
  noRowsOverlay: DataGridEmptyOverlay,
} as any;

export default function DynamicDataTable<TData = any>({
  data,
  columns: columnsProp,
  allowedColumns,
  defaultVisibleColumns,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  initialPageSize = 25,
  getRowId,
  onDeleteSelected,
  paginationModel: paginationModelProp,
  onPaginationModelChange,
  paginationMode = "client",
  rowCount,
  onRowClick,
  onRowDoubleClick,
  onClick,
  onDoubleClick,
  onContextMenu,
  toolbarLeft,
  toolbarRight,
  onNew,
  newLabel = "+ New",
  title = "",
  height = 520,
  showSelectionBar = true,
  allowMultipleSelect = true,
  loading = false,
  autoRowHeight = false,
  columnVisibilityStorageKey = null,
  onSelectionChange,
  showToolbar,
  emptyTitle,
  emptyDescription,
  showQuickViewTools = true,
  filterRules: filterRulesProp,
  onFilterRulesChange,
  defaultFilterLogic = "and",
}: DynamicDataTableProps<TData>) {
  const apiRef = useGridApiRef();
  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const allowedSet = useMemo(() => {
    if (!Array.isArray(allowedColumns) || allowedColumns.length === 0) return null;
    return new Set(allowedColumns.map((c) => String(c)));
  }, [allowedColumns]);

  const defaultVisibleSet = useMemo(() => {
    if (!Array.isArray(defaultVisibleColumns) || defaultVisibleColumns.length === 0)
      return null;
    return new Set(defaultVisibleColumns.map((c) => String(c)));
  }, [defaultVisibleColumns]);

  const rows = useMemo(() => {
    return safeData.map((row: any, idx: number) => {
      if (row && typeof row === "object") {
        return row;
      }
      return { value: row, __rowIndex: idx };
    });
  }, [safeData]);

  const columns = useMemo<GridColDef[]>(() => {
    const shouldKeep = (field: string) => {
      const name = String(field || "");
      if (!allowedSet) return true;
      if (name === CHECKBOX_FIELD) return true;
      return allowedSet.has(name);
    };

    const buildGeneratedColumn = (field: string): GridColDef => ({
      field,
      headerName: toTitleCase(field),
      flex: 1,
      minWidth: 140,
      sortable: true,
      filterable: true,
      valueFormatter: (params: any) => formatCellValue(params?.value),
    });

    if (Array.isArray(columnsProp) && columnsProp.length) {
      const base = columnsProp.filter((c) => shouldKeep(c?.field));
      if (!allowedSet) return base;

      const existing = new Set(base.map((c) => String(c?.field || "")).filter(Boolean));
      const extras = Array.from(allowedSet)
        .map((f) => String(f || ""))
        .filter((f) => f && f !== CHECKBOX_FIELD && !existing.has(f))
        .map((f) => buildGeneratedColumn(f));

      return [...base, ...extras];
    }

    const keys = new Set<string>();
    safeData.forEach((row: any) => {
      if (!row || typeof row !== "object") return;
      Object.keys(row).forEach((k) => {
        if (!k.startsWith("__")) keys.add(k);
      });
    });

    return Array.from(keys)
      .filter((field) => shouldKeep(field))
      .map((field) => buildGeneratedColumn(field));
  }, [allowedSet, columnsProp, safeData]);

  const colMap = useMemo(() => {
    const map = new Map<string, GridColDef>();
    columns.forEach((col) => {
      if (col?.field) map.set(col.field, col);
    });
    return map;
  }, [columns]);

  const filterableColumns = useMemo(() => {
    return columns.filter((col) => col.field !== CHECKBOX_FIELD && col.filterable !== false);
  }, [columns]);

  const [internalFilterRules, setInternalFilterRules] = useState<CustomFilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<FilterLogic>(defaultFilterLogic || "and");
  const filterRules = filterRulesProp !== undefined ? filterRulesProp : internalFilterRules;

  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [filterAnchorPosition, setFilterAnchorPosition] = useState<{ top: number; left: number } | null>(null);

  const activeRules = useMemo(() => {
    return filterRules.filter(isRuleActive);
  }, [filterRules]);

  const filteredRows = useMemo(() => {
    if (activeRules.length === 0) return rows;
    return rows.filter((row) => {
      if (filterLogic === "and") {
        return activeRules.every((rule) => evaluateFilterRule(row, rule, colMap.get(rule.field)));
      }
      return activeRules.some((rule) => evaluateFilterRule(row, rule, colMap.get(rule.field)));
    });
  }, [rows, activeRules, filterLogic, colMap]);

  const handleAddRule = (presetField?: string) => {
    const defaultField =
      (typeof presetField === "string" && presetField) ||
      filterableColumns[0]?.field ||
      "";
    const newRule: CustomFilterRule = {
      id: `filter-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      field: defaultField,
      operator: "contains",
      value: "",
    };
    const nextRules = [...filterRules, newRule];
    if (filterRulesProp === undefined) {
      setInternalFilterRules(nextRules);
    }
    onFilterRulesChange?.(nextRules, filterLogic);
  };

  const handleUpdateRule = (id: string, updates: Partial<CustomFilterRule>) => {
    const nextRules = filterRules.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule));
    if (filterRulesProp === undefined) {
      setInternalFilterRules(nextRules);
    }
    onFilterRulesChange?.(nextRules, filterLogic);
  };

  const handleRemoveRule = (id: string) => {
    const nextRules = filterRules.filter((rule) => rule.id !== id);
    if (filterRulesProp === undefined) {
      setInternalFilterRules(nextRules);
    }
    onFilterRulesChange?.(nextRules, filterLogic);
  };

  const handleClearRules = () => {
    if (filterRulesProp === undefined) {
      setInternalFilterRules([]);
    }
    onFilterRulesChange?.([], filterLogic);
  };

  const handleLogicChange = (newLogic: FilterLogic) => {
    setFilterLogic(newLogic);
    onFilterRulesChange?.(filterRules, newLogic);
  };

  const handleOpenFiltersFromToolbar = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorPosition(null);
    setFilterAnchorEl(event.currentTarget);
    if (filterRules.length === 0) {
      handleAddRule();
    }
  };

  // Position of each row object, used as a deterministic fallback id
  const rowIndexByObject = useMemo(() => {
    const map = new WeakMap<object, number>();
    rows.forEach((row: any, idx: number) => {
      if (row && typeof row === "object") map.set(row, idx);
    });
    return map;
  }, [rows]);

  const resolveRowId = useMemo(() => {
    return (row: any): GridRowId => {
      let resolved: any;
      if (typeof getRowId === "function") {
        try {
          resolved = getRowId(row);
        } catch {
          resolved = null;
        }
      }
      if (resolved != null && resolved !== "") return resolved;
      return (
        row?.id ??
        row?._id ??
        row?.uuid ??
        row?.key ??
        (row?.name ? `${row.name}-${row?.version ?? ""}` : null) ??
        row?.__rowIndex ??
        (row && typeof row === "object" && rowIndexByObject.has(row)
          ? `row-${rowIndexByObject.get(row)}`
          : getFallbackRowId(row))
      );
    };
  }, [getRowId, rowIndexByObject]);

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: initialPageSize,
  });

  const [rowSelectionModel, setRowSelectionModel] = useState<{
    type: "include" | "exclude";
    ids: Set<GridRowId>;
  }>(() => ({
    type: "include",
    ids: new Set<GridRowId>(),
  }));

  const [currentDensity, setCurrentDensity] = useState<GridDensity>("standard");
  const [densityAnchorEl, setDensityAnchorEl] = useState<null | HTMLElement>(null);

  const [columnVisibilityModel, setColumnVisibilityModel] = useState<Record<string, boolean>>(() => {
    if (columnVisibilityStorageKey) {
      try {
        const saved = localStorage.getItem(columnVisibilityStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            return { ...parsed, [CHECKBOX_FIELD]: true };
          }
        }
      } catch {
        // ignore corrupted localStorage values
      }
    }
    if (!defaultVisibleSet) return { [CHECKBOX_FIELD]: true };
    const model: Record<string, boolean> = { [CHECKBOX_FIELD]: true };
    columns.forEach((col) => {
      const field = String(col?.field || "");
      if (!field || field === CHECKBOX_FIELD) return;
      model[field] = defaultVisibleSet.has(field);
    });
    return model;
  });

  // Last value persisted per storage key, so unchanged models are not re-written
  const persistedVisibilityRef = useRef<{ key: string; value: string | null } | null>(null);

  useEffect(() => {
    if (!columnVisibilityStorageKey) return;
    try {
      const serialized = JSON.stringify(columnVisibilityModel);
      let persisted = persistedVisibilityRef.current;
      if (!persisted || persisted.key !== columnVisibilityStorageKey) {
        persisted = { key: columnVisibilityStorageKey, value: localStorage.getItem(columnVisibilityStorageKey) };
      }
      if (persisted.value !== serialized) {
        localStorage.setItem(columnVisibilityStorageKey, serialized);
      }
      persistedVisibilityRef.current = { key: columnVisibilityStorageKey, value: serialized };
    } catch {
      // ignore localStorage write errors
    }
  }, [columnVisibilityModel, columnVisibilityStorageKey]);

  useEffect(() => {
    setColumnVisibilityModel((prev) => {
      const next = { ...(prev || {}), [CHECKBOX_FIELD]: true };
      const currentFields = new Set(columns.map((c) => String(c?.field || "")).filter(Boolean));

      Object.keys(next).forEach((field) => {
        if (field === CHECKBOX_FIELD) return;
        if (!currentFields.has(field)) delete next[field];
      });

      columns.forEach((col) => {
        const field = String(col?.field || "");
        if (!field || field === CHECKBOX_FIELD) return;
        if (Object.prototype.hasOwnProperty.call(next, field)) return;

        next[field] = defaultVisibleSet ? defaultVisibleSet.has(field) : true;
      });

      // Keep the previous object when nothing changed to avoid a re-render cascade
      if (prev) {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (
          prevKeys.length === nextKeys.length &&
          nextKeys.every((key) => Object.prototype.hasOwnProperty.call(prev, key) && prev[key] === next[key])
        ) {
          return prev;
        }
      }
      return next;
    });
  }, [columns, defaultVisibleSet]);

  const handlePaginationModelChange = (next: GridPaginationModel) => {
    if (!paginationModelProp) {
      setPaginationModel(next);
    }
    onPaginationModelChange?.(next);
  };
  const resolvedPaginationModel = paginationModelProp || paginationModel;

  useEffect(() => {
    if (activeRules.length > 0 && resolvedPaginationModel.page > 0) {
      if (resolvedPaginationModel.page * resolvedPaginationModel.pageSize >= filteredRows.length) {
        handlePaginationModelChange({ ...resolvedPaginationModel, page: 0 });
      }
    }
  }, [activeRules.length, filteredRows.length]);

  const handleDeleteSelected = () => {
    const ids = rowSelectionModel?.ids;
    if (!ids || ids.size === 0) return;
    const selectedIds = Array.from(ids) as (string | number)[];

    const matchedRows = rows.filter((r) => ids.has(resolveRowId(r)));
    const matchedIdSet = new Set(matchedRows.map((r) => resolveRowId(r)));
    const allSelectedRows = [
      ...matchedRows,
      ...selectedIds
        .filter((id) => !matchedIdSet.has(id))
        .map((id) => ({ id } as any)),
    ];

    const clearSelection = () =>
      setRowSelectionModel({ type: "include", ids: new Set() });

    onDeleteSelected?.({ selectedIds, selectedRows: allSelectedRows, clearSelection });
  };

  const canDelete = allowMultipleSelect && typeof onDeleteSelected === "function";
  const showDeleteInToolbar = canDelete && !showSelectionBar;
  const hasToolbarContent = Boolean(
    toolbarLeft || toolbarRight || showDeleteInToolbar || typeof onNew === "function" || showQuickViewTools
  );
  const shouldRenderToolbar = showToolbar !== undefined ? (showToolbar || Boolean(toolbarLeft || toolbarRight || onNew)) : hasToolbarContent;

  const selectedCount = allowMultipleSelect ? rowSelectionModel?.ids?.size || 0 : 0;
  const handleRowSelectionModelChange = (next: any) => {
    if (!allowMultipleSelect) return;
    let ids = new Set<GridRowId>();
    try {
      ids = new Set(next?.ids || (Array.isArray(next) ? next : []));
    } catch {
      ids = new Set();
    }

    setRowSelectionModel({
      type: next?.type === "exclude" ? "exclude" : "include",
      ids,
    });

    if (typeof onSelectionChange === "function") {
      const selectedIds = Array.from(ids) as (string | number)[];
      const matchedRows = rows.filter((r) => ids.has(resolveRowId(r)));
      const matchedIdSet = new Set(matchedRows.map((r) => resolveRowId(r)));
      const allSelectedRows = [
        ...matchedRows,
        ...selectedIds
          .filter((id) => !matchedIdSet.has(id))
          .map((id) => ({ id } as any)),
      ];
      onSelectionChange({
        selectedIds,
        selectedRows: allSelectedRows,
      });
    }
  };

  const [headerMenu, setHeaderMenu] = useState<{
    mouseX: number;
    mouseY: number;
    field?: string;
  } | null>(null);

  const closeHeaderMenu = () => setHeaderMenu(null);
  const openHeaderMenu = (event: React.MouseEvent, field?: string) => {
    event.preventDefault();
    event.stopPropagation();
    setHeaderMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      field,
    });
  };

  const handleOpenFiltersFromHeader = () => {
    const targetField = headerMenu?.field;
    const coords = headerMenu ? { top: headerMenu.mouseY, left: headerMenu.mouseX } : null;
    closeHeaderMenu();

    if (filterRules.length === 0) {
      handleAddRule(targetField);
    }

    setFilterAnchorEl(null);
    if (coords) {
      setFilterAnchorPosition(coords);
    }
  };

  const showPreferences = (panel: GridPreferencePanelsValue) => {
    apiRef.current?.showPreferences?.(panel);
    closeHeaderMenu();
  };

  const setDensity = (density: GridDensity) => {
    setCurrentDensity(density);
    apiRef.current?.setDensity?.(density);
    setDensityAnchorEl(null);
    closeHeaderMenu();
  };

  const resolvedOnClick = onClick || onRowClick;
  const resolvedOnDoubleClick = onDoubleClick || onRowDoubleClick;
  const resolvedOnContextMenu = onContextMenu;

  // Latest-handler refs so the memoized grid slotProps keep stable callbacks
  const handleDeleteSelectedRef = useRef(handleDeleteSelected);
  handleDeleteSelectedRef.current = handleDeleteSelected;
  const handleOpenFiltersRef = useRef(handleOpenFiltersFromToolbar);
  handleOpenFiltersRef.current = handleOpenFiltersFromToolbar;

  const stableDeleteSelected = useCallback(() => handleDeleteSelectedRef.current(), []);
  const stableOpenFilters = useCallback(
    (event: React.MouseEvent<HTMLElement>) => handleOpenFiltersRef.current(event),
    []
  );
  const stableOpenColumns = useCallback(
    () => apiRef.current?.showPreferences?.(GridPreferencePanelsValue.columns),
    [apiRef]
  );
  const stableOpenDensityMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setDensityAnchorEl(e.currentTarget),
    []
  );

  const activeFilterCount = activeRules.length;
  const gridSlotProps = useMemo(
    () => ({
      toolbar: {
        selectedCount,
        onDelete: stableDeleteSelected,
        leftSlot: toolbarLeft,
        rightSlot: toolbarRight,
        showDelete: showDeleteInToolbar,
        onNew,
        newLabel,
        onOpenColumns: stableOpenColumns,
        onOpenFilters: stableOpenFilters,
        onOpenDensityMenu: stableOpenDensityMenu,
        showQuickViewTools,
        activeFilterCount,
      },
      noRowsOverlay: {
        title: emptyTitle,
        description: emptyDescription,
        onNew,
        newLabel,
      },
      columnsManagement: {
        getTogglableColumns: getTogglableGridColumns,
      },
    }),
    [
      selectedCount,
      stableDeleteSelected,
      toolbarLeft,
      toolbarRight,
      showDeleteInToolbar,
      onNew,
      newLabel,
      stableOpenColumns,
      stableOpenFilters,
      stableOpenDensityMenu,
      showQuickViewTools,
      activeFilterCount,
      emptyTitle,
      emptyDescription,
    ]
  );

  const gridSx = useMemo(() => buildDataGridSx(Boolean(loading)), [loading]);

  return (
    <Box sx={{ width: "100%" }}>
      {title ? (
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 800 }}>
          {title}
        </Typography>
      ) : null}

      <Collapse
        in={Boolean(canDelete && showSelectionBar && selectedCount > 0)}
        timeout={180}
      >
        <Box
          sx={(theme) => ({
            mb: 1,
            borderRadius: 2,
            border: `1px solid ${
              theme.palette.mode === "dark"
                ? "rgba(56, 139, 253, 0.4)"
                : "rgba(31, 111, 235, 0.3)"
            }`,
            backgroundColor: alpha(
              theme.palette.primary.main,
              theme.palette.mode === "dark" ? 0.12 : 0.06
            ),
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          })}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ px: 1.5, py: 0.75 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
              {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
            </Typography>

            <Box sx={{ flex: 1 }} />

            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleDeleteSelected}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Delete Selected
            </Button>

            <IconButton
              size="small"
              aria-label="Clear selection"
              onClick={() => setRowSelectionModel({ type: "include", ids: new Set() })}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Collapse>

      <Menu
        open={Boolean(headerMenu)}
        onClose={closeHeaderMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          headerMenu ? { top: headerMenu.mouseY, left: headerMenu.mouseX } : undefined
        }
        disableAutoFocusItem
      >
        <MenuItem onClick={() => showPreferences(GridPreferencePanelsValue.columns)}>
          <ListItemIcon>
            <ViewColumnOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Manage columns</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenFiltersFromHeader}>
          <ListItemIcon>
            <FilterAltOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Filters</ListItemText>
        </MenuItem>
        <MenuItem disabled sx={{ opacity: "0.85 !important", fontWeight: 700, fontSize: "0.75rem" }}>
          <ListItemIcon>
            <DensityMediumOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>DENSITY</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => setDensity("compact")} sx={{ pl: 4 }}>
          <ListItemText>Compact</ListItemText>
          {currentDensity === "compact" ? <CheckIcon fontSize="small" sx={{ ml: 1, color: "primary.main" }} /> : null}
        </MenuItem>
        <MenuItem onClick={() => setDensity("standard")} sx={{ pl: 4 }}>
          <ListItemText>Standard</ListItemText>
          {currentDensity === "standard" ? <CheckIcon fontSize="small" sx={{ ml: 1, color: "primary.main" }} /> : null}
        </MenuItem>
        <MenuItem onClick={() => setDensity("comfortable")} sx={{ pl: 4 }}>
          <ListItemText>Comfortable</ListItemText>
          {currentDensity === "comfortable" ? <CheckIcon fontSize="small" sx={{ ml: 1, color: "primary.main" }} /> : null}
        </MenuItem>
      </Menu>

      <Menu
        open={Boolean(densityAnchorEl)}
        anchorEl={densityAnchorEl}
        onClose={() => setDensityAnchorEl(null)}
      >
        <MenuItem onClick={() => setDensity("compact")}>
          <ListItemText>Compact</ListItemText>
          {currentDensity === "compact" ? <CheckIcon fontSize="small" sx={{ ml: 2, color: "primary.main" }} /> : null}
        </MenuItem>
        <MenuItem onClick={() => setDensity("standard")}>
          <ListItemText>Standard</ListItemText>
          {currentDensity === "standard" ? <CheckIcon fontSize="small" sx={{ ml: 2, color: "primary.main" }} /> : null}
        </MenuItem>
        <MenuItem onClick={() => setDensity("comfortable")}>
          <ListItemText>Comfortable</ListItemText>
          {currentDensity === "comfortable" ? <CheckIcon fontSize="small" sx={{ ml: 2, color: "primary.main" }} /> : null}
        </MenuItem>
      </Menu>

      <Popover
        open={Boolean(filterAnchorEl || filterAnchorPosition)}
        anchorEl={filterAnchorEl}
        anchorReference={filterAnchorPosition ? "anchorPosition" : "anchorEl"}
        anchorPosition={filterAnchorPosition || undefined}
        onClose={() => {
          setFilterAnchorEl(null);
          setFilterAnchorPosition(null);
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              width: 580,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: 520,
              display: "flex",
              flexDirection: "column",
              borderRadius: 2.5,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? "0 16px 40px rgba(0, 0, 0, 0.65)"
                  : "0 12px 32px rgba(0, 0, 0, 0.12)",
              overflow: "hidden",
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? alpha(theme.palette.background.default, 0.6)
                : alpha(theme.palette.grey[50], 0.8),
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Filter Records
            </Typography>
            {activeRules.length > 0 ? (
              <Chip
                size="small"
                label={`${activeRules.length} active`}
                color="primary"
                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600 }}
              />
            ) : null}
          </Stack>

          <IconButton
            size="small"
            onClick={() => {
              setFilterAnchorEl(null);
              setFilterAnchorPosition(null);
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {filterRules.length > 1 ? (
          <Box
            sx={{
              px: 2,
              py: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
              Match condition:
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filterLogic}
              onChange={(_, next) => {
                if (next) handleLogicChange(next);
              }}
              sx={{
                height: 28,
                "& .MuiToggleButton-root": {
                  px: 1.5,
                  py: 0.25,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "none",
                },
              }}
            >
              <ToggleButton value="and">All (AND)</ToggleButton>
              <ToggleButton value="or">Any (OR)</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        ) : null}

        <Box
          sx={{
            p: 2,
            flex: 1,
            minHeight: 120,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          {filterRules.length === 0 ? (
            <Box
              sx={{
                py: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
                textAlign: "center",
              }}
            >
              <FilterAltOutlinedIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                No filters applied
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 280, mb: 2 }}>
                Add one or more filter rules to refine table records across any column.
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleAddRule()}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Add filter rule
              </Button>
            </Box>
          ) : (
            filterRules.map((rule, index) => {
              const opDef = FILTER_OPERATORS.find((o) => o.value === rule.operator);
              const isNoValue = Boolean(opDef?.noValue);

              return (
                <Box
                  key={rule.id}
                  sx={(theme) => ({
                    p: 1.25,
                    borderRadius: 1.75,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.background.paper, 0.4)
                        : alpha(theme.palette.grey[50], 0.6),
                    transition: "border-color 0.2s ease, background-color 0.2s ease",
                    "&:hover": {
                      borderColor: alpha(theme.palette.primary.main, 0.4),
                    },
                  })}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 48,
                        flexShrink: 0,
                        textAlign: "center",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "primary.main",
                        textTransform: "uppercase",
                      }}
                    >
                      {index === 0 ? "Where" : filterLogic.toUpperCase()}
                    </Box>

                    {/* Column Select */}
                    <FormControl size="small" sx={{ minWidth: 140, flex: 1.2 }}>
                      <Select
                        value={rule.field}
                        onChange={(e) => handleUpdateRule(rule.id, { field: e.target.value })}
                        sx={{ fontSize: "0.82rem" }}
                      >
                        {filterableColumns.map((col) => (
                          <MenuItem key={col.field} value={col.field} sx={{ fontSize: "0.82rem" }}>
                            {col.headerName || toTitleCase(col.field)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Operator Select */}
                    <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
                      <Select
                        value={rule.operator}
                        onChange={(e) => handleUpdateRule(rule.id, { operator: e.target.value as FilterOperator })}
                        sx={{ fontSize: "0.82rem" }}
                      >
                        {FILTER_OPERATORS.map((op) => (
                          <MenuItem key={op.value} value={op.value} sx={{ fontSize: "0.82rem" }}>
                            {op.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Value Field */}
                    {isNoValue ? (
                      <Box
                        sx={{
                          flex: 1.4,
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          px: 1.5,
                          borderRadius: 1,
                          bgcolor: (theme) => alpha(theme.palette.action.disabledBackground, 0.3),
                          color: "text.disabled",
                          fontSize: "0.78rem",
                          fontStyle: "italic",
                        }}
                      >
                        No value needed
                      </Box>
                    ) : (
                      <TextField
                        size="small"
                        placeholder="Value..."
                        value={rule.value}
                        onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                        autoFocus={index === filterRules.length - 1 && !rule.value}
                        sx={{
                          flex: 1.4,
                          "& .MuiInputBase-input": {
                            fontSize: "0.82rem",
                            py: "8.5px",
                          },
                        }}
                      />
                    )}

                    {/* Delete rule button */}
                    <Tooltip title="Remove rule" arrow>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveRule(rule.id)}
                        sx={{
                          color: "text.secondary",
                          "&:hover": { color: "error.main" },
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>

        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? alpha(theme.palette.background.default, 0.4)
                : alpha(theme.palette.grey[50], 0.5),
          }}
        >
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleAddRule()}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Add filter
            </Button>
            {filterRules.length > 0 ? (
              <Button
                size="small"
                color="inherit"
                onClick={handleClearRules}
                sx={{ textTransform: "none", color: "text.secondary" }}
              >
                Clear all
              </Button>
            ) : null}
          </Stack>

          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setFilterAnchorEl(null);
              setFilterAnchorPosition(null);
            }}
            sx={{ textTransform: "none", fontWeight: 600, px: 2 }}
          >
            Done
          </Button>
        </Box>
      </Popover>

      <Box sx={{ height, width: "100%", display: "flex", flexDirection: "column" }}>
        {activeRules.length > 0 ? (
          <Box
            sx={(theme) => ({
              px: 1.5,
              py: 0.75,
              mb: 0.75,
              borderRadius: 1.5,
              border: `1px solid ${
                theme.palette.mode === "dark"
                  ? "rgba(56, 139, 253, 0.3)"
                  : "rgba(31, 111, 235, 0.2)"
              }`,
              backgroundColor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === "dark" ? 0.08 : 0.04
              ),
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
              flexShrink: 0,
            })}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <FilterAltOutlinedIcon sx={{ fontSize: 16, color: "primary.main" }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Active Filters ({activeRules.length}):
              </Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ flex: 1 }}
            >
              {activeRules.map((rule, idx) => {
                const col = colMap.get(rule.field);
                const colName = col?.headerName || toTitleCase(rule.field);
                const op = FILTER_OPERATORS.find((o) => o.value === rule.operator);
                const opLabel = op?.label || rule.operator;
                const hasVal = !op?.noValue && Boolean(rule.value);

                return (
                  <React.Fragment key={rule.id}>
                    {idx > 0 ? (
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.68rem",
                          color: "primary.main",
                          px: 0.6,
                          py: 0.15,
                          borderRadius: 0.75,
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                          lineHeight: 1.2,
                        }}
                      >
                        {filterLogic.toUpperCase()}
                      </Typography>
                    ) : null}

                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        <Box component="span" sx={{ fontSize: "0.78rem" }}>
                          <Box component="span" sx={{ fontWeight: 600 }}>
                            {colName}
                          </Box>{" "}
                          <Box component="span" sx={{ color: "text.secondary" }}>
                            {opLabel}
                          </Box>
                          {hasVal ? (
                            <>
                              {" "}
                              <Box
                                component="span"
                                sx={{ fontWeight: 600, color: "primary.main" }}
                              >
                                "{rule.value}"
                              </Box>
                            </>
                          ) : null}
                        </Box>
                      }
                      onDelete={() => handleRemoveRule(rule.id)}
                      onClick={(e) => {
                        setFilterAnchorPosition(null);
                        setFilterAnchorEl(e.currentTarget);
                      }}
                      sx={{
                        height: 26,
                        borderRadius: 1.25,
                        borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                        "&:hover": {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                        },
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center">
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: "0.9rem !important" }} />}
                onClick={(e) => {
                  handleAddRule();
                  setFilterAnchorPosition(null);
                  setFilterAnchorEl(e.currentTarget);
                }}
                sx={{
                  textTransform: "none",
                  fontSize: "0.75rem",
                  py: 0.25,
                  px: 0.75,
                  minWidth: 0,
                }}
              >
                Add filter
              </Button>
              <Button
                size="small"
                onClick={(e) => {
                  setFilterAnchorPosition(null);
                  setFilterAnchorEl(e.currentTarget);
                }}
                sx={{
                  textTransform: "none",
                  fontSize: "0.75rem",
                  py: 0.25,
                  px: 0.75,
                  minWidth: 0,
                }}
              >
                Edit
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={handleClearRules}
                sx={{
                  textTransform: "none",
                  fontSize: "0.75rem",
                  py: 0.25,
                  px: 0.75,
                  minWidth: 0,
                  color: "text.secondary",
                }}
              >
                Clear all
              </Button>
            </Stack>
          </Box>
        ) : null}

        <Box sx={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
          <DataGrid
            apiRef={apiRef}
            rows={filteredRows}
            columns={columns}
            showToolbar={shouldRenderToolbar}
            getRowId={resolveRowId}
            checkboxSelection={allowMultipleSelect}
            disableRowSelectionOnClick={Boolean(allowMultipleSelect)}
            disableColumnMenu
            rowSelection={allowMultipleSelect}
            pagination
            paginationModel={resolvedPaginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            paginationMode={paginationMode}
            rowCount={
              paginationMode === "server"
                ? activeRules.length === 0
                  ? rowCount
                  : filteredRows.length
                : undefined
            }
            pageSizeOptions={pageSizeOptions}
            rowSelectionModel={
              allowMultipleSelect ? rowSelectionModel : EMPTY_ROW_SELECTION
            }
            onRowSelectionModelChange={handleRowSelectionModelChange}
            onRowClick={(params, event, details) => {
              resolvedOnClick?.(params, event, details);
            }}
            onRowDoubleClick={(params, event, details) => {
              resolvedOnDoubleClick?.(params, event, details);
            }}
            onRowContextMenu={(params, event, details) => {
              if (resolvedOnContextMenu) {
                event.preventDefault();
                resolvedOnContextMenu(params, event, details);
              }
            }}
            onCellContextMenu={(params, event, details) => {
              if (resolvedOnContextMenu) {
                event.preventDefault();
                resolvedOnContextMenu(params as any, event, details);
              }
            }}
            onCellKeyDown={(_, event) => {
              if (event.key !== "Delete") return;
              if (!canDelete || selectedCount === 0) return;
              event.preventDefault();
              event.stopPropagation();
              handleDeleteSelected();
            }}
            onColumnHeaderContextMenu={(params, event) => openHeaderMenu(event, params?.field)}
            getRowHeight={autoRowHeight ? getAutoRowHeight : undefined}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={(next) => {
              setColumnVisibilityModel({
                ...(next || {}),
                [CHECKBOX_FIELD]: true,
              });
            }}
            slots={DATA_GRID_SLOTS}
            slotProps={gridSlotProps as any}
            loading={loading}
            sx={gridSx}
          />
        </Box>
      </Box>
    </Box>
  );
}
