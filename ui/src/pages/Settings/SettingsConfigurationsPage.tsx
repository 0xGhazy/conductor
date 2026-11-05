import { useMemo } from "react";
import { WeaverDataExplorer } from "@/components/common/data";
import type { WeaverDataField } from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import Tag from "@/components/common/data/Tag/Tag";
import {
  CONFIGURATION_CATALOG,
  SettingsNotice,
  SettingsPage,
  type ConfigurationEntry,
} from "@/features/settings";
import styles from "./SettingsPages.module.css";

const GROUPS = Array.from(new Set(CONFIGURATION_CATALOG.map((entry) => entry.group)));
const DEFAULT_VISIBLE_FIELDS = ["key", "value", "applies", "group", "description"];
const getKey = (entry: ConfigurationEntry) => entry.key;

export default function SettingsConfigurationsPage() {
  const fields = useMemo<WeaverDataField<ConfigurationEntry>[]>(
    () => [
      {
        key: "key",
        label: "Setting",
        getValue: (entry) => entry.key,
        searchable: true,
        sortable: true,
        width: 330,
        render: (value) => <code className={styles.settingKey}>{String(value)}</code>,
      },
      {
        key: "value",
        label: "Default",
        getValue: (entry) => entry.value,
        searchable: true,
        width: 110,
        render: (value) => <code className={styles.settingValue}>{String(value)}</code>,
      },
      {
        key: "type",
        label: "Type",
        getValue: (entry) => entry.type,
        visibleByDefault: false,
        hideable: true,
        width: 110,
      },
      {
        key: "applies",
        label: "Applies",
        getValue: (entry) => entry.applies,
        type: "enum",
        options: [
          { label: "Live", value: "Live" },
          { label: "After restart", value: "Restart" },
        ],
        sortable: true,
        width: 130,
        render: (value) =>
          value === "Live" ? (
            <Tag text="Live" color="var(--color-status-success)" borderColor="var(--color-status-success)" />
          ) : (
            <Tag text="After restart" color="var(--color-status-warn)" borderColor="var(--color-status-warn)" />
          ),
      },
      {
        key: "group",
        label: "Group",
        getValue: (entry) => entry.group,
        type: "enum",
        options: GROUPS.map((group) => ({ label: group, value: group })),
        sortable: true,
        width: 150,
      },
      {
        key: "description",
        label: "Description",
        getValue: (entry) => entry.description,
        searchable: true,
        width: 360,
        render: (value) => <span className={styles.muted}>{String(value)}</span>,
      },
    ],
    []
  );

  return (
    <SettingsPage sectionId="configurations">
      <SettingsNotice title="Read-only preview">
        These are the settings and their defaults from the server code. The server can’t change
        them at runtime yet, so they can’t be edited here; set them in <code>application.properties</code> or
        as environment variables.
      </SettingsNotice>

      <WeaverDataExplorer<ConfigurationEntry>
        records={CONFIGURATION_CATALOG}
        getRecordId={getKey}
        fields={fields}
        storageKey="settings_configurations"
        defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
        dataMode="client"
        selectionMode="none"
        searchable
        searchPlaceholder="Search settings..."
        stickyHeader
        height="calc(100vh - 330px)"
        emptyTitle="No settings match"
        emptyDescription="Try another search or clear the filters."
      />
    </SettingsPage>
  );
}
