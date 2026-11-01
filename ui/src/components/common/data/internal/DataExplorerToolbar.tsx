import { Tooltip } from "@mui/material";
import { Search, X, Table as TableIcon, LayoutGrid } from "lucide-react";
import type {
  WeaverDataAction,
  WeaverDataField,
  WeaverDataView,
  WeaverFilterModel,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import { FieldManager } from "./FieldManager";
import { FilterBuilder } from "./FilterBuilder";
import { DataActionsMenu } from "./DataActionsMenu";
import { WeaverButton } from "../../buttons/WeaverButton";
import styles from "./DataExplorerToolbar.module.css";

interface DataExplorerToolbarProps<TRecord> {
  fields: WeaverDataField<TRecord>[];
  visibleFields: string[];
  onVisibleFieldsChange: (fields: string[]) => void;
  searchable?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterModel: WeaverFilterModel;
  onFilterChange: (model: WeaverFilterModel) => void;
  view: WeaverDataView;
  onViewChange: (view: WeaverDataView) => void;
  toolbarActions?: WeaverDataAction<TRecord>[];
  bulkActions?: WeaverDataAction<TRecord>[];
  selectedIds: Array<string | number>;
  onClearSelection: () => void;
  selectedRecords?: TRecord[];
}

export function DataExplorerToolbar<TRecord>({
  fields,
  visibleFields,
  onVisibleFieldsChange,
  searchable = true,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search records...",
  filterModel,
  onFilterChange,
  view,
  onViewChange,
  toolbarActions,
  bulkActions,
  selectedIds,
  onClearSelection,
  selectedRecords = [],
}: DataExplorerToolbarProps<TRecord>) {
  const buttonActions = (toolbarActions || []).filter(
    (a) => a.asButton && (typeof a.hidden === "function" ? !a.hidden() : !a.hidden)
  );
  const menuActions = (toolbarActions || []).filter(
    (a) => !a.asButton && (typeof a.hidden === "function" ? !a.hidden() : !a.hidden)
  );
  const hasSelection = selectedIds.length > 0;

  return (
    <div className={styles.toolbar}>
      {/* Left controls: Search, Filters, Fields, Selection pill */}
      <div className={styles.leftControls}>
        {searchable && (
          <div className={styles.searchContainer}>
            <span className={styles.searchIcon}>
              <Search size={15} />
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label={searchPlaceholder}
            />
            {searchValue && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <FilterBuilder
          fields={fields}
          filterModel={filterModel}
          onChange={onFilterChange}
        />

        <FieldManager
          fields={fields}
          visibleFields={visibleFields}
          onChange={onVisibleFieldsChange}
        />

        {/* Selection indicator & bulk actions */}
        {hasSelection && (
          <>
            <div className={styles.selectionPill}>
              <span>{selectedIds.length} selected</span>
              <button
                type="button"
                className={styles.clearSelectionBtn}
                onClick={onClearSelection}
                aria-label="Clear selection"
                title="Clear selection"
              >
                <X size={13} />
              </button>
            </div>

            {bulkActions && bulkActions.length > 0 && (
              <div className={styles.bulkActionsGroup}>
                {bulkActions.map((action) => (
                  <WeaverButton
                    key={action.id}
                    mode={action.danger ? "delete" : "default"}
                    size="small"
                    variant={action.danger ? "outlined" : "contained"}
                    color={action.danger ? "error" : "primary"}
                    icon={action.icon}
                    onAction={() =>
                      action.onClick({
                        selectedIds,
                        selectedRecords,
                      })
                    }
                    onClick={() => {
                      if (!action.danger) {
                        action.onClick({
                          selectedIds,
                          selectedRecords,
                        });
                      }
                    }}
                    sx={{ textTransform: "none", fontSize: "0.78rem", height: 32 }}
                  >
                    {action.label}
                  </WeaverButton>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right controls: View Toggle & Global Toolbar Actions */}
      <div className={styles.rightControls}>
        {buttonActions.map((action) => (
          <WeaverButton
            key={action.id}
            size="small"
            variant={action.buttonVariant || "contained"}
            color={action.buttonColor || "primary"}
            icon={action.icon}
            disabled={
              typeof action.disabled === "function"
                ? action.disabled()
                : Boolean(action.disabled)
            }
            onAction={() =>
              action.onClick({
                selectedIds,
                selectedRecords,
              })
            }
            onClick={() => {
              action.onClick({
                selectedIds,
                selectedRecords,
              });
            }}
            sx={{ textTransform: "none", fontSize: "0.82rem", height: 32, fontWeight: 500 }}
          >
            {action.label}
          </WeaverButton>
        ))}

        <div className={styles.viewToggle} role="group" aria-label="View toggle">
          <Tooltip title="Table View">
            <button
              type="button"
              className={`${styles.viewButton} ${
                view === "table" ? styles.viewButtonActive : ""
              }`}
              onClick={() => onViewChange("table")}
              aria-label="Table view"
              aria-pressed={view === "table"}
            >
              <TableIcon size={16} />
            </button>
          </Tooltip>

          <Tooltip title="Canvas / Card View">
            <button
              type="button"
              className={`${styles.viewButton} ${
                view === "canvas" ? styles.viewButtonActive : ""
              }`}
              onClick={() => onViewChange("canvas")}
              aria-label="Canvas view"
              aria-pressed={view === "canvas"}
            >
              <LayoutGrid size={16} />
            </button>
          </Tooltip>
        </div>

        {menuActions.length > 0 && (
          <DataActionsMenu
            actions={menuActions}
            context={{
              selectedIds,
              selectedRecords,
            }}
            tooltip="Global Actions"
            ariaLabel="Global explorer actions"
          />
        )}
      </div>
    </div>
  );
}
