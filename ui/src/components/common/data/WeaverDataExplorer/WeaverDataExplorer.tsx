import React from "react";
import { Alert } from "@mui/material";
import { Inbox } from "lucide-react";
import type { WeaverDataExplorerProps } from "./WeaverDataExplorer.types";
import { useDataExplorerState } from "../internal/useDataExplorerState";
import { DataExplorerToolbar } from "../internal/DataExplorerToolbar";
import { DataTableView } from "../internal/DataTableView";
import { DataCanvasView } from "../internal/DataCanvasView";
import { DataPagination } from "../internal/DataPagination";
import styles from "./WeaverDataExplorer.module.css";

export function WeaverDataExplorer<TRecord>(props: WeaverDataExplorerProps<TRecord>) {
  const {
    getRecordId,
    searchable = true,
    searchPlaceholder,
    toolbarActions,
    rowActions,
    bulkActions,
    renderCanvasItem,
    canvas,
    renderCanvasIcon,
    renderCanvasStatus,
    getCanvasTitle,
    renderCanvasContent,
    canvasQuickActions,
    renderCanvasQuickActions,
    onRecordClick,
    selectionMode = "multiple",
    pagination = true,
    pageSizeOptions,
    loading = false,
    emptyState,
    emptyTitle = "No records found",
    emptyDescription = "No items match your search or filter criteria.",
    errorMessage,
    errorState,
    className = "",
    height,
    stickyHeader = true,
  } = props;

  const state = useDataExplorerState(props);

  const isEmpty = !loading && state.derivedRecords.length === 0;

  // Find records matching selectedIds
  const selectedRecords = React.useMemo(() => {
    const idSet = new Set(state.selectedIds);
    return props.records.filter((r) => idSet.has(getRecordId(r)));
  }, [getRecordId, props.records, state.selectedIds]);

  return (
    <div
      className={`${styles.container} ${className}`.trim()}
      data-testid="weaver-data-explorer"
    >
      {/* Top Toolbar */}
      <DataExplorerToolbar
        fields={state.fields}
        visibleFields={state.visibleFieldsKeys}
        onVisibleFieldsChange={state.setVisibleFields}
        searchable={searchable}
        searchValue={state.searchValue}
        onSearchChange={state.setSearch}
        searchPlaceholder={searchPlaceholder}
        filterModel={state.filterModel}
        onFilterChange={state.setFilterModel}
        view={state.view}
        onViewChange={state.setView}
        toolbarActions={toolbarActions}
        bulkActions={bulkActions}
        selectedIds={state.selectedIds}
        onClearSelection={state.clearSelection}
        selectedRecords={selectedRecords}
      />

      {/* Main Content Area */}
      <div className={styles.contentWrapper}>
        {errorMessage || errorState ? (
          <div className={styles.errorOverlay}>
            {errorState || (
              <Alert severity="error" variant="outlined">
                {errorMessage}
              </Alert>
            )}
          </div>
        ) : isEmpty ? (
          emptyState || (
            <div className={styles.emptyOverlay}>
              <Inbox className={styles.emptyIcon} size={40} />
              <h4 className={styles.emptyTitle}>{emptyTitle}</h4>
              <p className={styles.emptyDescription}>{emptyDescription}</p>
            </div>
          )
        ) : state.view === "table" ? (
          <DataTableView
            records={state.derivedRecords}
            getRecordId={getRecordId}
            visibleFields={state.activeVisibleFields}
            selectionMode={selectionMode}
            selectedIds={state.selectedIds}
            onToggleSelectRecord={state.toggleSelectRecord}
            isAllSelected={state.isCurrentPageAllSelected}
            isSomeSelected={state.isCurrentPageSomeSelected}
            onToggleSelectAll={state.toggleSelectAllCurrentPage}
            sortModel={state.sortModel}
            onToggleSort={state.toggleSort}
            rowActions={rowActions}
            loading={loading}
            stickyHeader={stickyHeader}
            height={height}
          />
        ) : (
          <DataCanvasView
            records={state.derivedRecords}
            getRecordId={getRecordId}
            visibleFields={state.activeVisibleFields}
            allFields={state.fields}
            selectionMode={selectionMode}
            selectedIds={state.selectedIds}
            onToggleSelectRecord={state.toggleSelectRecord}
            renderCanvasItem={renderCanvasItem}
            rowActions={rowActions}
            loading={loading}
            canvas={canvas}
            renderCanvasIcon={renderCanvasIcon}
            renderCanvasStatus={renderCanvasStatus}
            getCanvasTitle={getCanvasTitle}
            renderCanvasContent={renderCanvasContent}
            canvasQuickActions={canvasQuickActions}
            renderCanvasQuickActions={renderCanvasQuickActions}
            onRecordClick={onRecordClick}
          />
        )}
      </div>

      {/* Bottom Pagination */}
      {pagination && (
        <DataPagination
          paginationModel={state.paginationState}
          onPaginationChange={state.setPagination}
          totalRecords={state.totalCount}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}

export default WeaverDataExplorer;
