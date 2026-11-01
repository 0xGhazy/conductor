import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Pagination,
  Stack,
  Tooltip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import TerminalIcon from "@mui/icons-material/Terminal";
import StorageIcon from "@mui/icons-material/Storage";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { toTimezoneDateTime } from "@/utils/dateTime";
import styles from "./QueryCanvasView.module.css";

export interface QueryCanvasViewProps {
  items: any[];
  totalCount?: number;
  loading?: boolean;
  search?: string;
  onOpenCreate?: () => void;
  onDelete?: (item: any) => void;
  onNotify?: ((payload: any) => void) | null;
}

export default function QueryCanvasView({
  items,
  loading = false,
  search = "",
  onOpenCreate,
  onDelete,
  onNotify,
}: QueryCanvasViewProps) {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 12;
  const pageCount = Math.ceil(items.length / pageSize) || 1;
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

  const handleCopySql = async (id: string, sql: string) => {
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      onNotify?.({ message: "SQL copied to clipboard!" });
    } catch {
      onNotify?.({ severity: "error", message: "Failed to copy SQL." });
    }
  };

  return (
    <div className={styles.canvasContainer}>
      <div className={styles.canvasTopBar}>
        <div className={styles.canvasMeta}>
          <span className={styles.metaCount}>
            Showing {items.length} {items.length === 1 ? "query" : "queries"}
            {search ? ` matching "${search}"` : ""}
          </span>
        </div>

        <Stack direction="row" spacing={1} alignItems="center">
          {onOpenCreate ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onOpenCreate}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              New Query
            </Button>
          ) : null}
        </Stack>
      </div>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress size={36} />
        </Box>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <InboxOutlinedIcon className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>
            {search ? "No queries match your search" : "No queries configured"}
          </div>
          <div className={styles.emptyDescription}>
            {search
              ? "Try adjusting your search terms or filters to find what you need."
              : "Create your first SQL query definition to use in workflows."}
          </div>
          {onOpenCreate ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={onOpenCreate}
              sx={{ textTransform: "none" }}
            >
              New Query
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className={styles.cardsGrid}>
            {paginatedItems.map((q) => {
              const queryId = String(q?.id || "");
              const sqlSnippet = String(q?.sql || q?.sqlQuery || q?.query || "").trim();
              const isCopied = copiedId === queryId;

              return (
                <div key={queryId || q?.name} className={styles.queryCard}>
                  <div>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderLeft}>
                        <div className={styles.queryIconWrapper}>
                          <TerminalIcon sx={{ fontSize: 20 }} />
                        </div>
                        <div className={styles.cardTitleWrapper}>
                          <h3
                            className={styles.cardTitle}
                            title={q?.name}
                            onClick={() => navigate(`/queries/${encodeURIComponent(queryId)}`)}
                          >
                            {q?.name || "Untitled Query"}
                          </h3>
                          {q?.description ? (
                            <p className={styles.cardDescription} title={q.description}>
                              {q.description}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <span className={styles.timeoutPill} title="Execution timeout">
                        <AccessTimeOutlinedIcon sx={{ fontSize: 13 }} />
                        {q?.timeoutMs ?? q?.timeout ?? 3000}ms
                      </span>
                    </div>

                    <div className={styles.cardBody} style={{ marginTop: 12 }}>
                      <div className={styles.dbBadgeRow}>
                        <span className={styles.dbBadge}>
                          <StorageIcon sx={{ fontSize: 14 }} />
                          {q?.dataSourceName || q?.databaseName || "Default Database"}
                        </span>
                      </div>

                      {sqlSnippet ? (
                        <div className={styles.sqlBox}>
                          <code>{sqlSnippet}</code>
                          <div className={styles.sqlFade} />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={styles.footerTime}>
                      {q?.createdAt
                        ? `Created ${toTimezoneDateTime(q.createdAt, "Africa/Cairo") || ""}`
                        : "Ready"}
                    </span>

                    <div className={styles.cardActions}>
                      {sqlSnippet ? (
                        <Tooltip title={isCopied ? "Copied!" : "Copy SQL"} arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleCopySql(queryId, sqlSnippet)}
                            sx={{ color: isCopied ? "success.main" : "text.secondary" }}
                          >
                            {isCopied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      ) : null}

                      <Tooltip title="Edit query" arrow>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/queries/${encodeURIComponent(queryId)}`)}
                          sx={{ color: "text.secondary" }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {onDelete ? (
                        <Tooltip title="Delete query" arrow>
                          <IconButton
                            size="small"
                            onClick={() => onDelete(q)}
                            sx={{ color: "error.main" }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {pageCount > 1 ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_, next) => setPage(next)}
                color="primary"
                shape="rounded"
                size="small"
              />
            </Box>
          ) : null}
        </>
      )}
    </div>
  );
}
