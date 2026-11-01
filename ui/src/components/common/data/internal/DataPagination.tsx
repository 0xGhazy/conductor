import React from "react";
import { Tooltip } from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { WeaverPaginationModel } from "../WeaverDataExplorer/WeaverDataExplorer.types";
import styles from "./DataPagination.module.css";

interface DataPaginationProps {
  paginationModel: WeaverPaginationModel;
  onPaginationChange: (model: WeaverPaginationModel) => void;
  totalRecords: number;
  pageSizeOptions?: number[];
}

export function DataPagination({
  paginationModel,
  onPaginationChange,
  totalRecords,
  pageSizeOptions = [10, 25, 50, 100],
}: DataPaginationProps) {
  const { page, pageSize } = paginationModel;
  const totalPages = Math.max(1, Math.ceil(totalRecords / (pageSize || 1)));

  const startRecord = totalRecords === 0 ? 0 : page * pageSize + 1;
  const endRecord = Math.min(totalRecords, (page + 1) * pageSize);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages && newPage !== page) {
      onPaginationChange({
        ...paginationModel,
        page: newPage,
      });
    }
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(event.target.value, 10);
    onPaginationChange({
      page: 0,
      pageSize: newPageSize,
    });
  };

  return (
    <div className={styles.paginationContainer} role="navigation" aria-label="Pagination">
      {/* Summary on left */}
      <div className={styles.summaryText}>
        {totalRecords === 0 ? (
          "No records"
        ) : (
          <>
            Showing{" "}
            <span className={styles.summaryHighlight}>
              {startRecord}–{endRecord}
            </span>{" "}
            of{" "}
            <span className={styles.summaryHighlight}>
              {totalRecords}
            </span>{" "}
            records
          </>
        )}
      </div>

      {/* Controls on right */}
      <div className={styles.controls}>
        {/* Page Size Selector */}
        <div className={styles.pageSizeSelector}>
          <label htmlFor="weaver-page-size-select">Rows per page:</label>
          <select
            id="weaver-page-size-select"
            className={styles.selectInput}
            value={pageSize}
            onChange={handlePageSizeChange}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Page Nav */}
        <div className={styles.navGroup}>
          <Tooltip title="First page">
            <span>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => handlePageChange(0)}
                disabled={page <= 0}
                aria-label="First page"
              >
                <ChevronsLeft size={15} />
              </button>
            </span>
          </Tooltip>

          <Tooltip title="Previous page">
            <span>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 0}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
            </span>
          </Tooltip>

          <span className={styles.pageIndicator}>
            Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
          </span>

          <Tooltip title="Next page">
            <span>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </span>
          </Tooltip>

          <Tooltip title="Last page">
            <span>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => handlePageChange(totalPages - 1)}
                disabled={page >= totalPages - 1}
                aria-label="Last page"
              >
                <ChevronsRight size={15} />
              </button>
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
