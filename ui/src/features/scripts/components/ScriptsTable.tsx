import { useCallback, useMemo } from "react";
import { Box, Link } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CodeIcon from "@mui/icons-material/Code";

import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import Tag from "@/components/common/data/Tag/Tag";
import { toTimezoneDateTime } from "@/utils/dateTime";
import type { ScriptDefinition } from "@/features/scripts/types/scriptTypes";

const PAGE_SIZE_OPTIONS = [20, 25, 50, 75, 100];

const DEFAULT_VISIBLE_FIELDS = ["name", "description", "language", "createdAt"];

const getScriptRecordId = (r: ScriptDefinition) => r.id || r.name;

const SCRIPTS_CANVAS = {
  renderIcon: () => (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        backgroundColor: "#7c3aed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        boxShadow: (theme: Theme) =>
          `0 4px 14px ${alpha("#7c3aed", theme.palette.mode === "dark" ? 0.45 : 0.3)}`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "scale(1.06)",
        },
      }}
    >
      <CodeIcon sx={{ fontSize: 26, color: "#ffffff" }} />
    </Box>
  ),
  renderStatus: (r?: ScriptDefinition) => {
    const lang = String(r?.language || "-").toUpperCase();
    const color = lang === "JAVASCRIPT" || lang === "JS" ? "#f59e0b" : "#8b5cf6";
    return <Tag text={lang} color={color} borderColor={color} />;
  },
  primaryFieldKey: "name",
  secondaryFieldKey: "language",
  descriptionFieldKey: "description",
};

interface ScriptsTableProps {
  scripts: ScriptDefinition[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalElements: number;
  onRefresh: () => void;
  onNew: () => void;
  onView: (script: ScriptDefinition) => void;
  onDeleteSelected: (args: { selectedRows?: ScriptDefinition[]; clearSelection?: () => void }) => void;
  onPaginationChange: (model: { page: number; pageSize: number }) => void;
}

export default function ScriptsTable({
  scripts,
  loading,
  page,
  pageSize,
  totalElements,
  onRefresh,
  onNew,
  onView,
  onDeleteSelected,
  onPaginationChange,
}: ScriptsTableProps) {
  const fields = useMemo<WeaverDataField<ScriptDefinition>[]>(
    () => [
      {
        key: "id",
        label: "ID",
        getValue: (r) => r.id,
        visibleByDefault: false,
        hideable: true,
        width: 220,
      },
      {
        key: "name",
        label: "Name",
        getValue: (r) => r.name,
        searchable: true,
        sortable: true,
        width: 200,
        render: (val, r) => {
          const name = String(val || "-");
          return (
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={(event) => {
                event.stopPropagation();
                if (r) onView(r);
              }}
              sx={{ fontWeight: 600, textAlign: "left", color: "primary.main" }}
            >
              {name}
            </Link>
          );
        },
      },
      {
        key: "description",
        label: "Description",
        getValue: (r) => r.description || "-",
        searchable: true,
        width: 240,
        render: (val) => (
          <span style={{ color: "var(--color-fg-muted, #64748b)" }}>
            {String(val || "-")}
          </span>
        ),
      },
      {
        key: "language",
        label: "Language",
        getValue: (r) => r.language,
        type: "enum",
        sortable: true,
        width: 140,
        render: (val) => {
          const lang = String(val || "-").toUpperCase();
          const color = lang === "JAVASCRIPT" || lang === "JS" ? "#f59e0b" : "#8b5cf6";
          return <Tag text={lang} color={color} borderColor={color} />;
        },
      },
      {
        key: "timeout",
        label: "Timeout (ms)",
        getValue: (r) => r.timeout ?? "-",
        sortable: true,
        width: 130,
      },
      {
        key: "createdAt",
        label: "Created At",
        getValue: (r) => r.createdAt,
        sortable: true,
        width: 200,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
      {
        key: "updatedAt",
        label: "Updated At",
        getValue: (r) => r.updatedAt,
        visibleByDefault: false,
        hideable: true,
        sortable: true,
        width: 200,
        render: (val) => toTimezoneDateTime(val, "Africa/Cairo") || "-",
      },
    ],
    [onView]
  );

  const toolbarActions = useMemo<WeaverDataAction<ScriptDefinition>[]>(
    () => [
      {
        id: "new",
        label: "New Script",
        icon: <AddIcon fontSize="small" />,
        onClick: onNew,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: <RefreshIcon fontSize="small" />,
        onClick: onRefresh,
      },
    ],
    [onNew, onRefresh]
  );

  const rowActions = useMemo<WeaverDataAction<ScriptDefinition>[]>(
    () => [
      {
        id: "open",
        label: "Open / Edit",
        icon: <VisibilityIcon fontSize="small" />,
        onClick: ({ record }) => {
          if (record) onView(record);
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: ({ record }) => {
          if (record) {
            onDeleteSelected({ selectedRows: [record] });
          }
        },
      },
    ],
    [onDeleteSelected, onView]
  );

  const bulkActions = useMemo<WeaverDataAction<ScriptDefinition>[]>(
    () => [
      {
        id: "delete",
        label: "Delete Selected",
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: ({ selectedRecords }) => {
          if (selectedRecords && selectedRecords.length) {
            onDeleteSelected({ selectedRows: selectedRecords });
          }
        },
      },
    ],
    [onDeleteSelected]
  );

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);

  const handleRecordClick = useCallback(
    (r: ScriptDefinition) => {
      if (r) onView(r);
    },
    [onView]
  );

  return (
    <WeaverDataExplorer<ScriptDefinition>
      records={scripts}
      getRecordId={getScriptRecordId}
      fields={fields}
      storageKey="scripts"
      defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
      dataMode="server"
      selectionMode="multiple"
      loading={loading}
      searchable={false}
      stickyHeader
      height="calc(100vh - 220px)"
      toolbarActions={toolbarActions}
      rowActions={rowActions}
      bulkActions={bulkActions}
      onRecordClick={handleRecordClick}
      pagination
      totalRecords={totalElements}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      paginationModel={paginationModel}
      onPaginationChange={onPaginationChange}
      canvas={SCRIPTS_CANVAS}
      emptyTitle="No scripts found"
      emptyDescription="Create reusable script definitions to execute in Script nodes."
    />
  );
}
