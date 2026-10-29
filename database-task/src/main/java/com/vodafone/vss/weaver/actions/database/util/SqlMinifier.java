/*
 * Copyright 2026 Weaver Contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.vodafone.vss.weaver.actions.database.util;

/**
 * Minifies SQL for storage: collapses whitespace to single spaces and removes comments, never touching the content
 * of string literals, quoted identifiers, or dollar-quoted bodies.
 */
public final class SqlMinifier {

    private SqlMinifier() {}

    public static String minify(String sql) {
        if (sql == null || sql.isBlank()) {
            return sql == null ? null : "";
        }
        StringBuilder out = new StringBuilder(sql.length());
        int n = sql.length();
        int i = 0;
        boolean pendingSpace = false;

        while (i < n) {
            char c = sql.charAt(i);

            if (Character.isWhitespace(c)) {
                pendingSpace = true;
                i++;
                continue;
            }

            // -- line comment (dropped)
            if (c == '-' && next(sql, i) == '-') {
                int end = sql.indexOf('\n', i);
                i = end < 0 ? n : end + 1;
                pendingSpace = true;
                continue;
            }

            // /* block comment */ (dropped) or /*+ hint */ (kept)
            if (c == '/' && next(sql, i) == '*') {
                int end = sql.indexOf("*/", i + 2);
                if (end < 0) { // unterminated: keep the rest verbatim
                    appendToken(out, sql.substring(i), pendingSpace);
                    break;
                }
                if (i + 2 < n && sql.charAt(i + 2) == '+') {
                    appendToken(out, sql.substring(i, end + 2), pendingSpace);
                    pendingSpace = false;
                } else {
                    pendingSpace = true;
                }
                i = end + 2;
                continue;
            }

            // #{placeholder} (kept) or # up to end of line (kept with its line break)
            if (c == '#') {
                if (next(sql, i) == '{') {
                    int end = sql.indexOf('}', i);
                    int stop = end < 0 ? n : end + 1;
                    appendToken(out, sql.substring(i, stop), pendingSpace);
                    pendingSpace = false;
                    i = stop;
                } else {
                    int end = sql.indexOf('\n', i);
                    int stop = end < 0 ? n : end + 1;
                    appendToken(out, sql.substring(i, stop), pendingSpace);
                    pendingSpace = false;
                    i = stop;
                }
                continue;
            }

            // Oracle alternative quoting: q'[...]', q'{...}', q'<...>', q'(...)', q'!...!'
            if ((c == 'q' || c == 'Q') && next(sql, i) == '\'' && i + 2 < n && !isIdentifierChar(prev(sql, i))) {
                char open = sql.charAt(i + 2);
                char close = switch (open) {
                    case '[' -> ']';
                    case '{' -> '}';
                    case '<' -> '>';
                    case '(' -> ')';
                    default -> open;
                };
                int end = sql.indexOf(close + "'", i + 3);
                int stop = end < 0 ? n : end + 2;
                appendToken(out, sql.substring(i, stop), pendingSpace);
                pendingSpace = false;
                i = stop;
                continue;
            }

            // 'string', "identifier", `identifier`
            if (c == '\'' || c == '"' || c == '`') {
                int stop = endOfQuoted(sql, i, c);
                appendToken(out, sql.substring(i, stop), pendingSpace);
                pendingSpace = false;
                i = stop;
                continue;
            }

            // $$body$$ or $tag$body$tag$ (not $1 parameters or ${...} placeholders)
            if (c == '$') {
                int tagEnd = dollarTagEnd(sql, i);
                if (tagEnd > 0) {
                    String tag = sql.substring(i, tagEnd + 1);
                    int close = sql.indexOf(tag, tagEnd + 1);
                    int stop = close < 0 ? n : close + tag.length();
                    appendToken(out, sql.substring(i, stop), pendingSpace);
                    pendingSpace = false;
                    i = stop;
                    continue;
                }
            }

            if (pendingSpace) {
                appendSpace(out);
            }
            pendingSpace = false;
            out.append(c);
            i++;
        }
        return out.toString();
    }

    private static int endOfQuoted(String sql, int start, char quote) {
        int n = sql.length();
        int i = start + 1;
        while (i < n) {
            char c = sql.charAt(i);
            if (c == '\\' && quote != '`') {
                i += 2;
                continue;
            }
            if (c == quote) {
                if (i + 1 < n && sql.charAt(i + 1) == quote) {
                    i += 2;
                    continue;
                }
                return i + 1;
            }
            i++;
        }
        return n;
    }

    private static int dollarTagEnd(String sql, int start) {
        if (isIdentifierChar(prev(sql, start))) {
            return -1;
        }
        int n = sql.length();
        int i = start + 1;
        if (i < n && Character.isDigit(sql.charAt(i))) {
            return -1;
        }
        while (i < n && (Character.isLetterOrDigit(sql.charAt(i)) || sql.charAt(i) == '_')) {
            i++;
        }
        return i < n && sql.charAt(i) == '$' ? i : -1;
    }

    private static void appendToken(StringBuilder out, String token, boolean pendingSpace) {
        if (pendingSpace) {
            appendSpace(out);
        }
        out.append(token);
    }

    private static void appendSpace(StringBuilder out) {
        if (out.length() > 0 && out.charAt(out.length() - 1) != '\n') {
            out.append(' ');
        }
    }

    private static char next(String sql, int i) {
        return i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';
    }

    private static char prev(String sql, int i) {
        return i > 0 ? sql.charAt(i - 1) : '\0';
    }

    private static boolean isIdentifierChar(char c) {
        return Character.isLetterOrDigit(c) || c == '_';
    }
}

