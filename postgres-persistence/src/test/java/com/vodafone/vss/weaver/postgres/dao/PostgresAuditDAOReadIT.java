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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.audit.AuditEventQuery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

/**
 * Runs the audit read queries against a real Conductor database (read-only). Skipped unless:
 * -Daudit.it.url=jdbc:postgresql://localhost:5432/conductor -Daudit.it.username=... -Daudit.it.password=...
 */
public class PostgresAuditDAOReadIT {

    private HikariDataSource dataSource;
    private PostgresAuditDAO dao;

    @Before
    public void setUp() {
        String url = System.getProperty("audit.it.url");
        assumeTrue("set -Daudit.it.url to run", url != null && !url.isBlank());
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(System.getProperty("audit.it.username", "conductor"));
        config.setPassword(System.getProperty("audit.it.password", "conductor"));
        config.setReadOnly(true);
        config.setMaximumPoolSize(1);
        dataSource = new HikariDataSource(config);
        dao = new PostgresAuditDAO(new RetryTemplate(), new ObjectMapper(), dataSource);
    }

    @After
    public void tearDown() {
        if (dataSource != null) {
            dataSource.close();
        }
    }

    @Test
    public void readsPagesCountsDetailsAndFacets() {
        AuditEventQuery all = AuditEventQuery.builder().build();
        long total = dao.countAuditEvents(all);
        List<AuditEvent> page = dao.searchAuditEvents(all, 0, 5);
        assertTrue(page.size() <= 5);
        if (total == 0) {
            return;
        }
        // newest first, no details in lists
        for (int i = 1; i < page.size(); i++) {
            assertTrue(page.get(i - 1).getTimestamp() >= page.get(i).getTimestamp());
        }
        assertTrue(page.stream().allMatch(e -> e.getDetails() == null));

        AuditEvent first = page.get(0);
        assertEquals(first.getId(), dao.getAuditEvent(first.getId()).orElseThrow().getId());

        AuditEventQuery byType = AuditEventQuery.builder().resourceType(first.getResourceType())
                .search(first.getAction().substring(0, 3)).from(Instant.now().minus(3650, ChronoUnit.DAYS)).build();
        assertTrue(dao.countAuditEvents(byType) >= 1);
        assertEquals(0, dao.countAuditEvents(AuditEventQuery.builder().search("%_no_such_%").build()));

        Map<String, List<String>> facets = dao.getAuditFacets();
        assertTrue(facets.get("resourceTypes").contains(first.getResourceType()));
    }
}
