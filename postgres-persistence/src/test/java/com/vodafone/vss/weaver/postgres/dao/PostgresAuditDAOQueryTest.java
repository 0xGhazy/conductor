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
package com.vodafone.vss.weaver.postgres.dao;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.junit.Test;

import com.vodafone.vss.weaver.common.audit.AuditEventQuery;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class PostgresAuditDAOQueryTest {

    @Test
    public void noFiltersMatchesEverything() {
        PostgresAuditDAO.Where where = PostgresAuditDAO.where(AuditEventQuery.builder().search("  ").build());

        assertEquals(" WHERE 1=1", where.sql());
        assertTrue(where.params().isEmpty());
    }

    @Test
    public void eachFilterAddsOneBoundCondition() {
        Instant from = Instant.parse("2026-11-04T00:00:00Z");
        Instant to = Instant.parse("2026-11-05T00:00:00Z");
        PostgresAuditDAO.Where where = PostgresAuditDAO.where(AuditEventQuery.builder()
                .resourceType("WORKFLOW").status("FAILED").action("startWorkflow").from(from).to(to).build());

        assertEquals(" WHERE 1=1 AND resource_type = ? AND status = ? AND action = ?"
                + " AND created_at >= ? AND created_at < ?", where.sql());
        assertEquals(List.of("WORKFLOW", "FAILED", "startWorkflow", Timestamp.from(from), Timestamp.from(to)),
                where.params());
    }

    @Test
    public void severalValuesOfOneFilterAreOrAndCategoriesAreAnd() {
        PostgresAuditDAO.Where where = PostgresAuditDAO.where(AuditEventQuery.builder()
                .status("SUCCESS").status("FAILED").status(" ")
                .resourceTypes(List.of("QUERY", "DATABASE", "QUERY"))
                .build());

        assertEquals(" WHERE 1=1 AND resource_type IN (?, ?) AND status IN (?, ?)", where.sql());
        assertEquals(List.of("QUERY", "DATABASE", "SUCCESS", "FAILED"), where.params());
    }

    @Test
    public void searchMatchesPartsExactIdsAndResourceIdPrefixesAndIsNeverConcatenated() {
        PostgresAuditDAO.Where where = PostgresAuditDAO.where(
                AuditEventQuery.builder().search(" x' OR '1'='1 ").build());

        for (String column : List.of("action", "actor_username", "actor_name", "actor_email",
                "details->>'name'", "error_message", "resource_id")) {
            assertTrue(where.sql(), where.sql().contains(column + " ILIKE ? ESCAPE '\\'"));
        }
        assertTrue(where.sql().contains("id = ? OR client_ip = ?"));
        assertFalse(where.sql().contains("OR '1'"));
        assertEquals(9, where.params().size());
        assertEquals("%x' OR '1'='1%", where.params().get(0)); // contains
        assertEquals("x' OR '1'='1%", where.params().get(6)); // resource id: starts with
        assertEquals("x' OR '1'='1", where.params().get(7)); // event id: exact
        assertEquals("x' OR '1'='1", where.params().get(8)); // client IP: exact
    }

    @Test
    public void advancedFiltersAreExactExceptTheActorText() {
        PostgresAuditDAO.Where where = PostgresAuditDAO.where(AuditEventQuery.builder()
                .actorId("b4cc7258-ede7-4774-ad7b-9c798ee99cd1").actor("adm_n").resourceId("q-1")
                .eventId("6f1c2a7e-0d2b-4b8e-9c1a-0000000000a2").clientIp("10.20.4.17")
                .minDurationMs(10L).maxDurationMs(500L).build());

        assertEquals(" WHERE 1=1 AND actor_id = ?"
                + " AND (actor_username ILIKE ? ESCAPE '\\' OR actor_name ILIKE ? ESCAPE '\\'"
                + " OR actor_email ILIKE ? ESCAPE '\\')"
                + " AND resource_id = ? AND id = ? AND client_ip = ?"
                + " AND duration_ms >= ? AND duration_ms <= ?", where.sql());
        assertEquals(List.of("b4cc7258-ede7-4774-ad7b-9c798ee99cd1", "%adm\\_n%", "%adm\\_n%", "%adm\\_n%", "q-1",
                "6f1c2a7e-0d2b-4b8e-9c1a-0000000000a2", "10.20.4.17", 10L, 500L), where.params());
    }

    @Test
    public void ordersNewestFirstWithATieBreakerByDefault() {
        assertEquals(" ORDER BY created_at DESC, id DESC", PostgresAuditDAO.orderBy(AuditEventQuery.builder().build()));
        assertEquals(" ORDER BY created_at ASC, id ASC",
                PostgresAuditDAO.orderBy(AuditEventQuery.builder().ascending(true).build()));
    }

    @Test
    public void otherSortsPutEmptyValuesLastThenNewestFirst() {
        assertEquals(" ORDER BY duration_ms DESC NULLS LAST, created_at DESC, id DESC",
                PostgresAuditDAO.orderBy(AuditEventQuery.builder().sort(AuditEventQuery.SortField.DURATION).build()));
        assertEquals(" ORDER BY COALESCE(actor_name, actor_username, actor_id) ASC NULLS LAST, created_at DESC, id DESC",
                PostgresAuditDAO.orderBy(AuditEventQuery.builder()
                        .sort(AuditEventQuery.SortField.ACTOR).ascending(true).build()));
    }

    @Test
    public void wildcardsInSearchMatchLiterally() {
        assertEquals("100\\%\\_done\\\\", PostgresAuditDAO.escapeLike("100%_done\\"));
    }
}
