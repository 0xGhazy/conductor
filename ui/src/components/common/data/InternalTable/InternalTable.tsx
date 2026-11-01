import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

export interface InternalTableCellParams {
  value: unknown;
  row: Record<string, unknown>;
  field: string;
}

export interface InternalTableColumn {
  field: string;
  headerName?: string;
  minWidth?: number;
  flex?: number;
  valueFormatter?: ((params: InternalTableCellParams) => unknown) | null;
  renderCell?: (params: InternalTableCellParams) => ReactNode;
}

export interface InternalTableProps {
  data?: unknown[];
  columns?: InternalTableColumn[] | null;
  getRowId?: ((row: Record<string, any>) => string | number) | null;
  height?: string | number;
  loading?: boolean;
  onRowDoubleClick?: (params: { id: string; row: Record<string, any> }) => void;
}

const toTitleCase = (value: unknown) =>
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
      return JSON.stringify(value, (_key, v) => {
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

const buildColumns = (data: unknown[], columnsProp?: InternalTableColumn[] | null): InternalTableColumn[] => {
  if (Array.isArray(columnsProp) && columnsProp.length) {
    return columnsProp.map((column) => ({
      ...column,
      field: String(column?.field || ""),
      headerName: column?.headerName || toTitleCase(column?.field),
      minWidth: column?.minWidth ?? 140,
      flex: column?.flex ?? 1,
      valueFormatter: column?.valueFormatter ?? null,
    }));
  }

  const keys = new Set<string>();
  (Array.isArray(data) ? data : []).forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.keys(row).forEach((key) => keys.add(key));
  });

  return Array.from(keys).map((field) => ({
    field,
    headerName: toTitleCase(field),
    minWidth: 140,
    flex: 1,
    valueFormatter: null,
  }));
};

const resolveColumnWidth = (column: InternalTableColumn) => {
  const minWidth = Number(column?.minWidth ?? 140);
  const flex = Number(column?.flex ?? 1);
  return Math.max(minWidth, Math.round(minWidth * Math.max(flex, 1)));
};

export default function InternalTable({
  data = [],
  columns = null,
  getRowId = null,
  height = 300,
  loading = false,
  onRowDoubleClick,
}: InternalTableProps) {
  const safeData = Array.isArray(data) ? data : [];
  const resolvedColumns = buildColumns(safeData, columns).filter((column) => column.field);

  const rows = safeData.map((row, idx) => {
    const safeRow: Record<string, any> = row && typeof row === "object" ? row : { value: row };
    const rowId =
      typeof getRowId === "function"
        ? getRowId(safeRow)
        : safeRow?.id ??
          safeRow?._id ??
          safeRow?.uuid ??
          safeRow?.key ??
          `${safeRow?.name ?? "row"}-${safeRow?.version ?? ""}-${idx}`;

    return {
      ...safeRow,
      __internalRowId: String(rowId ?? `row-${idx}`),
    };
  });

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={(theme) => {
        const thumb = alpha(theme.palette.text.primary, 0.22);
        const thumbHover = alpha(theme.palette.text.primary, 0.32);
        const track = "transparent";
        const paper = theme.palette.background.paper;
        return {
          width: "100%",
          height,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: paper,
          overflow: "auto",
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
      }}
    >
      <Table stickyHeader size="small" sx={{ minWidth: 720, tableLayout: "fixed" }}>
        <TableHead>
          <TableRow>
            {resolvedColumns.map((column) => (
              <TableCell
                key={column.field}
                align="left"
                sx={(theme) => ({
                  fontWeight: 700,
                  textAlign: "left",
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.default,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  width: `${resolveColumnWidth(column)}px`,
                  minWidth: column?.minWidth ?? 140,
                })}
              >
                {column.headerName}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={Math.max(resolvedColumns.length, 1)} sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Loading...
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}

          {!loading && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={Math.max(resolvedColumns.length, 1)} sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No data
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}

          {!loading &&
            rows.map((row) => (
              <TableRow
                key={row.__internalRowId}
                hover
                onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick({ id: row.__internalRowId, row }) : undefined}
                sx={(theme) => ({
                  "& td": {
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  },
                })}
              >
                {resolvedColumns.map((column) => {
                  const rawValue = row?.[column.field];
                  const params = { value: rawValue, row, field: column.field };
                  const customCell =
                    typeof column?.renderCell === "function"
                      ? column.renderCell(params)
                      : null;
                  const hasCustomCell = customCell !== null && customCell !== undefined;
                  const value = column?.valueFormatter
                    ? column.valueFormatter(params)
                    : formatCellValue(rawValue);
                  const text = value == null ? "-" : String(value);

                  return (
                    <TableCell
                      key={`${row.__internalRowId}-${column.field}`}
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={hasCustomCell ? undefined : text}
                    >
                      {hasCustomCell ? customCell : text}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
