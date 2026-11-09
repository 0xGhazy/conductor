import { describe, it, expect } from "vitest";
import { findSettingsItem, findSettingsTrail, isSettingsAreaPath } from "../navigation/settingsNavigation";

describe("settings navigation", () => {
  it("finds the trail to a page inside a group", () => {
    expect(findSettingsTrail("/settings/identity/users").map((item) => item.id)).toEqual(["identity", "users"]);
    expect(findSettingsTrail("/settings/identity/roles").map((item) => item.label)).toEqual([
      "Identity",
      "Roles & Permissions",
    ]);
  });

  it("finds top-level pages", () => {
    expect(findSettingsTrail("/settings/migrations").map((item) => item.id)).toEqual(["migrations"]);
    expect(findSettingsTrail("/settings/configurations").map((item) => item.id)).toEqual(["configurations"]);
    expect(findSettingsTrail("/settings/languages").map((item) => item.id)).toEqual(["languages"]);
  });

  it("ignores paths outside the Settings area", () => {
    expect(findSettingsTrail("/queries")).toEqual([]);
    expect(findSettingsTrail("/caching")).toEqual([]);
    expect(isSettingsAreaPath("/queries")).toBe(false);
    expect(isSettingsAreaPath("/caching")).toBe(false);
    expect(isSettingsAreaPath("/settings/languages")).toBe(true);
    expect(isSettingsAreaPath("/settings")).toBe(true);
  });

  it("gives every page a title and description", () => {
    for (const id of ["migrations", "configurations", "users", "roles", "languages"]) {
      const item = findSettingsItem(id);
      expect(item?.label).toBeTruthy();
      expect(item?.description).toBeTruthy();
      expect(item?.path).toMatch(/^\/settings\//);
    }
  });
});
