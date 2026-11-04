import { describe, expect, it } from "vitest";
import { formatSql } from "./sqlFormat";

describe("formatSql", () => {
  it("formats minified SQL with named parameters and casts", () => {
    expect(formatSql("SELECT id, name FROM users WHERE status = :status AND t > :since::date")).toBe(
      ["SELECT", "  id,", "  name", "FROM", "  users", "WHERE", "  status = :status", "  AND t > :since::date"].join(
        "\n"
      )
    );
  });

  it("keeps Weaver placeholders exactly as written", () => {
    const formatted = formatSql(
      "SELECT * FROM ${weaver.env.SCHEMA:public}.users WHERE x = ${weaver.env.LIMIT} AND t = '${weaver.secrets.token}'"
    );
    expect(formatted).toContain("${weaver.env.SCHEMA:public}.users");
    expect(formatted).toContain("${weaver.env.LIMIT}");
    expect(formatted).toContain("'${weaver.secrets.token}'");
  });

  it("never changes string literals", () => {
    expect(formatSql("SELECT 'a   ${weaver.env.X}   b' FROM t")).toContain("'a   ${weaver.env.X}   b'");
  });

  it("returns unparseable SQL unchanged", () => {
    expect(formatSql("SELECT FROM WHERE ((")).toBe("SELECT FROM WHERE ((");
  });

  it("handles empty input", () => {
    expect(formatSql("")).toBe("");
    expect(formatSql(null)).toBe("");
    expect(formatSql(undefined)).toBe("");
  });
});
