import type { ReactNode, CSSProperties } from "react";
import type {
  WeaverSort,
  WeaverPaginationModel,
  WeaverDataAction,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";

/**
 * Column definition for WeaverRelatedTable.
 */
export interface WeaverRelatedTableColumn<TRecord> {
  /** Unique key identifying the column field */
  key: string;

  /** Header title or element */
  label: ReactNode;

  /** Accessor function to extract raw value from record */
  getValue?: (record: TRecord) => unknown;

  /** Custom cell render function */
  render?: (record: TRecord, value?: unknown) => ReactNode;

  /** Whether the column can be sorted (default: false) */
  sortable?: boolean;

  /** Whether the column is searchable in client-side search (default: true) */
  searchable?: boolean;

  /** Fixed or preferred column width */
  width?: number | string;

  /** Minimum column width */
  minWidth?: number | string;

  /** Column text alignment */
  align?: "start" | "center" | "end" | "left" | "right";
}

/**
 * Section-level primary action configuration.
 */
export interface WeaverRelatedTablePrimaryAction<TRecord = unknown> {
  id?: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

/**
 * Properties for WeaverRelatedTable.
 */
export interface WeaverRelatedTableProps<TRecord> {
  /** Array of records to display */
  records: TRecord[];

  /** Column definitions */
  columns: WeaverRelatedTableColumn<TRecord>[];

  /** Function extracting unique string/number ID from record */
  getRecordId: (record: TRecord) => string | number;

  /** Execution mode for search, sorting, and pagination (default: "client") */
  dataMode?: "client" | "server";

  /** Indicates an async request is in flight */
  loading?: boolean;

  /** Inline error message displayed within the table card */
  errorMessage?: string;

  /** Whether client search is enabled */
  searchable?: boolean;

  /** Controlled search text */
  searchValue?: string;

  /** Uncontrolled initial search text */
  defaultSearchValue?: string;

  /** Search change callback */
  onSearchChange?: (value: string) => void;

  /** Placeholder for search field (default: "Search records...") */
  searchPlaceholder?: string;

  /** Debounce delay for search in milliseconds (default: 250) */
  searchDebounceMs?: number;

  /** Controlled sort model */
  sortModel?: WeaverSort[];

  /** Uncontrolled initial sort model */
  defaultSortModel?: WeaverSort[];

  /** Sort change callback */
  onSortChange?: (sort: WeaverSort[]) => void;

  /** Whether pagination is enabled (default: true) */
  pagination?: boolean;

  /** Controlled pagination model */
  paginationModel?: WeaverPaginationModel;

  /** Uncontrolled initial pagination model */
  defaultPaginationModel?: WeaverPaginationModel;

  /** Pagination change callback */
  onPaginationChange?: (pagination: WeaverPaginationModel) => void;

  /** Total records count (mandatory in server mode) */
  totalRecords?: number;

  /** Selectable page size options (default: [5, 10, 25]) */
  pageSizeOptions?: number[];

  /** Record selection mode (default: "none") */
  selectionMode?: "none" | "single" | "multiple";

  /** Controlled selected record IDs */
  selectedIds?: Array<string | number>;

  /** Uncontrolled initial selected record IDs */
  defaultSelectedIds?: Array<string | number>;

  /** Selection change callback */
  onSelectionChange?: (
    ids: Array<string | number>,
    records: TRecord[]
  ) => void;

  /** Row click handler */
  onRowClick?: (record: TRecord) => void;

  /** Actions available per individual row via 3-dot menu */
  rowActions?: WeaverDataAction<TRecord>[];

  /** Actions available when one or more rows are selected */
  bulkActions?: WeaverDataAction<TRecord>[];

  /** Section-level primary action button (e.g. "+ Add Query") */
  primaryAction?: WeaverRelatedTablePrimaryAction<TRecord> | WeaverDataAction<TRecord>;

  /** Generic slot for custom filters or controls */
  filterContent?: ReactNode;

  /** Generic slot for additional toolbar elements */
  toolbarContent?: ReactNode;

  /** Custom empty state element */
  emptyState?: ReactNode;

  /** Custom message when search yields no matches */
  emptySearchMessage?: string;

  /** Maximum container height enabling internal vertical scrolling */
  maxHeight?: number | string;

  /** Whether table header stays fixed when scrolling (default: true if maxHeight is set) */
  stickyHeader?: boolean;

  /** Custom CSS class */
  className?: string;

  /** Custom inline styles */
  style?: CSSProperties;
}
