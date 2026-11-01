import { formatDialect, postgresql } from "sql-formatter";

// Weaver variable placeholders (#{NAME}, #{S:NAME:default}, ${weaver.env.NAME}) are not SQL, so the formatter
// cannot parse them; they are swapped for plain identifiers while formatting and restored afterwards.
const PLACEHOLDER_PATTERN = /#\{[^}]*\}|\$\{[^}]*\}/g;
const MASK_PATTERN = /__weaver_ph_(\d+)__/g;

/**
 * Formats SQL for display and editing. The backend stores SQL minified, so editors call this on load.
 * Uses the PostgreSQL dialect (it understands `:name` parameters and `::type` casts). If the SQL cannot be parsed,
 * it is returned unchanged so editing is never blocked.
 */
export const formatSql = (sql: string | null | undefined): string => {
  if (!sql || !sql.trim()) return sql ?? "";

  const placeholders: string[] = [];
  const masked = sql.replace(PLACEHOLDER_PATTERN, (match) => {
    placeholders.push(match);
    return `__weaver_ph_${placeholders.length - 1}__`;
  });

  try {
    const formatted = formatDialect(masked, { dialect: postgresql, paramTypes: { named: [":"] } });
    return formatted.replace(MASK_PATTERN, (_, index: string) => placeholders[Number(index)] ?? "");
  } catch {
    return sql;
  }
};
