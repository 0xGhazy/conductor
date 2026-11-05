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

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

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
import static org.junit.Assume.assumeTrue;

/**
 * Runs the audit log filters against real PostgreSQL, in a throwaway schema built from the
 * migrations (V19 table, V30 indexes), so nothing in the real log is read or changed.
 * Run with -Daudit.it.url=jdbc:postgresql://localhost:5432/conductor.
 */
public class PostgresAuditDAOFilterIT {

    private static final Instant T0 = Instant.parse("2026-11-04T10:00:00Z");
    private static final String ADMIN = "b4cc7258-ede7-4774-ad7b-9c798ee99cd1";
    private static final String OPERATOR = "47be396d-9277-4cee-9360-8011164fa350";
    private static final String QUERY_ID = "6f1c2a7e-0d2b-4b8e-9c1a-0000000000a2";

    private final String schema = "audit_it_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    private HikariDataSource dataSource;
    private PostgresAuditDAO dao;
    private String failedId;

    @Before
    public void setUp() throws Exception {
        String url = System.getProperty("audit.it.url");
        assumeTrue("set -Daudit.it.url to run", url != null && !url.isBlank());
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(System.getProperty("audit.it.username", "conductor"));
        config.setPassword(System.getProperty("audit.it.password", "conductor"));
        config.setMaximumPoolSize(2);
        config.setConnectionInitSql("SET search_path TO " + schema);
        try (HikariDataSource admin = new HikariDataSource(copy(config, null))) {
            execute(admin, "CREATE SCHEMA " + schema);
        }
        dataSource = new HikariDataSource(config);
        execute(dataSource, migration("V19__conductor_audit_log.sql"));
        execute(dataSource, migration("V30__audit_log_filter_indexes.sql"));
        dao = new PostgresAuditDAO(new RetryTemplate(), new ObjectMapper(), dataSource);

        // Five events, a minute apart; T0 + 4 min is the newest.
        log(0, e -> e.actorId(ADMIN).actorUsername("admin").actorName("Conductor Admin").action("createQuery")
                .resourceType("QUERY").resourceId(QUERY_ID).durationMs(6L).clientIp("10.20.4.17")
                .details(Map.of("name", "workflow-status-summary")));
        log(1, e -> e.actorId(OPERATOR).actorUsername("operator").actorName("Conductor Operator")
                .action("updateDatabase").resourceType("DATABASE").resourceId("db-1").durationMs(214L)
                .clientIp("10.20.4.22").details(Map.of("name", "conductor-db")));
        failedId = log(2, e -> e.actorId(ADMIN).actorUsername("admin").actorName("Conductor Admin")
                .action("startWorkflow").resourceType("WORKFLOW").resourceId("order-flow").durationMs(42L)
                .status(AuditEvent.STATUS_FAILED).errorMessage("Workflow definition not found").clientIp("10.20.4.17"));
        log(3, e -> e.actorId(ADMIN).actorUsername("admin").actorName("Conductor Admin").action("updateQuery")
                .resourceType("QUERY").resourceId(QUERY_ID).durationMs(18L).clientIp("10.20.4.17")
                .details(Map.of("name", "workflow-status-summary")));
        log(4, e -> e.actorName("system").action("searchWorkflows").resourceType("WORKFLOW")
                .resourceId("startTime:DESC").clientIp("0:0:0:0:0:0:0:1"));
    }

    @After
    public void tearDown() throws Exception {
        if (dataSource != null) {
            execute(dataSource, "DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            dataSource.close();
        }
    }

    @Test
    public void singleFilters() {
        assertEquals(List.of(3, 0), minutes(q().resourceType("QUERY")));
        assertEquals(List.of(2), minutes(q().status("FAILED")));
        assertEquals(List.of(1), minutes(q().action("updateDatabase")));
        assertEquals(List.of(3, 2, 0), minutes(q().actorId(ADMIN)));
        assertEquals(List.of(3, 0), minutes(q().resourceId(QUERY_ID)));
        assertEquals(List.of(2), minutes(q().eventId(failedId)));
        assertEquals(List.of(1), minutes(q().clientIp("10.20.4.22")));
    }

    @Test
    public void severalValuesAreOrAndCategoriesAreAnd() {
        assertEquals(List.of(4, 3, 2, 0), minutes(q().resourceType("QUERY").resourceType("WORKFLOW")));
        assertEquals(List.of(3, 0), minutes(q().resourceType("QUERY").resourceType("WORKFLOW").actorId(ADMIN)
                .status("SUCCESS")));
        assertEquals(List.of(3, 0), minutes(q().action("createQuery").action("updateQuery")));
        assertEquals(List.of(), minutes(q().resourceType("DATABASE").actorId(ADMIN)));
    }

    @Test
    public void searchIsPartialForTextAndExactForIds() {
        assertEquals(List.of(3, 0), minutes(q().search("STATUS-summ"))); // resource name, any case
        assertEquals(List.of(1), minutes(q().search("operat"))); // actor username / name
        assertEquals(List.of(2), minutes(q().search("definition not"))); // error
        assertEquals(List.of(3, 0), minutes(q().search("6f1c2a7e"))); // resource id prefix
        assertEquals(List.of(), minutes(q().search("0000000000a2"))); // not a prefix
        assertEquals(List.of(2), minutes(q().search(failedId))); // event id
        assertEquals(List.of(1), minutes(q().search("10.20.4.22"))); // client IP, exact
        assertEquals(List.of(), minutes(q().search("10.20.4"))); // not a whole IP
        assertEquals(List.of(), minutes(q().search("%"))); // wildcards are literal
        assertEquals(List.of(1), minutes(q().actor("OPERATOR"))); // the advanced actor filter
    }

    @Test
    public void timeBoundsIncludeFromAndExcludeTo() {
        assertEquals(List.of(3, 2, 1),
                minutes(q().from(T0.plusSeconds(60)).to(T0.plusSeconds(240))));
    }

    @Test
    public void durationRangeIsInclusiveAndSkipsUnknownDurations() {
        assertEquals(List.of(3, 2), minutes(q().minDurationMs(18L).maxDurationMs(42L)));
        assertEquals(List.of(1), minutes(q().minDurationMs(100L)));
    }

    @Test
    public void sortsWithEmptyValuesLastAndPagesDoNotOverlap() {
        assertEquals(List.of(1, 2, 3, 0, 4),
                minutes(q().sort(AuditEventQuery.SortField.DURATION))); // 214, 42, 18, 6, none
        assertEquals(List.of(0, 1, 2, 3, 4), minutes(q().ascending(true)));
        assertEquals(List.of(4, 1, 3, 2, 0), minutes(q().sort(AuditEventQuery.SortField.ACTOR).ascending(false)));

        AuditEventQuery all = q().build();
        assertEquals(5, dao.countAuditEvents(all));
        List<AuditEvent> first = dao.searchAuditEvents(all, 0, 2);
        List<AuditEvent> second = dao.searchAuditEvents(all, 2, 2);
        List<AuditEvent> third = dao.searchAuditEvents(all, 4, 2);
        assertEquals(List.of(4, 3), minutesOf(first));
        assertEquals(List.of(2, 1), minutesOf(second));
        assertEquals(List.of(0), minutesOf(third));
    }

    @Test
    public void countsEventsPerBucketWithTheFailedShare() {
        long origin = T0.toEpochMilli();
        long twoMinutes = 120_000;
        List<com.vodafone.vss.weaver.common.audit.AuditHistogramBucket> buckets =
                dao.getAuditHistogram(q().build(), origin, twoMinutes);
        assertEquals(List.of(
                new com.vodafone.vss.weaver.common.audit.AuditHistogramBucket(origin, 2, 0),
                new com.vodafone.vss.weaver.common.audit.AuditHistogramBucket(origin + twoMinutes, 2, 1),
                new com.vodafone.vss.weaver.common.audit.AuditHistogramBucket(origin + 2 * twoMinutes, 1, 0)), buckets);

        // The same filters as the list.
        assertEquals(List.of(new com.vodafone.vss.weaver.common.audit.AuditHistogramBucket(origin + twoMinutes, 1, 1)),
                dao.getAuditHistogram(q().status("FAILED").build(), origin, twoMinutes));
    }

    @Test
    public void listRowsCarryTheRecordedResourceNameButNotTheDetails() {
        AuditEvent row = dao.searchAuditEvents(q().action("updateQuery").build(), 0, 1).get(0);
        assertEquals("workflow-status-summary", row.getResourceName());
        assertEquals(null, row.getDetails());
        assertEquals(null, dao.searchAuditEvents(q().action("startWorkflow").build(), 0, 1).get(0).getResourceName());
    }

    @Test
    public void emptyResultsCountZero() {
        AuditEventQuery none = q().search("no-such-thing").build();
        assertEquals(0, dao.countAuditEvents(none));
        assertEquals(List.of(), dao.searchAuditEvents(none, 0, 20));
    }

    // -------------------------------------------------------------------------------------------

    private static AuditEventQuery.AuditEventQueryBuilder q() {
        return AuditEventQuery.builder();
    }

    private List<Integer> minutes(AuditEventQuery.AuditEventQueryBuilder query) {
        return minutesOf(dao.searchAuditEvents(query.build(), 0, 50));
    }

    private static List<Integer> minutesOf(List<AuditEvent> events) {
        return events.stream().map(e -> (int) ((e.getTimestamp() - T0.toEpochMilli()) / 60_000)).toList();
    }

    private String log(int minute, Consumer<AuditEvent.AuditEventBuilder> event) {
        AuditEvent.AuditEventBuilder builder = AuditEvent.builder()
                .id(UUID.randomUUID().toString())
                .timestamp(T0.plusSeconds(60L * minute).toEpochMilli())
                .status(AuditEvent.STATUS_SUCCESS);
        event.accept(builder);
        AuditEvent built = builder.build();
        dao.log(built);
        return built.getId();
    }

    private static String migration(String name) throws IOException {
        try (InputStream in = PostgresAuditDAOFilterIT.class.getResourceAsStream("/db/migration_postgres/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void execute(javax.sql.DataSource dataSource, String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static HikariConfig copy(HikariConfig config, String initSql) {
        HikariConfig copy = new HikariConfig();
        copy.setJdbcUrl(config.getJdbcUrl());
        copy.setUsername(config.getUsername());
        copy.setPassword(config.getPassword());
        copy.setMaximumPoolSize(1);
        copy.setConnectionInitSql(initSql);
        return copy;
    }
}
