import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircularProgress } from "@mui/material";
import {
  FiAlertCircle,
  FiCheck,
  FiChevronsDown,
  FiCopy,
  FiDownload,
  FiRefreshCw,
  FiSearch,
  FiTerminal,
  FiX,
} from "react-icons/fi";
import {
  formatExecutionLogLine,
  formatLogLevelToken,
  formatLogTimestampIso,
  getExecutionTaskReferenceName,
  toExecutionEpochMs,
} from "@/features/monitoring/services/executionsService";
import type {
  ParsedTaskLogLine,
  TaskLogLevel,
  WorkflowExecutionTask,
} from "@/features/monitoring/types/executionTypes";
import styles from "./ExecutionLogsConsole.module.css";

export type LevelFilter = "ALL" | TaskLogLevel;

export interface ExecutionLogsConsoleProps {
  logs: ParsedTaskLogLine[];
  loading?: boolean;
  errorMessage?: string | null;
  onRefresh?: () => void;
  /** Optional task list for global workflow view with multi-task filter dropdown */
  tasks?: WorkflowExecutionTask[];
  selectedTaskRef?: string | null;
  onSelectTaskRef?: (taskRef: string | null) => void;
  /** Click handler on a log line's task badge to jump to task inspector */
  onNavigateToTask?: (taskRef: string) => void;
  contextTitle?: string;
  compact?: boolean;
}

const LEVEL_BADGE_CLASS: Record<TaskLogLevel, string> = {
  ERROR: styles.badgeError,
  WARN: styles.badgeWarn,
  INFO: styles.badgeInfo,
  DEBUG: styles.badgeDebug,
  TRACE: styles.badgeTrace,
};

const LEVEL_PILL_CLASS: Record<TaskLogLevel, string> = {
  ERROR: styles.levelError,
  WARN: styles.levelWarn,
  INFO: styles.levelInfo,
  DEBUG: styles.levelDebug,
  TRACE: styles.levelTrace,
};

/** Max rows rendered at once; more can be revealed in batches of this size. */
const ROW_RENDER_BATCH = 500;

/** Builds a case-insensitive capture regex for the search query (or null when empty). */
function buildHighlightRegex(query: string): RegExp | null {
  if (!query.trim()) return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // No `g` flag: split() does not need it, and a global regex keeps `lastIndex` state.
  return new RegExp(`(${escaped})`, "i");
}

function highlightMatch(text: string, regex: RegExp | null): ReactNode {
  if (!regex) return text;
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  // With a single capture group, odd indices are always the captured matches.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={styles.highlightMark}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

interface LogRowProps {
  item: ParsedTaskLogLine;
  lineNumber: number;
  lineKey: string;
  showLineNumbers: boolean;
  highlightRegex: RegExp | null;
  isCopied: boolean;
  onCopyLine: (item: ParsedTaskLogLine, lineKey: string) => void;
  onNavigateToTask?: (taskRef: string) => void;
}

const LogRow = memo(function LogRow({
  item,
  lineNumber,
  lineKey,
  showLineNumbers,
  highlightRegex,
  isCopied,
  onCopyLine,
  onNavigateToTask,
}: LogRowProps) {
  const isError = item.level === "ERROR";
  const isWarn = item.level === "WARN";
  const taskRef =
    typeof item.taskReferenceName === "string" && item.taskReferenceName
      ? item.taskReferenceName
      : typeof item.taskId === "string" && item.taskId
      ? item.taskId
      : "task";
  const taskName =
    typeof item.taskName === "string" && item.taskName
      ? item.taskName
      : typeof item.taskType === "string" && item.taskType
      ? item.taskType
      : "Task";
  const rawMessage = typeof item.message === "string" ? item.message : JSON.stringify(item.message);

  return (
    <li className={`${styles.logRow} ${isError ? styles.rowError : isWarn ? styles.rowWarn : ""}`}>
      {/* Line Number */}
      {showLineNumbers && <span className={styles.gutterNumber}>{lineNumber}</span>}

      {/* Timestamp in ISO format with comma ms: 2026-10-20T23:16:28,947 */}
      <time className={styles.timestamp} dateTime={String(item.timestamp)}>
        {formatLogTimestampIso(item.timestamp)}
      </time>

      {/* Level Badge padded: [INFO ], [WARN ], [ERROR], [DEBUG], [TRACE] */}
      <span className={`${styles.levelBadge} ${LEVEL_BADGE_CLASS[item.level] || styles.badgeInfo}`}>
        {formatLogLevelToken(item.level)}
      </span>

      {/* Logger: weaver.action.<TaskName> */}
      <span className={styles.loggerTag} title={`weaver.action.${taskName}`}>
        weaver.action.{taskName}
      </span>

      {/* Task Reference: (taskReferenceName) */}
      {onNavigateToTask ? (
        <button
          type="button"
          className={styles.taskRefPill}
          onClick={() => onNavigateToTask(taskRef)}
          title={`Inspect task "${taskRef}"`}
        >
          ({taskRef})
        </button>
      ) : (
        <span className={styles.taskRefText}>({taskRef})</span>
      )}

      {/* Separator */}
      <span className={styles.separator}>-</span>

      {/* Message Content */}
      <div className={styles.messageContent}>{highlightMatch(rawMessage, highlightRegex)}</div>

      {/* 1-Click Copy Line on Hover */}
      <button
        type="button"
        className={styles.copyLineBtn}
        onClick={() => onCopyLine(item, lineKey)}
        title="Copy formatted log line"
        aria-label="Copy formatted log line"
      >
        {isCopied ? <FiCheck size={11} color="var(--color-status-success, #22c55e)" /> : <FiCopy size={11} />}
      </button>
    </li>
  );
});

export function ExecutionLogsConsole({
  logs,
  loading = false,
  errorMessage = null,
  onRefresh,
  tasks,
  selectedTaskRef,
  onSelectTaskRef,
  onNavigateToTask,
  contextTitle,
  compact = false,
}: ExecutionLogsConsoleProps) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  // Filtering/highlighting large log lists lags behind typing instead of blocking it.
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [wrapLines, setWrapLines] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [autoScroll, setAutoScroll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);

  const consoleBodyRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  // Calculate counts across all levels
  const counts = useMemo(() => {
    const res = {
      ALL: logs.length,
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
      TRACE: 0,
    };
    for (const l of logs) {
      if (l && l.level && res[l.level] !== undefined) {
        res[l.level] += 1;
      }
    }
    return res;
  }, [logs]);

  // Filter logs by selected task, level, and search text
  const filteredLogs = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return logs.filter((item) => {
      if (!item) return false;
      const ref = typeof item.taskReferenceName === "string" ? item.taskReferenceName : "";
      // 1. Task filter
      if (selectedTaskRef && ref && ref !== selectedTaskRef) {
        return false;
      }
      // 2. Level filter
      if (levelFilter !== "ALL" && item.level !== levelFilter) {
        return false;
      }
      // 3. Search query
      if (q) {
        const msg = typeof item.message === "string" ? item.message.toLowerCase() : "";
        const lvl = typeof item.level === "string" ? item.level.toLowerCase() : "";
        const matchesMsg = msg.includes(q);
        const matchesLevel = lvl.includes(q);
        const matchesTask = ref ? ref.toLowerCase().includes(q) : false;
        if (!matchesMsg && !matchesLevel && !matchesTask) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedTaskRef, levelFilter, deferredSearchQuery]);

  const highlightRegex = useMemo(() => buildHighlightRegex(deferredSearchQuery), [deferredSearchQuery]);

  // Cap rendered rows (no virtualization lib): reveal more in batches; cap resets when filters change.
  const filterSignature = `${levelFilter}|${selectedTaskRef ?? ""}|${deferredSearchQuery}`;
  const [renderCap, setRenderCap] = useState({ signature: filterSignature, count: ROW_RENDER_BATCH });
  const visibleLimit = renderCap.signature === filterSignature ? renderCap.count : ROW_RENDER_BATCH;
  const hiddenRowCount = Math.max(0, filteredLogs.length - visibleLimit);
  // When auto-scroll is pinned, show the newest lines (tail); otherwise the first lines.
  const visibleOffset = hiddenRowCount > 0 && autoScroll ? hiddenRowCount : 0;
  const visibleLogs = useMemo(
    () =>
      hiddenRowCount > 0 ? filteredLogs.slice(visibleOffset, visibleOffset + visibleLimit) : filteredLogs,
    [filteredLogs, hiddenRowCount, visibleOffset, visibleLimit]
  );
  const showMoreRows = useCallback(() => {
    setRenderCap({ signature: filterSignature, count: visibleLimit + ROW_RENDER_BATCH });
  }, [filterSignature, visibleLimit]);
  const showMoreLabel = `Show ${Math.min(ROW_RENDER_BATCH, hiddenRowCount)} ${
    autoScroll ? "earlier" : "more"
  } lines (${hiddenRowCount} hidden)`;

  // Auto-scroll effect when enabled
  useEffect(() => {
    if (autoScroll && bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredLogs.length, autoScroll]);

  // Copy filtered or all logs to clipboard in exact standard format:
  // 2026-10-20T23:16:28,947 [INFO ] weaver.action.<TaskName> (taskReferenceName) - <message>
  const handleCopyLogs = useCallback(async () => {
    try {
      const textToCopy = filteredLogs.map((l) => formatExecutionLogLine(l)).join("\n");
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [filteredLogs]);

  // Copy single log line to clipboard in exact standard format
  const handleCopySingleLine = useCallback(async (item: ParsedTaskLogLine, lineKey: string) => {
    try {
      await navigator.clipboard.writeText(formatExecutionLogLine(item));
      setCopiedLineId(lineKey);
      setTimeout(() => setCopiedLineId(null), 1400);
    } catch {
      // ignore
    }
  }, []);

  // Export logs as a .log text file in exact standard format
  const handleExportLogs = useCallback(() => {
    const textContent = filteredLogs.map((l) => formatExecutionLogLine(l)).join("\n");

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const safeTitle = (contextTitle || "execution").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    anchor.download = `${safeTitle}-logs-${Date.now()}.log`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [filteredLogs, contextTitle]);

  // Duration span from first to last visible log
  const durationSpan = useMemo(() => {
    if (filteredLogs.length < 2) return null;
    const first = toExecutionEpochMs(filteredLogs[0].timestamp);
    const last = toExecutionEpochMs(filteredLogs[filteredLogs.length - 1].timestamp);
    if (first > 0 && last >= first) {
      const diffMs = last - first;
      if (diffMs < 1000) return `${diffMs}ms`;
      return `${(diffMs / 1000).toFixed(2)}s`;
    }
    return null;
  }, [filteredLogs]);

  const levelOptions: Array<{ id: LevelFilter; label: string; count: number; levelClass?: string }> = [
    { id: "ALL", label: "ALL", count: counts.ALL },
    { id: "ERROR", label: "ERROR", count: counts.ERROR, levelClass: LEVEL_PILL_CLASS.ERROR },
    { id: "WARN", label: "WARN", count: counts.WARN, levelClass: LEVEL_PILL_CLASS.WARN },
    { id: "INFO", label: "INFO", count: counts.INFO, levelClass: LEVEL_PILL_CLASS.INFO },
    { id: "DEBUG", label: "DEBUG", count: counts.DEBUG, levelClass: LEVEL_PILL_CLASS.DEBUG },
    { id: "TRACE", label: "TRACE", count: counts.TRACE, levelClass: LEVEL_PILL_CLASS.TRACE },
  ];

  return (
    <div className={`${styles.consoleContainer} ${compact ? styles.compact : ""}`}>
      {/* 1. Toolbar Header */}
      <div className={styles.toolbarHeader}>
        {/* Row 1: Level Pills & Task Filter */}
        <div className={styles.toolbarRowPrimary}>
          <div className={styles.levelPillsGroup} role="group" aria-label="Filter logs by level">
            {levelOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`${styles.levelPill} ${
                  levelFilter === opt.id
                    ? `${styles.levelPillActive} ${opt.levelClass || ""}`
                    : ""
                }`}
                onClick={() => setLevelFilter(opt.id)}
                title={`Filter by ${opt.label} logs (${opt.count})`}
              >
                <span>{opt.label}</span>
                <span className={styles.pillCount}>({opt.count})</span>
              </button>
            ))}
          </div>

          <div className={styles.primaryRightControls}>
            {tasks && tasks.length > 0 && onSelectTaskRef ? (
              <select
                className={styles.taskSelect}
                value={selectedTaskRef || ""}
                onChange={(e) => onSelectTaskRef(e.target.value ? e.target.value : null)}
                title="Filter by specific task origin"
                aria-label="Filter by task origin"
              >
                <option value="">All Tasks ({tasks.length})</option>
                {tasks.map((t, idx) => {
                  const ref = getExecutionTaskReferenceName(t) || t.taskId || `task_${idx}`;
                  const type = t.taskType ? ` [${t.taskType}]` : "";
                  return (
                    <option key={t.taskId || idx} value={ref}>
                      {ref}
                      {type}
                    </option>
                  );
                })}
              </select>
            ) : contextTitle ? (
              <span className={styles.contextTag} title={contextTitle}>
                <FiTerminal size={11} />
                <span>{contextTitle}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Row 2: Search, Toggles & Actions */}
        <div className={styles.toolbarRowSecondary}>
          <div className={styles.searchWrap}>
            <FiSearch size={13} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search log messages or errors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search logs"
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                <FiX size={13} />
              </button>
            ) : null}
          </div>

          {searchQuery && (
            <span className={styles.matchCountChip}>
              {filteredLogs.length} of {logs.length} match
            </span>
          )}

          <div className={styles.toolbarActionsGroup}>
            {/* Wrap Toggle */}
            <button
              type="button"
              className={`${styles.toggleBtn} ${wrapLines ? styles.toggleBtnActive : ""}`}
              onClick={() => setWrapLines((prev) => !prev)}
              title="Toggle line wrapping"
            >
              <span>Wrap</span>
            </button>

            {/* Line Numbers Toggle */}
            <button
              type="button"
              className={`${styles.toggleBtn} ${showLineNumbers ? styles.toggleBtnActive : ""}`}
              onClick={() => setShowLineNumbers((prev) => !prev)}
              title="Toggle line numbers"
            >
              <span># Lines</span>
            </button>

            {/* Auto-Scroll Toggle */}
            <button
              type="button"
              className={`${styles.toggleBtn} ${autoScroll ? styles.toggleBtnActive : ""}`}
              onClick={() => setAutoScroll((prev) => !prev)}
              title="Pin and auto-scroll to bottom as logs stream"
            >
              <FiChevronsDown size={12} />
              <span>Scroll</span>
            </button>

            {/* Refresh */}
            {onRefresh ? (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={onRefresh}
                disabled={loading}
                title="Refresh logs from agent API"
              >
                <FiRefreshCw size={12} className={loading ? styles.spinning : ""} />
                <span>Refresh</span>
              </button>
            ) : null}

            {/* Copy All */}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleCopyLogs}
              disabled={filteredLogs.length === 0}
              title="Copy visible log lines to clipboard"
            >
              {copied ? (
                <FiCheck size={12} color="var(--color-status-success, #22c55e)" />
              ) : (
                <FiCopy size={12} />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            {/* Download */}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleExportLogs}
              disabled={filteredLogs.length === 0}
              title="Export visible logs to .log file"
            >
              <FiDownload size={12} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Console Terminal Body */}
      <div className={styles.consoleBody} ref={consoleBodyRef} role="log" aria-live="polite">
        {loading && logs.length === 0 ? (
          <div className={styles.stateMessageContainer}>
            <CircularProgress size={24} style={{ color: "var(--color-accent-fg, #38bdf8)" }} />
            <div className={styles.stateMessageTitle}>Fetching Worker Execution Logs...</div>
            <div className={styles.stateMessageText}>
              Connecting to agent tasks service and compiling execution output.
            </div>
          </div>
        ) : errorMessage ? (
          <div className={`${styles.stateMessageContainer} ${styles.errorState}`}>
            <FiAlertCircle size={28} className={styles.stateMessageIcon} />
            <div className={styles.stateMessageTitle}>Failed to Load Logs</div>
            <div className={styles.stateMessageText}>{errorMessage}</div>
            {onRefresh ? (
              <button type="button" className={styles.stateActionButton} onClick={onRefresh}>
                <FiRefreshCw size={12} />
                <span>Retry Request</span>
              </button>
            ) : null}
          </div>
        ) : logs.length === 0 ? (
          <div className={styles.stateMessageContainer}>
            <FiTerminal size={28} className={styles.stateMessageIcon} />
            <div className={styles.stateMessageTitle}>No Execution Logs Recorded</div>
            <div className={styles.stateMessageText}>
              No log messages were recorded by the worker during this execution.
            </div>
            {onRefresh ? (
              <button type="button" className={styles.stateActionButton} onClick={onRefresh}>
                <FiRefreshCw size={12} />
                <span>Check Again</span>
              </button>
            ) : null}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className={styles.stateMessageContainer}>
            <FiSearch size={24} className={styles.stateMessageIcon} />
            <div className={styles.stateMessageTitle}>No Matching Log Entries</div>
            <div className={styles.stateMessageText}>
              No log lines match current filters ({levelFilter !== "ALL" ? `Level: ${levelFilter}, ` : ""}
              {searchQuery ? `Query: "${searchQuery}"` : ""}).
            </div>
            <button
              type="button"
              className={styles.stateActionButton}
              onClick={() => {
                setLevelFilter("ALL");
                setSearchQuery("");
                if (onSelectTaskRef) onSelectTaskRef(null);
              }}
            >
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <ol className={`${styles.logList} ${wrapLines ? styles.wrapMode : ""}`}>
            {hiddenRowCount > 0 && autoScroll ? (
              <li className={styles.showMoreRow}>
                <button type="button" className={styles.stateActionButton} onClick={showMoreRows}>
                  <span>{showMoreLabel}</span>
                </button>
              </li>
            ) : null}
            {visibleLogs.map((item, i) => {
              const index = visibleOffset + i;
              const lineKey = `${item.timestamp ?? index}-${index}`;
              return (
                <LogRow
                  key={lineKey}
                  item={item}
                  lineNumber={index + 1}
                  lineKey={lineKey}
                  showLineNumbers={showLineNumbers}
                  highlightRegex={highlightRegex}
                  isCopied={copiedLineId === lineKey}
                  onCopyLine={handleCopySingleLine}
                  onNavigateToTask={onNavigateToTask}
                />
              );
            })}
            {hiddenRowCount > 0 && !autoScroll ? (
              <li className={styles.showMoreRow}>
                <button type="button" className={styles.stateActionButton} onClick={showMoreRows}>
                  <span>{showMoreLabel}</span>
                </button>
              </li>
            ) : null}
            <div ref={bottomAnchorRef} />
          </ol>
        )}
      </div>

      {/* 3. Footer Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusBarLeft}>
          <span>
            Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> lines
          </span>
          {levelFilter !== "ALL" && (
            <span>• Filtered by <strong>{levelFilter}</strong></span>
          )}
          {durationSpan && (
            <span>• Span: <strong>{durationSpan}</strong></span>
          )}
        </div>
        <div className={styles.statusBarRight}>
          {autoScroll && (
            <span className={styles.livePinIndicator} title="Auto-scrolling to bottom enabled">
              <span className={styles.pinDot} />
              <span>Auto-Scroll Active</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExecutionLogsConsole;
