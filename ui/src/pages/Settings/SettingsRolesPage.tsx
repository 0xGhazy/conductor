import { Check, ExternalLink, Minus } from "lucide-react";
import Button from "@mui/material/Button";
import { PERMISSIONS, ROLES, SettingsNotice, SettingsPage, keycloakAdminUrl } from "@/features/settings";
import styles from "./SettingsPages.module.css";

export default function SettingsRolesPage() {
  return (
    <SettingsPage
      sectionId="roles"
      actions={
        <Button
          component="a"
          variant="outlined"
          size="small"
          startIcon={<ExternalLink size={14} aria-hidden />}
          href={keycloakAdminUrl("roles")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Manage roles in Keycloak
        </Button>
      }
    >
      <SettingsNotice title="Defined by the server">
        These rules are part of the server’s security configuration and apply when{" "}
        <code>conductor.security.enabled=true</code>. The role names shown are the defaults
        (<code>conductor.security.admin-role</code> and so on). Users get roles in Keycloak.
      </SettingsNotice>

      <ul className={styles.roleGrid} aria-label="Roles">
        {ROLES.map((role) => (
          <li key={role.id} className={styles.roleCard}>
            <span className={styles.roleLabel}>{role.label}</span>
            <code className={styles.settingValue}>{role.name}</code>
            <p className={styles.roleDescription}>{role.description}</p>
          </li>
        ))}
      </ul>

      <div className={styles.matrixWrapper}>
        <table className={styles.matrix}>
          <caption className={styles.visuallyHidden}>Permissions by role</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.permissionHeader}>
                Permission
              </th>
              {ROLES.map((role) => (
                <th key={role.id} scope="col" className={styles.roleHeader}>
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((permission) => (
              <tr key={permission.id}>
                <th scope="row" className={styles.permissionCell}>
                  <div className={styles.permissionText}>
                    <span className={styles.permissionLabel}>{permission.label}</span>
                    <code className={styles.permissionScope}>{permission.scope}</code>
                    {permission.note && <span className={styles.permissionNote}>{permission.note}</span>}
                  </div>
                </th>
                {ROLES.map((role) => {
                  const allowed = permission.roles.includes(role.id);
                  return (
                    <td key={role.id} className={styles.grantCell}>
                      {allowed ? (
                        <Check size={16} className={styles.granted} aria-label="Allowed" />
                      ) : (
                        <Minus size={16} className={styles.denied} aria-label="Not allowed" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsPage>
  );
}
