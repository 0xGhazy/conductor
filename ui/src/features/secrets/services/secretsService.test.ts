import { describe, expect, it } from "vitest";
import {
  buildCreatePayload,
  buildSecretPlaceholder,
  buildUpdatePayload,
  parseSecretPlaceholder,
  secretUsagePath,
  toSecretApiError,
  validateSecretForm,
} from "./secretsService";

const form = (overrides = {}) => ({ name: "", value: "", description: "", ...overrides });

describe("secretsService", () => {
  it("builds and parses references", () => {
    expect(buildSecretPlaceholder("db_pwd")).toBe("${weaver.secrets.db_pwd}");
    expect(parseSecretPlaceholder(" ${weaver.secrets.db_pwd} ")).toBe("db_pwd");
    expect(parseSecretPlaceholder("x${weaver.secrets.db_pwd}")).toBeNull();
    expect(parseSecretPlaceholder("plain")).toBeNull();
  });

  it("validates names with the backend rule on create", () => {
    expect(validateSecretForm(form({ value: "v" }), { isCreateMode: true, replacingValue: false }).name).toBe(
      "Name is required"
    );
    expect(
      validateSecretForm(form({ name: "1abc", value: "v" }), { isCreateMode: true, replacingValue: false }).name
    ).toBeTruthy();
    expect(
      validateSecretForm(form({ name: "api_key-2", value: "v" }), { isCreateMode: true, replacingValue: false })
    ).toEqual({});
  });

  it("requires a value on create and when replacing, but not for metadata-only edits", () => {
    expect(validateSecretForm(form({ name: "a" }), { isCreateMode: true, replacingValue: false }).value).toBeTruthy();
    expect(validateSecretForm(form(), { isCreateMode: false, replacingValue: true }).value).toBeTruthy();
    expect(validateSecretForm(form(), { isCreateMode: false, replacingValue: false })).toEqual({});
  });

  it("omits the value from updates unless it is being replaced", () => {
    const f = form({ value: "secret", description: " desc " });
    expect(buildUpdatePayload(f, { replacingValue: false, version: 3 })).toEqual({ description: "desc", version: 3 });
    expect(buildUpdatePayload(f, { replacingValue: true, version: 3 })).toEqual({
      value: "secret",
      description: "desc",
      version: 3,
    });
  });

  it("trims the name and drops an empty description on create", () => {
    expect(buildCreatePayload(form({ name: " key ", value: " v ", description: "  " }))).toEqual({
      name: "key",
      value: " v ",
      description: undefined,
    });
  });

  it("links usages to their definition pages", () => {
    expect(secretUsagePath({ type: "DATASOURCE", id: "1", name: "db" })).toBe("/databases/1");
    expect(secretUsagePath({ type: "HTTP_CONNECTION", id: "2", name: "api" })).toBe("/connections/2");
  });

  it("extracts the backend error code and reason", () => {
    const err = {
      response: { data: { code: "SECRET_IN_USE", reason: "In use", details: { usages: [] } } },
    };
    expect(toSecretApiError(err, "fallback")).toEqual({
      code: "SECRET_IN_USE",
      message: "In use",
      details: { usages: [] },
    });
    expect(toSecretApiError(new Error("boom"), "fallback").code).toBeUndefined();
  });
});
