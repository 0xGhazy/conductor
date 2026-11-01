import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link, Typography } from "@mui/material";
import { WeaverDataExplorer } from "@/components/common/data";
import type {
  WeaverDataAction,
  WeaverDataField,
} from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import useDebounce from "@/hooks/useDebounce";
import { PAGE_SIZE_OPTIONS } from "@/utils/data";
import { toTimezoneDateTime } from "@/utils/dateTime";
import { getErrorMessage } from "@/utils/error";
import { useSecretsList } from "../hooks/useSecrets";
import type { Secret } from "../types/secretTypes";
import CopyReferenceButton from "./CopyReferenceButton";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_VISIBLE_FIELDS = ["name", "displayedText", "description", "updatedAt", "actions"];
const getSecretId = (s: Secret) => s.id;
const formatDateTime = (value: unknown) => toTimezoneDateTime(value as string, "Africa/Cairo") || "-";
const monoSx = { fontFamily: "var(--font-mono, monospace)", fontSize: 13 };

export default function SecretsPageContent() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Page resets to 0 whenever the search changes, without an effect.
  const [pageState, setPageState] = useState({ page: 0, search: "" });
  const page = pageState.search === debouncedSearch ? pageState.page : 0;

  const { data, error, isFetching } = useSecretsList({ page, size: pageSize, search: debouncedSearch });
  const items = data?.items ?? [];
  const errorMessage = error ? getErrorMessage(error, "Failed to fetch secrets.") : "";

  const openSecret = useCallback(
    (secret: Secret) => {
      if (secret?.id) navigate(`/secrets/${encodeURIComponent(secret.id)}`, { state: { name: secret.name } });
    },
    [navigate]
  );

  const fields = useMemo<WeaverDataField<Secret>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        getValue: (s) => s.name,
        searchable: true,
        width: 240,
        render: (val, s) => (
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={(e) => {
              e.stopPropagation();
              openSecret(s);
            }}
            sx={{
              ...monoSx,
              fontWeight: 600,
              textAlign: "left",
              color: "var(--color-fg-default)",
              "&:hover": {
                color: "var(--color-fg-default)",
              },
            }}
          >
            {String(val || "-")}
          </Link>
        ),
      },
      {
        key: "displayedText",
        label: "Value",
        getValue: (s) => s.displayedText,
        width: 170,
        render: (val) => (
          <Typography component="span" sx={{ ...monoSx, color: "text.secondary" }}>
            {String(val || "**********")}
          </Typography>
        ),
      },
      {
        key: "description",
        label: "Description",
        getValue: (s) => s.description,
        width: 280,
        render: (val) => String(val || "-"),
      },
      {
        key: "updatedAt",
        label: "Updated",
        getValue: (s) => s.updatedAt ?? s.createdAt,
        width: 220,
        render: (val, s) => {
          const by = s.updatedBy?.name || s.createdBy?.name;
          return by ? `${formatDateTime(val)} · ${by}` : formatDateTime(val);
        },
      },
      {
        key: "createdAt",
        label: "Created",
        getValue: (s) => s.createdAt,
        visibleByDefault: false,
        hideable: true,
        width: 200,
        render: (val) => formatDateTime(val),
      },
      {
        key: "createdBy",
        label: "Created by",
        getValue: (s) => s.createdBy?.name,
        visibleByDefault: false,
        hideable: true,
        width: 180,
        render: (val) => String(val || "-"),
      },
      {
        key: "actions",
        label: "",
        getValue: (s) => s.placeholder,
        width: 140,
        render: (val) => (val ? <CopyReferenceButton placeholder={String(val)} variant="button" /> : null),
      },
    ],
    [openSecret]
  );

  const toolbarActions = useMemo<WeaverDataAction<Secret>[]>(
    () => [
      {
        id: "new",
        label: "+ New Secret",
        asButton: true,
        buttonVariant: "contained",
        buttonColor: "primary",
        onClick: () => navigate("/secrets/new"),
      },
    ],
    [navigate]
  );

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const handlePaginationChange = useCallback(
    ({ page: nextPage, pageSize: nextPageSize }: { page: number; pageSize: number }) => {
      if (nextPageSize !== pageSize) {
        setPageSize(nextPageSize);
        setPageState({ page: 0, search: debouncedSearch });
      } else {
        setPageState({ page: nextPage, search: debouncedSearch });
      }
    },
    [debouncedSearch, pageSize]
  );

  return (
    <WeaverDataExplorer<Secret>
      records={items}
      getRecordId={getSecretId}
      fields={fields}
      storageKey="secrets_v1"
      defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
      dataMode="server"
      selectionMode="none"
      loading={isFetching}
      errorMessage={errorMessage || undefined}
      searchable
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search secrets by name..."
      stickyHeader
      toolbarActions={toolbarActions}
      pagination
      totalRecords={data?.total ?? 0}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      paginationModel={paginationModel}
      onPaginationChange={handlePaginationChange}
      onRecordClick={openSecret}
      height="calc(100vh - 220px)"
      emptyTitle="No secrets yet"
      emptyDescription="Store API keys and passwords once, then reference them in database and HTTP connections as ${weaver.secrets.name}."
    />
  );
}
