import type { ComponentType } from "react";
import {
  ArrowRightLeft,
  Fingerprint,
  Languages,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";

/** One page (or a group of pages) in the Settings area. */
export interface SettingsNavItem {
  id: string;
  label: string;
  /** Route of the page; groups have no page of their own. */
  path?: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  /** Shown under the page title. */
  description?: string;
  children?: SettingsNavItem[];
}

export const SETTINGS_ROOT_PATH = "/settings";

/**
 * The Settings navigation tree. Single source for the Settings sidebar, the header
 * breadcrumbs and each page's title and description.
 */
export const SETTINGS_NAVIGATION: SettingsNavItem[] = [
  {
    id: "migrations",
    label: "Migrations",
    path: "/settings/migrations",
    icon: ArrowRightLeft,
    description:
      "Convert workflows saved in the old designer format into the current workflow structure, then import them.",
  },
  {
    id: "configurations",
    label: "Configurations",
    path: "/settings/configurations",
    icon: SlidersHorizontal,
    description:
      "Server settings that tune limits, timeouts and caches, and whether a change applies live or after a restart.",
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    path: "/settings/audit-logs",
    icon: ScrollText,
    description:
      "Who did what and when: every audited operation, its outcome and duration. Select an event to see its details.",
  },
  {
    id: "identity",
    label: "Identity",
    icon: Fingerprint,
    children: [
      {
        id: "users",
        label: "Users",
        path: "/settings/identity/users",
        icon: Users,
        description: "People who can sign in to Weaver and the roles they hold.",
      },
      {
        id: "roles",
        label: "Roles & Permissions",
        path: "/settings/identity/roles",
        icon: ShieldCheck,
        description: "What each role is allowed to do in Weaver.",
      },
    ],
  },
  {
    id: "languages",
    label: "Languages",
    path: "/settings/languages",
    icon: Languages,
    description:
      "Supported languages for workflow localization and translation message templates.",
  },
];

/** The default Settings page. */
export const SETTINGS_DEFAULT_PATH = "/settings/migrations";

const isOnPath = (pathname: string, path?: string) =>
  Boolean(path) && (pathname === path || pathname.startsWith(`${path}/`));

/** The chain of items leading to the page at `pathname` (e.g. Identity → Users), or []. */
export function findSettingsTrail(
  pathname: string,
  items: SettingsNavItem[] = SETTINGS_NAVIGATION
): SettingsNavItem[] {
  for (const item of items) {
    if (isOnPath(pathname, item.path)) return [item];
    if (item.children) {
      const childTrail = findSettingsTrail(pathname, item.children);
      if (childTrail.length) return [item, ...childTrail];
    }
  }
  return [];
}

/** The item with this id anywhere in the tree. */
export function findSettingsItem(
  id: string,
  items: SettingsNavItem[] = SETTINGS_NAVIGATION
): SettingsNavItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const child = item.children && findSettingsItem(id, item.children);
    if (child) return child;
  }
  return undefined;
}

/** True when `pathname` belongs to the Settings area. */
export const isSettingsAreaPath = (pathname: string) =>
  findSettingsTrail(pathname).length > 0 ||
  pathname === SETTINGS_ROOT_PATH ||
  pathname === `${SETTINGS_ROOT_PATH}/`;
