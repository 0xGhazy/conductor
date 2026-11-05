import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import Button from "@mui/material/Button";
import { WeaverDataExplorer } from "@/components/common/data";
import type { WeaverDataField } from "@/components/common/data/WeaverDataExplorer/WeaverDataExplorer.types";
import Tag from "@/components/common/data/Tag/Tag";
import { getInitials } from "@/utils/user";
import {
  ROLES,
  SAMPLE_USERS,
  SettingsNotice,
  SettingsPage,
  keycloakAdminUrl,
  type SampleUser,
} from "@/features/settings";
import styles from "./SettingsPages.module.css";

const DEFAULT_VISIBLE_FIELDS = ["name", "username", "roles", "enabled"];
const getUserId = (user: SampleUser) => user.id;
const roleLabel = (name: string) => ROLES.find((role) => role.name === name)?.label ?? name;

export default function SettingsUsersPage() {
  const fields = useMemo<WeaverDataField<SampleUser>[]>(
    () => [
      {
        key: "name",
        label: "User",
        getValue: (user) => user.name,
        searchable: true,
        sortable: true,
        width: 280,
        render: (_value, user) => (
          <div className={styles.userCell}>
            <span className={styles.avatar} aria-hidden="true">
              {getInitials(user.name)}
            </span>
            <span className={styles.userText}>
              <span className={styles.userName}>{user.name}</span>
              {user.email && <span className={styles.muted}>{user.email}</span>}
            </span>
          </div>
        ),
      },
      {
        key: "username",
        label: "Username",
        getValue: (user) => user.username,
        searchable: true,
        sortable: true,
        width: 220,
        render: (value) => <code className={styles.settingValue}>{String(value)}</code>,
      },
      {
        key: "roles",
        label: "Roles",
        getValue: (user) => user.roles.map(roleLabel).join(", "),
        searchable: true,
        width: 280,
        render: (_value, user) => (
          <div className={styles.tagList}>
            {user.roles.map((role) => (
              <Tag key={role} text={roleLabel(role)} />
            ))}
          </div>
        ),
      },
      {
        key: "enabled",
        label: "Status",
        getValue: (user) => (user.enabled ? "Enabled" : "Disabled"),
        type: "enum",
        options: [
          { label: "Enabled", value: "Enabled" },
          { label: "Disabled", value: "Disabled" },
        ],
        width: 120,
        render: (value) => (
          <span className={styles.status}>
            <span
              className={`${styles.statusDot} ${value === "Enabled" ? styles.statusDotOn : ""}`}
              aria-hidden="true"
            />
            {String(value)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <SettingsPage
      sectionId="users"
      actions={
        <Button
          component="a"
          variant="outlined"
          size="small"
          startIcon={<ExternalLink size={14} aria-hidden />}
          href={keycloakAdminUrl("users")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Manage users in Keycloak
        </Button>
      }
    >
      <SettingsNotice title="Sample data">
        Weaver can’t list users from Keycloak yet, so this table shows the users from the default
        realm setup as an example. Add users, reset passwords and assign roles in the Keycloak admin
        console.
      </SettingsNotice>

      <WeaverDataExplorer<SampleUser>
        records={SAMPLE_USERS}
        getRecordId={getUserId}
        fields={fields}
        storageKey="settings_users"
        defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
        dataMode="client"
        selectionMode="none"
        searchable
        searchPlaceholder="Search users..."
        stickyHeader
        height="calc(100vh - 330px)"
        emptyTitle="No users match"
        emptyDescription="Try another search or clear the filters."
      />
    </SettingsPage>
  );
}
