import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Collapse,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TableChartIcon from "@mui/icons-material/TableChart";
import DataObjectIcon from "@mui/icons-material/DataObject";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloseIcon from "@mui/icons-material/Close";
import NumbersIcon from "@mui/icons-material/Numbers";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import CheckIcon from "@mui/icons-material/Check";
import CodeIcon from "@mui/icons-material/Code";
import { WeaverCodeEditor } from "@/components/common/editors";
import type { QueryExecutionResult } from "@/features/queries/types/queryTypes";

/** Rows rendered per page in the table view (client-side pagination). */
const ROWS_PER_PAGE = 100;

interface QueryResultsViewProps {
  result: QueryExecutionResult | null;
  resultError?: string;
  onClose?: () => void;
}

interface JsonFieldInfo {
  key: string;
  value: unknown;
  isArray: boolean;
  itemCount: number;
}

/**
 * Checks if a value is a JSON object/array or a JSON string.
 */
function parseJsonValue(value: unknown): { isJson: boolean; parsed: unknown } {
  if (value === null || value === undefined) {
    return { isJson: false, parsed: null };
  }
  if (typeof value === "object") {
    return { isJson: true, parsed: value };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null) {
          return { isJson: true, parsed };
        }
      } catch {
        // Not valid JSON string
      }
    }
  }
  return { isJson: false, parsed: value };
}

/**
 * Extracts all JSON fields from a row object.
 */
function extractRowJsonFields(row: Record<string, unknown>): JsonFieldInfo[] {
  if (!row || typeof row !== "object") return [];
  const jsonFields: JsonFieldInfo[] = [];

  Object.entries(row).forEach(([key, rawValue]) => {
    const { isJson, parsed } = parseJsonValue(rawValue);
    if (isJson && parsed !== null && typeof parsed === "object") {
      const isArr = Array.isArray(parsed);
      const count = isArr ? parsed.length : Object.keys(parsed).length;
      jsonFields.push({
        key,
        value: parsed,
        isArray: isArr,
        itemCount: count,
      });
    }
  });

  return jsonFields;
}

function buildFormattedJson(result: QueryExecutionResult | null, resultError: string) {
  if (!result && !resultError) return "{}";
  try {
    const dataToFormat = result?.resultSet ?? result ?? { error: resultError };
    return JSON.stringify(dataToFormat, null, 2);
  } catch {
    return String(result);
  }
}

export default function QueryResultsView({
  result,
  resultError = "",
  onClose,
}: QueryResultsViewProps) {
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Extract structured values
  const status = String(result?.status ?? (resultError ? "FAILED" : "SUCCESS")).toUpperCase();
  const isFailed = status === "FAILED" || Boolean(resultError);
  const duration = result?.duration ?? null;
  const affectedRows = result?.affectedRows;
  const size = result?.size;
  const reason = result?.reason ? String(result.reason) : resultError;
  const errorCode = result?.errorCode && result.errorCode !== "NONE" ? result.errorCode : null;

  // Extract rows for table view
  const rawRows = useMemo<Record<string, unknown>[]>(() => {
    if (!result) return [];
    if (Array.isArray(result.resultSet)) return result.resultSet;
    if (result.resultSet && typeof result.resultSet === "object") {
      const candidate =
        (result.resultSet as Record<string, unknown>).items ||
        (result.resultSet as Record<string, unknown>).data ||
        (result.resultSet as Record<string, unknown>).content;
      if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
    }
    return [];
  }, [result]);

  const hasTableRows = rawRows.length > 0 && typeof rawRows[0] === "object" && rawRows[0] !== null;

  // Automatically default to table if we have row objects, otherwise json
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

  // Extract column keys
  const columns = useMemo(() => {
    if (!hasTableRows) return [];
    const keysSet = new Set<string>();
    rawRows.forEach((row) => {
      if (row && typeof row === "object") {
        Object.keys(row).forEach((k) => keysSet.add(k));
      }
    });
    return Array.from(keysSet);
  }, [rawRows, hasTableRows]);

  const allExpanded = rawRows.length > 0 && expandedRows.size === rawRows.length;

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleAllRows = () => {
    if (allExpanded) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(rawRows.map((_, i) => i)));
    }
  };

  // Client-side pagination of the table view; reset to the first page when the result changes.
  const [rowPage, setRowPage] = useState(0);
  const [rowPageFor, setRowPageFor] = useState(rawRows);
  if (rowPageFor !== rawRows) {
    setRowPageFor(rawRows);
    setRowPage(0);
  }
  const rowPageCount = Math.max(1, Math.ceil(rawRows.length / ROWS_PER_PAGE));
  const safeRowPage = Math.min(rowPage, rowPageCount - 1);
  const rowPageStart = safeRowPage * ROWS_PER_PAGE;
  const pageRows = useMemo(
    () => rawRows.slice(rowPageStart, rowPageStart + ROWS_PER_PAGE),
    [rawRows, rowPageStart]
  );

  // The JSON view is only stringified while it is actually visible.
  const isJsonViewActive = !(hasTableRows && viewMode === "table");
  const formattedJson = useMemo(
    () => (isJsonViewActive ? buildFormattedJson(result, resultError) : ""),
    [isJsonViewActive, result, resultError]
  );

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        isJsonViewActive ? formattedJson : buildFormattedJson(result, resultError)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyValue = async (identifier: string, data: unknown) => {
    try {
      const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(text);
      setCopiedField(identifier);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // fallback
    }
  };

  const renderCellContent = (value: unknown, rowIndex: number) => {
    if (value === null || value === undefined) {
      return (
        <Typography component="span" variant="caption" sx={{ color: "text.disabled", fontStyle: "italic" }}>
          NULL
        </Typography>
      );
    }

    if (typeof value === "boolean") {
      return (
        <Chip
          label={value ? "TRUE" : "FALSE"}
          size="small"
          sx={{
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: value ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: value ? "#16a34a" : "#dc2626",
          }}
        />
      );
    }

    const { isJson, parsed } = parseJsonValue(value);
    if (isJson && parsed !== null && typeof parsed === "object") {
      const isArr = Array.isArray(parsed);
      const count = isArr ? parsed.length : Object.keys(parsed).length;
      return (
        <Tooltip title="Click to view full JSON in expanded row">
          <Chip
            icon={<DataObjectIcon sx={{ fontSize: "14px !important" }} />}
            label={isArr ? `[ ${count} items ]` : `{ ${count} properties }`}
            size="small"
            clickable
            onClick={(e) => {
              e.stopPropagation();
              toggleRow(rowIndex);
            }}
            sx={{
              height: 22,
              fontSize: 11,
              fontFamily: "monospace",
              fontWeight: 600,
              bgcolor: "rgba(59, 130, 246, 0.12)",
              color: "#3b82f6",
              border: "1px solid rgba(59, 130, 246, 0.28)",
              cursor: "pointer",
              "&:hover": {
                bgcolor: "rgba(59, 130, 246, 0.22)",
              },
            }}
          />
        </Tooltip>
      );
    }

    return String(value);
  };

  return (
    <Paper
      elevation={0}
      sx={(theme) => ({
        mt: 2.5,
        p: 2,
        borderRadius: 2,
        border: `1px solid ${isFailed ? theme.palette.error.main : theme.palette.divider}`,
        background:
          theme.palette.mode === "dark"
            ? "var(--color-canvas-subtle, #0d1117)"
            : "var(--color-canvas-subtle, #f6f8fa)",
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        transition: "all 0.2s ease",
      })}
    >
      {/* Header & Metrics Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Chip
            icon={isFailed ? <ErrorOutlineIcon fontSize="small" /> : <CheckCircleOutlineIcon fontSize="small" />}
            label={status}
            color={isFailed ? "error" : "success"}
            variant="filled"
            size="small"
            sx={{ fontWeight: 700, letterSpacing: 0.5 }}
          />

          {duration != null && (
            <Chip
              icon={<AccessTimeIcon fontSize="small" />}
              label={`${duration} ms`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, color: "text.secondary" }}
            />
          )}

          {affectedRows != null && (
            <Chip
              icon={<NumbersIcon fontSize="small" />}
              label={`Affected: ${affectedRows}`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, color: "text.secondary" }}
            />
          )}

          {hasTableRows && (
            <Chip
              label={`${rawRows.length} ${rawRows.length === 1 ? "row" : "rows"}`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, color: "text.secondary" }}
            />
          )}

          {size != null && affectedRows == null && !hasTableRows && (
            <Chip
              label={`Size: ${size}`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, color: "text.secondary" }}
            />
          )}

          {errorCode && (
            <Chip
              label={`Code: ${errorCode}`}
              size="small"
              color="error"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {hasTableRows && (
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, next) => {
                if (next) setViewMode(next);
              }}
              sx={{ height: 28 }}
            >
              <ToggleButton value="table" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
                <TableChartIcon sx={{ fontSize: 15, mr: 0.5 }} /> Table
              </ToggleButton>
              <ToggleButton value="json" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
                <DataObjectIcon sx={{ fontSize: 15, mr: 0.5 }} /> JSON
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          <Tooltip title={copied ? "Copied!" : "Copy Output JSON"}>
            <IconButton size="small" onClick={handleCopyJson}>
              {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {onClose && (
            <Tooltip title="Close results">
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Error Callout */}
      {isFailed && reason && (
        <Alert severity="error" sx={{ mb: 1.5, py: 0.5, alignItems: "center" }}>
          <Typography variant="body2" sx={{ wordBreak: "break-word", fontFamily: "monospace", fontSize: 13 }}>
            {reason}
          </Typography>
        </Alert>
      )}

      {/* Main Results View */}
      {hasTableRows && viewMode === "table" ? (
        <>
        <TableContainer
          sx={{
            maxHeight: 460,
            overflowX: "auto",
            overflowY: "auto",
            width: "100%",
            maxWidth: "100%",
            borderRadius: 1.5,
            border: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
            bgcolor: "var(--color-canvas-default, #161b22)",
            // Internal table sliders (scrollbars):
            scrollbarWidth: "thin",
            scrollbarColor: "var(--color-border-default, rgba(127,127,127,0.35)) transparent",
            "&::-webkit-scrollbar": {
              width: 8,
              height: 8,
            },
            "&::-webkit-scrollbar-track": {
              background: "rgba(127, 127, 127, 0.04)",
              borderRadius: 4,
            },
            "&::-webkit-scrollbar-thumb": {
              background: "var(--color-border-default, rgba(127, 127, 127, 0.35))",
              borderRadius: 4,
              "&:hover": {
                background: "var(--color-fg-muted, rgba(127, 127, 127, 0.55))",
              },
            },
          }}
        >
          <Table size="small" stickyHeader sx={{ minWidth: "100%", width: "max-content" }}>
            <TableHead>
              <TableRow>
                {/* Expand All / Collapse All Toggle Column */}
                <TableCell
                  sx={{
                    width: 44,
                    minWidth: 44,
                    p: 0.5,
                    textAlign: "center",
                    bgcolor: "var(--color-canvas-default, #161b22)",
                    borderBottom: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
                  }}
                >
                  <Tooltip title={allExpanded ? "Collapse all rows" : "Expand all rows"}>
                    <IconButton size="small" onClick={toggleAllRows} sx={{ color: "text.secondary", p: 0.5 }}>
                      {allExpanded ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>

                {/* Row Index Column */}
                <TableCell
                  sx={{
                    fontWeight: 700,
                    width: 48,
                    color: "text.secondary",
                    fontSize: 12,
                    bgcolor: "var(--color-canvas-default, #161b22)",
                    borderBottom: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
                  }}
                >
                  #
                </TableCell>

                {/* Data Columns */}
                {columns.map((col) => (
                  <TableCell
                    key={col}
                    sx={{
                      fontWeight: 700,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      bgcolor: "var(--color-canvas-default, #161b22)",
                      borderBottom: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
                    }}
                  >
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {pageRows.map((row, pageIdx) => {
                const idx = rowPageStart + pageIdx;
                const isExpanded = expandedRows.has(idx);

                return (
                  <RowItem
                    key={idx}
                    idx={idx}
                    row={row}
                    columns={columns}
                    isExpanded={isExpanded}
                    onToggle={() => toggleRow(idx)}
                    renderCellContent={renderCellContent}
                    copiedField={copiedField}
                    onCopyValue={handleCopyValue}
                  />
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {rowPageCount > 1 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
              mt: 1,
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
              Rows {rowPageStart + 1}–{Math.min(rowPageStart + ROWS_PER_PAGE, rawRows.length)} of{" "}
              {rawRows.length}
            </Typography>
            <Tooltip title="Previous page">
              <span>
                <IconButton
                  size="small"
                  onClick={() => setRowPage(Math.max(0, safeRowPage - 1))}
                  disabled={safeRowPage === 0}
                  aria-label="Previous page"
                  sx={{ p: 0.5 }}
                >
                  <KeyboardArrowLeftIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next page">
              <span>
                <IconButton
                  size="small"
                  onClick={() => setRowPage(Math.min(rowPageCount - 1, safeRowPage + 1))}
                  disabled={safeRowPage >= rowPageCount - 1}
                  aria-label="Next page"
                  sx={{ p: 0.5 }}
                >
                  <KeyboardArrowRightIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
        </>
      ) : (
        <Box
          sx={{
            borderRadius: 1.5,
            overflow: "hidden",
            border: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
          }}
        >
          <WeaverCodeEditor
            height="320px"
            language="json"
            value={formattedJson}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              lineNumbers: "on",
            }}
          />
        </Box>
      )}
    </Paper>
  );
}

/**
 * Expandable Table Row component for each row in the query results.
 */
interface RowItemProps {
  idx: number;
  row: Record<string, unknown>;
  columns: string[];
  isExpanded: boolean;
  onToggle: () => void;
  renderCellContent: (value: unknown, rowIndex: number) => React.ReactNode;
  copiedField: string | null;
  onCopyValue: (identifier: string, data: unknown) => void;
}

function RowItem({
  idx,
  row,
  columns,
  isExpanded,
  onToggle,
  renderCellContent,
  copiedField,
  onCopyValue,
}: RowItemProps) {
  const [activeTab, setActiveTab] = useState<"json" | "raw">("json");

  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{
          cursor: "pointer",
          bgcolor: isExpanded ? "rgba(59, 130, 246, 0.04)" : "inherit",
          "&:nth-of-type(4n+1)": {
            bgcolor: isExpanded ? "rgba(59, 130, 246, 0.06)" : "transparent",
          },
          "&:nth-of-type(4n+3)": {
            bgcolor: isExpanded ? "rgba(59, 130, 246, 0.08)" : "rgba(127,127,127,0.03)",
          },
        }}
      >
        {/* Expand/Collapse Chevron Button */}
        <TableCell sx={{ width: 44, p: 0.5, textAlign: "center" }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            sx={{
              color: isExpanded ? "#3b82f6" : "text.secondary",
              p: 0.5,
              transition: "transform 0.2s ease",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
            aria-label={isExpanded ? "Collapse row" : "Expand row"}
          >
            <KeyboardArrowRightIcon fontSize="small" />
          </IconButton>
        </TableCell>

        {/* Row Index */}
        <TableCell sx={{ color: "text.disabled", fontSize: 11, width: 48, userSelect: "none" }}>
          {idx + 1}
        </TableCell>

        {/* Data Cells */}
        {columns.map((col) => (
          <TableCell
            key={col}
            sx={{
              fontSize: 12,
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {renderCellContent(row?.[col], idx)}
          </TableCell>
        ))}
      </TableRow>

      {/* Expanded Sub-Row */}
      <TableRow sx={{ display: isExpanded ? "table-row" : "none" }}>
        <TableCell
          colSpan={columns.length + 2}
          sx={{
            p: 0,
            borderBottom: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
            bgcolor: "rgba(0, 0, 0, 0.12)",
          }}
        >
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <RowDetails
              idx={idx}
              row={row}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              copiedField={copiedField}
              onCopyValue={onCopyValue}
            />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

interface RowDetailsProps {
  idx: number;
  row: Record<string, unknown>;
  activeTab: "json" | "raw";
  onActiveTabChange: (tab: "json" | "raw") => void;
  copiedField: string | null;
  onCopyValue: (identifier: string, data: unknown) => void;
}

/**
 * Expanded row body. Mounted only while the row is expanded (Collapse unmountOnExit), so the
 * per-row JSON parsing/stringifying happens lazily instead of for every rendered row.
 */
function RowDetails({
  idx,
  row,
  activeTab,
  onActiveTabChange: setActiveTab,
  copiedField,
  onCopyValue,
}: RowDetailsProps) {
  const rowCopyKey = `row-${idx}`;
  const rowJsonFields = useMemo(() => extractRowJsonFields(row), [row]);
  const showJsonFields = activeTab === "json" && rowJsonFields.length > 0;
  const formattedFields = useMemo(
    () =>
      showJsonFields
        ? rowJsonFields.map((field) => JSON.stringify(field.value, null, 2))
        : [],
    [showJsonFields, rowJsonFields]
  );
  const formattedRow = useMemo(
    () => (showJsonFields ? "" : JSON.stringify(row, null, 2)),
    [showJsonFields, row]
  );

  return (
            <Box
              sx={{
                m: 1.5,
                p: 2,
                borderRadius: 2,
                borderLeft: "4px solid #3b82f6",
                border: "1px solid var(--color-border-default, rgba(255,255,255,0.08))",
                bgcolor: "var(--color-canvas-subtle, #0d1117)",
              }}
            >
              {/* Header inside expanded row */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 1.5,
                  mb: 2,
                  pb: 1.5,
                  borderBottom: "1px solid var(--color-border-default, rgba(255,255,255,0.08))",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
                    Row #{idx + 1} Details
                  </Typography>

                  {rowJsonFields.length > 0 && (
                    <Chip
                      icon={<DataObjectIcon sx={{ fontSize: 13 }} />}
                      label={`${rowJsonFields.length} JSON ${rowJsonFields.length === 1 ? "field" : "fields"}`}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: 11,
                        fontWeight: 600,
                        bgcolor: "rgba(59, 130, 246, 0.12)",
                        color: "#3b82f6",
                      }}
                    />
                  )}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {rowJsonFields.length > 0 && (
                    <ToggleButtonGroup
                      size="small"
                      value={activeTab}
                      exclusive
                      onChange={(_, next) => {
                        if (next) setActiveTab(next);
                      }}
                      sx={{ height: 26 }}
                    >
                      <ToggleButton value="json" sx={{ px: 1, py: 0.2, fontSize: 11 }}>
                        <DataObjectIcon sx={{ fontSize: 13, mr: 0.5 }} /> JSON Fields
                      </ToggleButton>
                      <ToggleButton value="raw" sx={{ px: 1, py: 0.2, fontSize: 11 }}>
                        <CodeIcon sx={{ fontSize: 13, mr: 0.5 }} /> Full Row
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}

                  <Tooltip title={copiedField === rowCopyKey ? "Copied!" : "Copy Full Row JSON"}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyValue(rowCopyKey, row);
                      }}
                      sx={{
                        fontSize: 12,
                        borderRadius: 1,
                        border: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
                        px: 1,
                        gap: 0.5,
                      }}
                    >
                      {copiedField === rowCopyKey ? (
                        <CheckIcon fontSize="small" color="success" />
                      ) : (
                        <ContentCopyIcon fontSize="small" />
                      )}
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {copiedField === rowCopyKey ? "Copied" : "Copy Row"}
                      </Typography>
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Body: JSON Fields or Raw JSON */}
              {showJsonFields ? (
                <Box sx={{ display: "grid", gap: 1.5 }}>
                  {rowJsonFields.map((field, fieldIdx) => {
                    const fieldCopyKey = `field-${idx}-${field.key}`;
                    return (
                      <Box
                        key={field.key}
                        sx={{
                          borderRadius: 1.5,
                          border: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
                          overflow: "hidden",
                          bgcolor: "var(--color-canvas-default, #161b22)",
                        }}
                      >
                        {/* JSON Field Header */}
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 1.5,
                            py: 0.75,
                            bgcolor: "rgba(127, 127, 127, 0.04)",
                            borderBottom: "1px solid var(--color-border-default, rgba(255,255,255,0.08))",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <DataObjectIcon fontSize="small" sx={{ color: "#3b82f6" }} />
                            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                              {field.key}
                            </Typography>
                            <Chip
                              label={
                                field.isArray
                                  ? `Array (${field.itemCount} items)`
                                  : `Object (${field.itemCount} properties)`
                              }
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: 10, fontWeight: 600, color: "text.secondary" }}
                            />
                          </Box>

                          <Tooltip title={copiedField === fieldCopyKey ? "Copied!" : "Copy Field JSON"}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopyValue(fieldCopyKey, field.value);
                              }}
                              sx={{ p: 0.5 }}
                            >
                              {copiedField === fieldCopyKey ? (
                                <CheckIcon fontSize="small" color="success" />
                              ) : (
                                <ContentCopyIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* Formatted JSON Box */}
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            p: 1.5,
                            maxHeight: 260,
                            overflowX: "auto",
                            overflowY: "auto",
                            fontSize: 12,
                            fontFamily: "monospace",
                            lineHeight: 1.5,
                            color: "var(--color-fg-default, #e6edf3)",
                            bgcolor: "transparent",
                            scrollbarWidth: "thin",
                            "&::-webkit-scrollbar": {
                              width: 6,
                              height: 6,
                            },
                            "&::-webkit-scrollbar-thumb": {
                              background: "rgba(127, 127, 127, 0.3)",
                              borderRadius: 3,
                            },
                          }}
                        >
                          {formattedFields[fieldIdx]}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                /* Raw Full Row JSON */
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    borderRadius: 1.5,
                    border: "1px solid var(--color-border-default, rgba(255,255,255,0.1))",
                    bgcolor: "var(--color-canvas-default, #161b22)",
                    maxHeight: 300,
                    overflowX: "auto",
                    overflowY: "auto",
                    fontSize: 12,
                    fontFamily: "monospace",
                    lineHeight: 1.5,
                    color: "var(--color-fg-default, #e6edf3)",
                    scrollbarWidth: "thin",
                    "&::-webkit-scrollbar": {
                      width: 6,
                      height: 6,
                    },
                    "&::-webkit-scrollbar-thumb": {
                      background: "rgba(127, 127, 127, 0.3)",
                      borderRadius: 3,
                    },
                  }}
                >
                  {formattedRow}
                </Box>
              )}
            </Box>
  );
}
