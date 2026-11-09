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

import java.time.Instant;
import java.time.Duration;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Pattern;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.audit.AuditEventQuery;
import com.vodafone.vss.weaver.common.audit.AuditHistogramBucket;
import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.response.PaginatedResult;
import com.vodafone.vss.weaver.dao.AuditDAO;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Read-only access to the audit log. Under /api/admin, so only admins can use it when security
 * is enabled. Reading the log is not itself audited.
 */
@Validated
@RestController
@Tag(name = "Audit log", description = "Read the audit log")
@RequestMapping(value = "/api/admin/audit", produces = MediaType.APPLICATION_JSON_VALUE)
public class AuditLogResource {

    static final int MAX_PAGE_SIZE = 200;

    private final AuditDAO auditDAO;
    private final boolean auditEnabled;

    public AuditLogResource(
            @Autowired(required = false) AuditDAO auditDAO,
            @Value("${weaver.audit.enabled:true}") boolean auditEnabled) {
        this.auditDAO = auditDAO;
        this.auditEnabled = auditEnabled;
    }

    @GetMapping
    @Operation(summary = "List audit events",
            description = "Without details. Filters combine with AND; the values of one multi-value filter "
                    + "(repeat the parameter or separate with commas) combine with OR. Without from, the last "
                    + "24 hours are searched, except for an event id lookup.",
            operationId = "listAuditEvents")
    public ResponseEntity<AppResponse> listEvents(
            @Parameter(description = "Part of the action, actor, resource name or error; the start of a resource id; "
                    + "or an exact event id or client IP") @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "Resource types, e.g. WORKFLOW") @RequestParam(name = "resourceType", required = false) List<String> resourceTypes,
            @Parameter(description = "SUCCESS and/or FAILED") @RequestParam(name = "status", required = false) List<String> statuses,
            @Parameter(description = "Actions, e.g. startWorkflow") @RequestParam(name = "action", required = false) List<String> actions,
            @Parameter(description = "Exact actor (Keycloak user id)") @RequestParam(name = "actorId", required = false) String actorId,
            @Parameter(description = "Part of the actor's username, name or email") @RequestParam(name = "actor", required = false) String actor,
            @Parameter(description = "Exact resource id") @RequestParam(name = "resourceId", required = false) String resourceId,
            @Parameter(description = "Exact event id") @RequestParam(name = "eventId", required = false) String eventId,
            @Parameter(description = "Exact client IP (IPv4 or IPv6)") @RequestParam(name = "clientIp", required = false) String clientIp,
            @Parameter(description = "Only events that took at least this many ms") @RequestParam(name = "minDurationMs", required = false) Long minDurationMs,
            @Parameter(description = "Only events that took at most this many ms") @RequestParam(name = "maxDurationMs", required = false) Long maxDurationMs,
            @Parameter(description = "Only events at or after this time (ISO-8601); default 24 hours before to") @RequestParam(name = "from", required = false) String from,
            @Parameter(description = "Only events before this time (ISO-8601)") @RequestParam(name = "to", required = false) String to,
            @Parameter(description = "timestamp, durationMs, status, actor, action or resourceType, then ,asc or ,desc; "
                    + "default timestamp,desc") @RequestParam(name = "sort", required = false) String sort,
            @Parameter(description = "Page number, from 0") @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @Parameter(description = "Page size, 1 to 200") @RequestParam(name = "size", defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size) {
        AuditEventQuery query = toQuery(search, resourceTypes, statuses, actions, actorId, actor, resourceId, eventId,
                clientIp, minDurationMs, maxDurationMs, from, to, sort, Instant.now());

        List<AuditEvent> events = readable() ? auditDAO.searchAuditEvents(query, page * size, size) : List.of();
        long total = readable() ? auditDAO.countAuditEvents(query) : 0;
        int totalPages = (int) Math.ceil((double) total / size);

        AppResponse body = AppResponse.builder()
                .message("Audit events fetched successfully")
                .data(events)
                .details(new PaginatedResult(page, size, total, totalPages, events.size()))
                .status(HttpStatus.OK)
                .success(true)
                .retryable(false)
                .build();
        return ResponseEntity.ok(body);
    }

    static final Duration DEFAULT_WINDOW = Duration.ofHours(24);
    private static final List<String> STATUSES = List.of(AuditEvent.STATUS_SUCCESS, AuditEvent.STATUS_FAILED);
    /** Resource types and actions: identifiers, as the aspect records them. */
    private static final Pattern NAME = Pattern.compile("[A-Za-z0-9_.-]{1,64}");
    private static final Pattern UUID_PATTERN =
            Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    /** IPv4, or IPv6 (also IPv4-mapped); a syntax check only, nothing is resolved. */
    private static final Pattern IP_PATTERN =
            Pattern.compile("(\\d{1,3}\\.){3}\\d{1,3}|[0-9a-fA-F:]{2,39}(:(\\d{1,3}\\.){3}\\d{1,3})?");
    private static final Map<String, AuditEventQuery.SortField> SORT_FIELDS = Map.of(
            "timestamp", AuditEventQuery.SortField.TIMESTAMP,
            "durationMs", AuditEventQuery.SortField.DURATION,
            "status", AuditEventQuery.SortField.STATUS,
            "actor", AuditEventQuery.SortField.ACTOR,
            "action", AuditEventQuery.SortField.ACTION,
            "resourceType", AuditEventQuery.SortField.RESOURCE_TYPE);

    /** Checks every parameter and builds the query; anything invalid is a 400, never ignored. */
    static AuditEventQuery toQuery(String search, List<String> resourceTypes, List<String> statuses,
            List<String> actions, String actorId, String actor, String resourceId, String eventId, String clientIp,
            Long minDurationMs, Long maxDurationMs, String from, String to, String sort, Instant now) {
        String text = trimmed(search, "search", 200);
        List<String> types = values(resourceTypes, "resourceType");
        List<String> statusValues = values(statuses, "status").stream()
                .map(value -> value.toUpperCase(Locale.ROOT)).toList();
        for (String status : statusValues) {
            if (!STATUSES.contains(status)) {
                throw bad("status", "status must be one of " + String.join(", ", STATUSES));
            }
        }
        List<String> actionValues = values(actions, "action");
        String event = trimmed(eventId, "eventId", 36);
        if (event != null && !UUID_PATTERN.matcher(event).matches()) {
            throw bad("eventId", "eventId must be an event id (a UUID)");
        }
        String ip = trimmed(clientIp, "clientIp", 45);
        if (ip != null && !IP_PATTERN.matcher(ip).matches()) {
            throw bad("clientIp", "clientIp must be an IPv4 or IPv6 address");
        }
        if (minDurationMs != null && minDurationMs < 0) {
            throw bad("minDurationMs", "minDurationMs must be 0 or more");
        }
        if (maxDurationMs != null && maxDurationMs < 0) {
            throw bad("maxDurationMs", "maxDurationMs must be 0 or more");
        }
        if (minDurationMs != null && maxDurationMs != null && maxDurationMs < minDurationMs) {
            throw bad("maxDurationMs", "maxDurationMs must be at least minDurationMs");
        }
        Instant fromTime = parseInstant("from", from);
        Instant toTime = parseInstant("to", to);
        if (fromTime != null && toTime != null && !fromTime.isBefore(toTime)) {
            throw bad("to", "to must be after from");
        }
        if (fromTime == null && event == null) {
            // Bounded by default: an open-ended search would read the whole log.
            fromTime = (toTime != null ? toTime : now).minus(DEFAULT_WINDOW);
        }

        AuditEventQuery.AuditEventQueryBuilder builder = AuditEventQuery.builder()
                .search(text)
                .resourceTypes(types)
                .statuses(statusValues)
                .actions(actionValues)
                .actorId(trimmed(actorId, "actorId", 64))
                .actor(trimmed(actor, "actor", 255))
                .resourceId(trimmed(resourceId, "resourceId", 255))
                .eventId(event)
                .clientIp(ip)
                .minDurationMs(minDurationMs)
                .maxDurationMs(maxDurationMs)
                .from(fromTime)
                .to(toTime);
        applySort(builder, sort);
        return builder.build();
    }

    private static void applySort(AuditEventQuery.AuditEventQueryBuilder builder, String sort) {
        if (sort == null || sort.isBlank()) {
            return;
        }
        String[] parts = sort.trim().split(",");
        AuditEventQuery.SortField field = SORT_FIELDS.get(parts[0].trim());
        String direction = parts.length > 1 ? parts[1].trim().toLowerCase(Locale.ROOT) : "desc";
        if (field == null || parts.length > 2 || !(direction.equals("asc") || direction.equals("desc"))) {
            throw bad("sort", "sort must be one of " + String.join(", ", new TreeSet<>(SORT_FIELDS.keySet()))
                    + ", optionally followed by ,asc or ,desc");
        }
        builder.sort(field).ascending(direction.equals("asc"));
    }

    /** Values of a multi-value parameter, repeated and/or comma-separated; each must be an identifier. */
    private static List<String> values(List<String> raw, String name) {
        if (raw == null) {
            return List.of();
        }
        List<String> values = raw.stream()
                .filter(value -> value != null)
                .flatMap(value -> Arrays.stream(value.split(",")))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .distinct()
                .toList();
        if (values.size() > 50) {
            throw bad(name, name + " takes at most 50 values");
        }
        for (String value : values) {
            if (!NAME.matcher(value).matches()) {
                throw bad(name, "Invalid " + name + ": " + abbreviate(value));
            }
        }
        return values;
    }

    private static String trimmed(String value, String name, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value.trim();
        if (text.length() > maxLength) {
            throw bad(name, name + " must be at most " + maxLength + " characters");
        }
        return text;
    }

    private static String abbreviate(String value) {
        return value.length() > 40 ? value.substring(0, 40) + "..." : value;
    }

    private static RuntimeException bad(String name, String message) {
        return ExceptionUtils.throwBadInputs("Invalid " + name, message);
    }

    @GetMapping("/histogram")
    @Operation(summary = "Audit events over time",
            description = "Matching events per time bucket over the window (the same filters as the list), with the "
                    + "failed share; every bucket in the window is present, empty ones as zero. Buckets are aligned "
                    + "to whole steps (UTC) and at most " + MAX_BUCKETS + " cover the window.",
            operationId = "getAuditHistogram")
    public ResponseEntity<AppResponse> histogram(
            @Parameter(description = "As for the list") @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "As for the list") @RequestParam(name = "resourceType", required = false) List<String> resourceTypes,
            @Parameter(description = "As for the list") @RequestParam(name = "status", required = false) List<String> statuses,
            @Parameter(description = "As for the list") @RequestParam(name = "action", required = false) List<String> actions,
            @Parameter(description = "As for the list") @RequestParam(name = "actorId", required = false) String actorId,
            @Parameter(description = "As for the list") @RequestParam(name = "actor", required = false) String actor,
            @Parameter(description = "As for the list") @RequestParam(name = "resourceId", required = false) String resourceId,
            @Parameter(description = "As for the list") @RequestParam(name = "eventId", required = false) String eventId,
            @Parameter(description = "As for the list") @RequestParam(name = "clientIp", required = false) String clientIp,
            @Parameter(description = "As for the list") @RequestParam(name = "minDurationMs", required = false) Long minDurationMs,
            @Parameter(description = "As for the list") @RequestParam(name = "maxDurationMs", required = false) Long maxDurationMs,
            @Parameter(description = "Window start (ISO-8601); default 24 hours before to") @RequestParam(name = "from", required = false) String from,
            @Parameter(description = "Window end (ISO-8601); default now") @RequestParam(name = "to", required = false) String to) {
        Instant now = Instant.now();
        AuditEventQuery query = toQuery(search, resourceTypes, statuses, actions, actorId, actor, resourceId, eventId,
                clientIp, minDurationMs, maxDurationMs, from, to, null, now);
        Instant end = query.getTo() != null ? query.getTo() : now;
        Instant start = query.getFrom() != null ? query.getFrom() : end.minus(DEFAULT_WINDOW);
        long bucketMs = bucketMs(end.toEpochMilli() - start.toEpochMilli());
        long origin = Math.floorDiv(start.toEpochMilli(), bucketMs) * bucketMs;

        List<AuditHistogramBucket> counted =
                readable() ? auditDAO.getAuditHistogram(query, origin, bucketMs) : List.of();
        Map<Long, AuditHistogramBucket> byStart = new HashMap<>();
        counted.forEach(bucket -> byStart.put(bucket.start(), bucket));
        List<AuditHistogramBucket> buckets = new ArrayList<>();
        long total = 0;
        long failed = 0;
        for (long bucketStart = origin; bucketStart < end.toEpochMilli(); bucketStart += bucketMs) {
            AuditHistogramBucket bucket = byStart.getOrDefault(bucketStart, new AuditHistogramBucket(bucketStart, 0, 0));
            buckets.add(bucket);
            total += bucket.total();
            failed += bucket.failed();
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("from", start.toEpochMilli());
        data.put("to", end.toEpochMilli());
        data.put("bucketMs", bucketMs);
        data.put("total", total);
        data.put("failed", failed);
        data.put("buckets", buckets);
        return ResponseEntity.ok(DatabaseResource.ok(HttpStatus.OK, "Audit histogram", data));
    }

    static final int MAX_BUCKETS = 60;

    /** Bucket widths, finest first: the finest that covers the window in at most MAX_BUCKETS. */
    private static final long[] BUCKET_STEPS = {
        Duration.ofMinutes(1).toMillis(), Duration.ofMinutes(5).toMillis(), Duration.ofMinutes(15).toMillis(),
        Duration.ofMinutes(30).toMillis(), Duration.ofHours(1).toMillis(), Duration.ofHours(3).toMillis(),
        Duration.ofHours(6).toMillis(), Duration.ofHours(12).toMillis(), Duration.ofDays(1).toMillis(),
        Duration.ofDays(7).toMillis(), Duration.ofDays(30).toMillis()
    };

    static long bucketMs(long spanMs) {
        for (long step : BUCKET_STEPS) {
            // +1 bucket: alignment to whole steps can add one at the start.
            if (Math.ceilDiv(spanMs, step) + 1 <= MAX_BUCKETS) {
                return step;
            }
        }
        long largest = BUCKET_STEPS[BUCKET_STEPS.length - 1];
        return largest * Math.ceilDiv(Math.ceilDiv(spanMs, largest) + 1, MAX_BUCKETS);
    }

    @GetMapping("/facets")
    @Operation(summary = "Audit log filters",
            description = "Resource types, statuses and actions seen in the log, and whether the log is recorded and readable.",
            operationId = "getAuditFacets")
    public ResponseEntity<AppResponse> facets() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("enabled", auditEnabled);
        data.put("readable", readable());
        data.putAll(readable() ? auditDAO.getAuditFacets() : Map.of(
                "resourceTypes", List.of(), "statuses", List.of(), "actions", List.of()));
        return ResponseEntity.ok(DatabaseResource.ok(HttpStatus.OK, "Audit log filters", data));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get audit event", description = "One event, with its details.", operationId = "getAuditEvent")
    public ResponseEntity<AppResponse> getEvent(@Parameter(description = "Event id") @PathVariable("id") String id) {
        AuditEvent event = (readable() ? auditDAO.getAuditEvent(id) : java.util.Optional.<AuditEvent>empty())
                .orElseThrow(() -> ExceptionUtils.throwNotFound("Audit event not found: " + id));
        return ResponseEntity.ok(DatabaseResource.ok(HttpStatus.OK, "Audit event fetched successfully", event));
    }

    private boolean readable() {
        return auditDAO != null && auditDAO.supportsQueries();
    }

    private static Instant parseInstant(String name, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw bad(name, name + " must be an ISO-8601 time, e.g. 2026-11-04T10:00:00Z");
        }
    }
}
