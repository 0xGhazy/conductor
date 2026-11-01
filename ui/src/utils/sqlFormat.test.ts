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
    const formatted = formatSql("SELECT * FROM #{S:SCHEMA}.users WHERE x = ${weaver.env.LIMIT}");
    expect(formatted).toContain("#{S:SCHEMA}.users");
    expect(formatted).toContain("${weaver.env.LIMIT}");
  });

  it("never changes string literals", () => {
    expect(formatSql("SELECT 'a   #{x}   b' FROM t")).toContain("'a   #{x}   b'");
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
