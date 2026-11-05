import { config } from "@/config/appConfig";

/** Link into the Keycloak admin console for this app's realm (users or realm roles). */
export const keycloakAdminUrl = (section: "users" | "roles"): string => {
  const base = String(config.keycloak?.url || "").replace(/\/+$/, "");
  const realm = encodeURIComponent(config.keycloak?.realm || "weaver");
  return `${base}/admin/master/console/#/${realm}/${section}`;
};
