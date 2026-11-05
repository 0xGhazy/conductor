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
package com.vodafone.vss.weaver.rest.controllers;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.Before;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.audit.AuditEventQuery;
import com.vodafone.vss.weaver.dao.AuditDAO;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class AuditLogResourceTest {

    private AuditDAO auditDAO;
    private MockMvc mockMvc;

    @Before
    public void setUp() {
        auditDAO = mock(AuditDAO.class);
        when(auditDAO.supportsQueries()).thenReturn(true);
        mockMvc = mvc(new AuditLogResource(auditDAO, true));
    }

    private static MockMvc mvc(AuditLogResource resource) {
        return MockMvcBuilders.standaloneSetup(DatabaseResourceTest.withMethodValidation(resource))
                .setControllerAdvice(new ValidationExceptionMapper(), new ApplicationExceptionMapper())
                .build();
    }

    @Test
    public void listsEventsWithFiltersAndPaging() throws Exception {
        AuditEvent event = AuditEvent.builder().id("e-1").action("startWorkflow").resourceType("WORKFLOW")
                .status("SUCCESS").actorName("Conductor Admin").timestamp(1_793_000_000_000L).build();
        when(auditDAO.searchAuditEvents(any(), eq(40), eq(20))).thenReturn(List.of(event));
        when(auditDAO.countAuditEvents(any())).thenReturn(41L);

        mockMvc.perform(get("/api/admin/audit")
                        .param("search", "start").param("resourceType", "WORKFLOW").param("status", "SUCCESS")
                        .param("from", "2026-11-04T00:00:00Z").param("actorId", "u-1").param("resourceId", "order-flow")
                        .param("page", "2").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].action").value("startWorkflow"))
                .andExpect(jsonPath("$.details.totalElements").value(41))
                .andExpect(jsonPath("$.details.totalPages").value(3));

        ArgumentCaptor<AuditEventQuery> query = ArgumentCaptor.forClass(AuditEventQuery.class);
        verify(auditDAO).searchAuditEvents(query.capture(), eq(40), eq(20));
        assertEquals("start", query.getValue().getSearch());
        assertEquals(List.of("WORKFLOW"), query.getValue().getResourceTypes());
        assertEquals(Instant.parse("2026-11-04T00:00:00Z"), query.getValue().getFrom());
        assertEquals("u-1", query.getValue().getActorId());
        assertEquals("order-flow", query.getValue().getResourceId());
    }

    private static final Instant NOW = Instant.parse("2026-11-05T12:00:00Z");

    private static AuditEventQuery query(String search, List<String> types, List<String> statuses,
            List<String> actions, String eventId, String clientIp, Long min, Long max, String from, String to,
            String sort) {
        return AuditLogResource.toQuery(search, types, statuses, actions, null, null, null, eventId, clientIp,
                min, max, from, to, sort, NOW);
    }

    @Test
    public void multiValueFiltersAcceptRepeatsAndCommasAndAreOrWithinACategory() throws Exception {
        when(auditDAO.searchAuditEvents(any(), anyInt(), anyInt())).thenReturn(List.of());
        mockMvc.perform(get("/api/admin/audit")
                        .param("status", "success").param("status", "FAILED")
                        .param("resourceType", "QUERY,DATABASE").param("action", "createQuery", "updateQuery"))
                .andExpect(status().isOk());

        ArgumentCaptor<AuditEventQuery> query = ArgumentCaptor.forClass(AuditEventQuery.class);
        verify(auditDAO).searchAuditEvents(query.capture(), eq(0), eq(20));
        assertEquals(List.of("SUCCESS", "FAILED"), query.getValue().getStatuses());
        assertEquals(List.of("QUERY", "DATABASE"), query.getValue().getResourceTypes());
        assertEquals(List.of("createQuery", "updateQuery"), query.getValue().getActions());
    }

    @Test
    public void searchesTheLast24HoursUnlessToldOtherwise() {
        assertEquals(NOW.minus(Duration.ofHours(24)), query(null, null, null, null, null, null, null, null, null, null, null).getFrom());
        assertNull(query(null, null, null, null, null, null, null, null, null, null, null).getTo());

        Instant to = Instant.parse("2026-10-01T00:00:00Z");
        assertEquals(to.minus(Duration.ofHours(24)),
                query(null, null, null, null, null, null, null, null, null, to.toString(), null).getFrom());

        // An event id is an exact lookup: no window.
        assertNull(query(null, null, null, null, "6f1c2a7e-0d2b-4b8e-9c1a-0000000000a2", null, null, null, null, null, null)
                .getFrom());
    }

    @Test
    public void sortsByAWhitelistedFieldNewestFirstByDefault() {
        AuditEventQuery byDefault = query(null, null, null, null, null, null, null, null, null, null, null);
        assertEquals(AuditEventQuery.SortField.TIMESTAMP, byDefault.getSort());
        assertFalse(byDefault.isAscending());

        AuditEventQuery byDuration = query(null, null, null, null, null, null, null, null, null, null, "durationMs,asc");
        assertEquals(AuditEventQuery.SortField.DURATION, byDuration.getSort());
        assertTrue(byDuration.isAscending());

        assertEquals(AuditEventQuery.SortField.ACTOR,
                query(null, null, null, null, null, null, null, null, null, null, "actor").getSort());
    }

    @Test
    public void rejectsInvalidFiltersInsteadOfIgnoringThem() throws Exception {
        String[][] invalid = {
            {"status", "DENIED"},
            {"resourceType", "QUERY; DROP TABLE x"},
            {"action", "a b"},
            {"eventId", "not-a-uuid"},
            {"clientIp", "localhost"},
            {"minDurationMs", "-1"},
            {"maxDurationMs", "abc"},
            {"sort", "error_message,desc"},
            {"sort", "timestamp,sideways"},
            {"search", "x".repeat(201)},
        };
        for (String[] param : invalid) {
            mockMvc.perform(get("/api/admin/audit").param(param[0], param[1]))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(get("/api/admin/audit").param("minDurationMs", "100").param("maxDurationMs", "10"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/audit")
                        .param("from", "2026-11-05T00:00:00Z").param("to", "2026-11-04T00:00:00Z"))
                .andExpect(status().isBadRequest());
        verify(auditDAO, never()).searchAuditEvents(any(), anyInt(), anyInt());
    }

    @Test
    public void acceptsExactIdentifiersInTheirFormats() {
        AuditEventQuery exact = query(null, null, null, null, "6F1C2A7E-0D2B-4B8E-9C1A-0000000000A2", " 10.20.4.17 ",
                0L, 0L, null, null, null);
        assertEquals("10.20.4.17", exact.getClientIp());
        assertEquals(0L, exact.getMaxDurationMs().longValue());
        assertEquals("0:0:0:0:0:0:0:1",
                query(null, null, null, null, null, "0:0:0:0:0:0:0:1", null, null, null, null, null).getClientIp());
        assertEquals("::ffff:10.0.0.1",
                query(null, null, null, null, null, "::ffff:10.0.0.1", null, null, null, null, null).getClientIp());
    }

    @Test
    public void picksTheFinestBucketThatCoversTheWindowInAtMost60() {
        assertEquals(Duration.ofMinutes(1).toMillis(), AuditLogResource.bucketMs(Duration.ofMinutes(15).toMillis()));
        assertEquals(Duration.ofMinutes(5).toMillis(), AuditLogResource.bucketMs(Duration.ofHours(1).toMillis()));
        assertEquals(Duration.ofMinutes(30).toMillis(), AuditLogResource.bucketMs(Duration.ofHours(24).toMillis()));
        assertEquals(Duration.ofHours(3).toMillis(), AuditLogResource.bucketMs(Duration.ofDays(7).toMillis()));
        assertEquals(Duration.ofDays(1).toMillis(), AuditLogResource.bucketMs(Duration.ofDays(30).toMillis()));
        long tenYears = Duration.ofDays(3650).toMillis();
        assertTrue(Math.ceilDiv(tenYears, AuditLogResource.bucketMs(tenYears)) + 1 <= AuditLogResource.MAX_BUCKETS);
    }

    @Test
    public void histogramFillsEveryBucketAndTotalsThem() throws Exception {
        long hour = Duration.ofHours(1).toMillis();
        long from = Instant.parse("2026-11-05T00:00:00Z").toEpochMilli();
        when(auditDAO.getAuditHistogram(any(), eq(from), eq(Duration.ofMinutes(5).toMillis()))).thenReturn(List.of(
                new com.vodafone.vss.weaver.common.audit.AuditHistogramBucket(from + 10 * 60_000, 7, 2)));

        mockMvc.perform(get("/api/admin/audit/histogram")
                        .param("from", "2026-11-05T00:00:00Z").param("to", "2026-11-05T01:00:00Z").param("status", "FAILED,SUCCESS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bucketMs").value(300_000))
                .andExpect(jsonPath("$.data.from").value(from))
                .andExpect(jsonPath("$.data.to").value(from + hour))
                .andExpect(jsonPath("$.data.buckets.length()").value(12))
                .andExpect(jsonPath("$.data.buckets[2].total").value(7))
                .andExpect(jsonPath("$.data.buckets[2].failed").value(2))
                .andExpect(jsonPath("$.data.buckets[3].total").value(0))
                .andExpect(jsonPath("$.data.total").value(7))
                .andExpect(jsonPath("$.data.failed").value(2));

        ArgumentCaptor<AuditEventQuery> query = ArgumentCaptor.forClass(AuditEventQuery.class);
        verify(auditDAO).getAuditHistogram(query.capture(), eq(from), eq(300_000L));
        assertEquals(List.of("FAILED", "SUCCESS"), query.getValue().getStatuses());
    }

    @Test
    public void histogramValidatesLikeTheList() throws Exception {
        mockMvc.perform(get("/api/admin/audit/histogram").param("status", "DENIED")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/audit/histogram")
                        .param("from", "2026-11-05T01:00:00Z").param("to", "2026-11-05T00:00:00Z"))
                .andExpect(status().isBadRequest());
        verify(auditDAO, never()).getAuditHistogram(any(), anyLong(), anyLong());
    }

    @Test
    public void rejectsBadTimesAndPageSizes() throws Exception {
        mockMvc.perform(get("/api/admin/audit").param("from", "yesterday")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/audit").param("size", "500")).andExpect(status().isBadRequest());
        verify(auditDAO, never()).searchAuditEvents(any(), anyInt(), anyInt());
    }

    @Test
    public void getsOneEventWithDetailsOr404() throws Exception {
        when(auditDAO.getAuditEvent("e-1")).thenReturn(Optional.of(
                AuditEvent.builder().id("e-1").details(Map.of("arg0", "orders")).build()));
        when(auditDAO.getAuditEvent("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/admin/audit/e-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.details.arg0").value("orders"));
        mockMvc.perform(get("/api/admin/audit/missing")).andExpect(status().isNotFound());
    }

    @Test
    public void facetsSayWhetherTheLogIsRecordedAndReadable() throws Exception {
        when(auditDAO.getAuditFacets()).thenReturn(Map.of(
                "resourceTypes", List.of("TASK", "WORKFLOW"), "statuses", List.of("SUCCESS"), "actions", List.of()));

        mockMvc.perform(get("/api/admin/audit/facets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.readable").value(true))
                .andExpect(jsonPath("$.data.resourceTypes[1]").value("WORKFLOW"));
    }

    @Test
    public void logOnlyStorageReturnsAnEmptyLogAndSaysSo() throws Exception {
        AuditDAO logOnly = mock(AuditDAO.class); // supportsQueries() is false
        MockMvc logOnlyMvc = mvc(new AuditLogResource(logOnly, true));

        logOnlyMvc.perform(get("/api/admin/audit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty())
                .andExpect(jsonPath("$.details.totalElements").value(0));
        logOnlyMvc.perform(get("/api/admin/audit/facets"))
                .andExpect(jsonPath("$.data.readable").value(false));
        verify(logOnly, never()).searchAuditEvents(any(), anyInt(), anyInt());
    }
}
