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

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class SqlMinifierTest {

    @Test
    void collapsesWhitespaceAndKeepsNamedParameters() {
        String sql = """
                SELECT id,
                       name
                FROM   users
                WHERE  status = :status
                  AND  created_at > :since::timestamp
                """;
        assertEquals(
                "SELECT id, name FROM users WHERE status = :status AND created_at > :since::timestamp",
                SqlMinifier.minify(sql));
    }

    @Test
    void removesLineAndBlockComments() {
        String sql = """
                -- active users only
                SELECT /* columns */ id
                FROM users -- trailing comment
                WHERE a = 1/*inline*/AND b = 2
                """;
        assertEquals("SELECT id FROM users WHERE a = 1 AND b = 2", SqlMinifier.minify(sql));
    }

    @Test
    void keepsOptimizerHints() {
        assertEquals(
                "SELECT /*+ INDEX(u idx_users) */ id FROM users u",
                SqlMinifier.minify("SELECT   /*+ INDEX(u idx_users) */\n  id FROM users u"));
    }

    @ParameterizedTest
    @CsvSource(
            delimiter = '|',
            value = {
                // whitespace and comment markers inside literals and quoted identifiers are untouched
                "SELECT 'a   b -- not a comment'   FROM t|SELECT 'a   b -- not a comment' FROM t",
                "SELECT \"Col  Name\" ,  `my   col` FROM t|SELECT \"Col  Name\" , `my   col` FROM t",
                "SELECT 'it''s   ok'  FROM t|SELECT 'it''s   ok' FROM t",
                "SELECT 'it\\'s   ok'  FROM t|SELECT 'it\\'s   ok' FROM t",
                "SELECT q'[it's   fine]'  FROM dual|SELECT q'[it's   fine]' FROM dual",
                "SELECT $$ a   b $$  ,  $fn$ x  -- y $fn$|SELECT $$ a   b $$ , $fn$ x  -- y $fn$",
                // $1 parameters and ${...} placeholders are not dollar quotes
                "SELECT  *  FROM t WHERE id = $1|SELECT * FROM t WHERE id = $1",
                "SELECT  *  FROM ${weaver.env.TABLE}   WHERE x = 1|SELECT * FROM ${weaver.env.TABLE} WHERE x = 1",
            })
    void neverChangesLiteralsOrQuotedNames(String input, String expected) {
        assertEquals(expected, SqlMinifier.minify(input));
    }

    @Test
    void keepsVariablePlaceholders() {
        assertEquals(
                "SELECT * FROM ${weaver.env.SCHEMA:public}.users WHERE token = '${weaver.secrets.api_token}' AND id = :id",
                SqlMinifier.minify(
                        "SELECT *\nFROM   ${weaver.env.SCHEMA:public}.users\nWHERE token = '${weaver.secrets.api_token}'\n  AND id = :id"));
    }

    @Test
    void keepsHashLinesWithTheirLineBreakSoMeaningCannotChange() {
        // MySQL '#' comment: the newline must survive or the next line would become part of the comment.
        assertEquals(
                "SELECT id # mysql comment\nFROM users",
                SqlMinifier.minify("SELECT   id # mysql comment\n   FROM users"));
    }

    @Test
    void unterminatedLiteralKeepsTheRestVerbatim() {
        assertEquals("SELECT 'oops   FROM   t", SqlMinifier.minify("SELECT   'oops   FROM   t"));
    }

    @Test
    void isIdempotent() {
        String sql = "SELECT /*+ X */ id, 'a  b' -- c\nFROM t # d\nWHERE x = :x";
        String once = SqlMinifier.minify(sql);
        assertEquals(once, SqlMinifier.minify(once));
    }

    @Test
    void handlesNullAndBlank() {
        assertNull(SqlMinifier.minify(null));
        assertEquals("", SqlMinifier.minify("   \n "));
    }
}

