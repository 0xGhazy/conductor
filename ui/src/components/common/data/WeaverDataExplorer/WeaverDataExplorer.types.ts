import type { ReactNode } from "react";

export type WeaverDataView = "table" | "canvas";

export type WeaverFilterOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  | "before"
  | "after"
  | "beforeOrEqual"
  | "afterOrEqual"
  | "in"
  | "notIn";

export interface WeaverFilter {
  id: string;
  field: string;
  operator: WeaverFilterOperator;
  value?: unknown;
}

export interface WeaverFilterModel {
  logic: "AND" | "OR";
  filters: WeaverFilter[];
}

export type WeaverSortDirection = "asc" | "desc";

export interface WeaverSort {
  field: string;
  direction: WeaverSortDirection;
}

export interface WeaverPaginationModel {
  page: number; // 0-indexed
  pageSize: number;
}

export type WeaverDataFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "custom";

export interface WeaverDataField<TRecord> {
  key: string;
  label: string;
  getValue: (record: TRecord) => unknown;
  render?: (value: unknown, record: TRecord) => ReactNode;
  type?: WeaverDataFieldType;
  visibleByDefault?: boolean;
  hideable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  width?: number | string;
  options?: Array<{ label: string; value: unknown }>; // for enum fields
}

export interface WeaverCanvasContentContext<TRecord> {
  visibleFields: WeaverDataField<TRecord>[];
  visibleFieldKeys: string[];
}

export interface WeaverCanvasConfig<TRecord> {
  getTitle?: (record: TRecord) => ReactNode;
  renderIcon?: (record: TRecord) => ReactNode;
  renderStatus?: (record: TRecord) => ReactNode;
  renderContent?: (
    record: TRecord,
    context?: WeaverCanvasContentContext<TRecord>
  ) => ReactNode;
  quickActions?: WeaverDataAction<TRecord>[];
  renderQuickActions?: (record: TRecord) => ReactNode;
  iconColor?: string;
  getIconColor?: (record: TRecord) => string;
}

export interface WeaverCanvasItemContext<TRecord> {
  isSelected: boolean;
  onToggleSelect: () => void;
  visibleFields: WeaverDataField<TRecord>[];
  rowActions?: WeaverDataAction<TRecord>[];
  quickActions?: WeaverDataAction<TRecord>[];
}

export interface WeaverDataActionContext<TRecord = unknown> {
  record?: TRecord;
  selectedIds?: Array<string | number>;
  selectedRecords?: TRecord[];
}

export interface WeaverDataAction<TRecord = unknown> {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean | ((record?: TRecord) => boolean);
  hidden?: boolean | ((record?: TRecord) => boolean);
  danger?: boolean;
  asButton?: boolean;
  buttonVariant?: "contained" | "outlined" | "text";
  buttonColor?: "primary" | "secondary" | "inherit";
  onClick: (context: WeaverDataActionContext<TRecord>) => void | Promise<void>;
}

export interface WeaverDataExplorerProps<TRecord> {
  records: TRecord[];
  getRecordId: (record: TRecord) => string | number;
  fields: WeaverDataField<TRecord>[];

  // Persistence
  storageKey?: string;

  // View
  view?: WeaverDataView;
  defaultView?: WeaverDataView;
  onViewChange?: (view: WeaverDataView) => void;

  // Structured Canvas Configuration
  canvas?: WeaverCanvasConfig<TRecord>;
  renderCanvasIcon?: (record: TRecord) => ReactNode;
  renderCanvasStatus?: (record: TRecord) => ReactNode;
  getCanvasTitle?: (record: TRecord) => ReactNode;
  renderCanvasContent?: (
    record: TRecord,
    context?: WeaverCanvasContentContext<TRecord>
  ) => ReactNode;
  canvasQuickActions?: WeaverDataAction<TRecord>[];
  renderCanvasQuickActions?: (record: TRecord) => ReactNode;

  // Custom Full Canvas Item Renderer Override (if custom shell needed)
  renderCanvasItem?: (
    record: TRecord,
    context: WeaverCanvasItemContext<TRecord>
  ) => ReactNode;

  // Record Click
  onRecordClick?: (record: TRecord) => void;

  // Field visibility
  visibleFields?: string[];
  defaultVisibleFields?: string[];
  onVisibleFieldsChange?: (fields: string[]) => void;

  // Search
  searchable?: boolean;
  searchValue?: string;
  defaultSearchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchDebounceMs?: number;

  // Filtering
  filterModel?: WeaverFilterModel;
  defaultFilterModel?: WeaverFilterModel;
  onFilterChange?: (model: WeaverFilterModel) => void;

  // Sorting
  sortModel?: WeaverSort[];
  defaultSortModel?: WeaverSort[];
  onSortChange?: (sort: WeaverSort[]) => void;

  // Pagination
  pagination?: boolean;
  paginationModel?: WeaverPaginationModel;
  defaultPaginationModel?: WeaverPaginationModel;
  onPaginationChange?: (model: WeaverPaginationModel) => void;
  pageSizeOptions?: number[];
  totalRecords?: number;

  // Data Mode
  dataMode?: "client" | "server";

  // Selection
  selectionMode?: "none" | "single" | "multiple";
  selectedIds?: Array<string | number>;
  defaultSelectedIds?: Array<string | number>;
  onSelectionChange?: (
    ids: Array<string | number>,
    records: TRecord[]
  ) => void;

  // Actions
  toolbarActions?: WeaverDataAction<TRecord>[];
  rowActions?: WeaverDataAction<TRecord>[];
  bulkActions?: WeaverDataAction<TRecord>[];

  // States
  loading?: boolean;
  emptyState?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  errorMessage?: string;
  errorState?: ReactNode;

  // Styling & Customization
  className?: string;
  height?: number | string;
  stickyHeader?: boolean;
}
