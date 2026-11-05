/*
 * Copyright 2026 Conductor Authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.postgres.dao;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.audit.AuditEventQuery;
import com.vodafone.vss.weaver.common.audit.AuditHistogramBucket;
import com.vodafone.vss.weaver.dao.AuditDAO;
import com.vodafone.vss.weaver.postgres.util.Query;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * PostgreSQL implementation of AuditDAO persisting audit events to conductor_audit_log table.
 */
public class PostgresAuditDAO extends PostgresBaseDAO implements AuditDAO {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    public PostgresAuditDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public void log(AuditEvent event) {
        if (event == null) {
            return;
        }
        if (event.getId() == null || event.getId().isBlank()) {
            event.setId(UUID.randomUUID().toString());
        }
        long timestamp =
                event.getTimestamp() != null ? event.getTimestamp() : System.currentTimeMillis();

        String sql =
                "INSERT INTO conductor_audit_log ("
                        + "id, created_at, actor_id, actor_username, actor_name, actor_email, "
                        + "action, resource_type, resource_id, status, duration_ms, error_message, details, client_ip"
                        + ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)";
        try {
            executeWithTransaction(
                    sql,
                    q -> {
                        q.addParameter(event.getId());
                        q.addParameter(new Timestamp(timestamp));
                        q.addParameter(event.getActorId());
                        q.addParameter(event.getActorUsername());
                        q.addParameter(event.getActorName());
                        q.addParameter(event.getActorEmail());
                        q.addParameter(event.getAction());
                        q.addParameter(event.getResourceType());
                        q.addParameter(event.getResourceId());
                        q.addParameter(event.getStatus());
                        q.addParameter(event.getDurationMs());
                        q.addParameter(event.getErrorMessage());
                        q.addParameter(
                                event.getDetails() != null ? toJson(event.getDetails()) : null);
                        q.addParameter(event.getClientIp());
                        q.executeUpdate();
                    });
        } catch (Exception ex) {
            logger.error(
                    "Failed to persist audit event '{}' for action '{}': {}",
                    event.getId(),
                    event.getAction(),
                    ex.getMessage());
        }
    }

    @Override
    public List<AuditEvent> getAuditEvents(String resourceId, String resourceType, int limit) {
        if (resourceId == null || resourceId.isBlank()) {
            return Collections.emptyList();
        }
        int effectiveLimit = limit > 0 ? limit : 50;
        try {
            String sql =
                    "SELECT id, created_at, actor_id, actor_username, actor_name, actor_email, "
                            + "action, resource_type, resource_id, status, duration_ms, error_message, details, client_ip, "
                            + RESOURCE_NAME
                            + " FROM conductor_audit_log WHERE resource_id = ? AND resource_type = ? "
                            + "ORDER BY created_at DESC LIMIT ?";
            return queryWithTransaction(
                    sql,
                    q -> {
                        q.addParameter(resourceId);
                        q.addParameter(resourceType);
                        q.addParameter(effectiveLimit);
                        return q.executeAndFetch(
                                rs -> {
                                    List<AuditEvent> list = new ArrayList<>();
                                    while (rs.next()) {
                                        list.add(mapAuditEvent(rs));
                                    }
                                    return list;
                                });
                    });
        } catch (Exception ex) {
            logger.error(
                    "Failed to fetch audit events for resourceId '{}', resourceType '{}': {}",
                    resourceId,
                    resourceType,
                    ex.getMessage());
            return Collections.emptyList();
        }
    }

    /** The resource's recorded name, from the details (JSONB) without returning them. */
    private static final String RESOURCE_NAME = "details->>'name' AS resource_name";

    private static final String LIST_COLUMNS =
            "id, created_at, actor_id, actor_username, actor_name, actor_email, "
                    + "action, resource_type, resource_id, status, duration_ms, error_message, "
                    + "NULL AS details, client_ip, " + RESOURCE_NAME + " ";

    /** A bound, case-insensitive LIKE in which \ escapes % and _ (see escapeLike). */
    private static final String ILIKE = " ILIKE ? ESCAPE '\\'";

    /** A WHERE clause and its parameters, in order. */
    record Where(String sql, List<Object> params) {}

    /** Builds the WHERE clause for a query; values are always bound, never concatenated. */
    static Where where(AuditEventQuery query) {
        StringBuilder sql = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (query == null) {
            return new Where(sql.toString(), params);
        }
        if (notBlank(query.getSearch())) {
            String text = query.getSearch().trim();
            String contains = "%" + escapeLike(text) + "%";
            String prefix = escapeLike(text) + "%";
            // Contains: action, actor, resource name, error. Starts with: resource id. Exact: event id, client IP.
            sql.append(" AND (action" + ILIKE
                    + " OR actor_username" + ILIKE + " OR actor_name" + ILIKE
                    + " OR actor_email" + ILIKE
                    + " OR details->>'name'" + ILIKE
                    + " OR error_message" + ILIKE
                    + " OR resource_id" + ILIKE
                    + " OR id = ? OR client_ip = ?)");
            for (int i = 0; i < 6; i++) {
                params.add(contains);
            }
            params.add(prefix);
            params.add(text);
            params.add(text);
        }
        in(sql, params, "resource_type", query.getResourceTypes());
        in(sql, params, "status", query.getStatuses());
        in(sql, params, "action", query.getActions());
        equal(sql, params, "actor_id", query.getActorId());
        if (notBlank(query.getActor())) {
            String contains = "%" + escapeLike(query.getActor().trim()) + "%";
            sql.append(" AND (actor_username" + ILIKE + " OR actor_name" + ILIKE
                    + " OR actor_email" + ILIKE + ")");
            params.add(contains);
            params.add(contains);
            params.add(contains);
        }
        equal(sql, params, "resource_id", query.getResourceId());
        equal(sql, params, "id", query.getEventId());
        equal(sql, params, "client_ip", query.getClientIp());
        if (query.getMinDurationMs() != null) {
            sql.append(" AND duration_ms >= ?");
            params.add(query.getMinDurationMs());
        }
        if (query.getMaxDurationMs() != null) {
            sql.append(" AND duration_ms <= ?");
            params.add(query.getMaxDurationMs());
        }
        if (query.getFrom() != null) {
            sql.append(" AND created_at >= ?");
            params.add(Timestamp.from(query.getFrom()));
        }
        if (query.getTo() != null) {
            sql.append(" AND created_at < ?");
            params.add(Timestamp.from(query.getTo()));
        }
        return new Where(sql.toString(), params);
    }

    /** Our own column for each sort field; callers never supply a column name. */
    private static final Map<AuditEventQuery.SortField, String> SORT_COLUMNS = Map.of(
            AuditEventQuery.SortField.DURATION, "duration_ms",
            AuditEventQuery.SortField.STATUS, "status",
            AuditEventQuery.SortField.ACTOR, "COALESCE(actor_name, actor_username, actor_id)",
            AuditEventQuery.SortField.ACTION, "action",
            AuditEventQuery.SortField.RESOURCE_TYPE, "resource_type");

    /**
     * The ORDER BY clause. Every order ends with the event time and id, so pages are stable when
     * values tie; empty values always sort last.
     */
    static String orderBy(AuditEventQuery query) {
        AuditEventQuery.SortField field =
                query != null && query.getSort() != null ? query.getSort() : AuditEventQuery.SortField.TIMESTAMP;
        String direction = query != null && query.isAscending() ? "ASC" : "DESC";
        if (field == AuditEventQuery.SortField.TIMESTAMP) {
            return " ORDER BY created_at " + direction + ", id " + direction;
        }
        return " ORDER BY " + SORT_COLUMNS.get(field) + " " + direction + " NULLS LAST, created_at DESC, id DESC";
    }

    private static void in(StringBuilder sql, List<Object> params, String column, List<String> values) {
        List<String> present = values == null ? List.of()
                : values.stream().filter(PostgresAuditDAO::notBlank).map(String::trim).distinct().toList();
        if (present.isEmpty()) {
            return;
        }
        if (present.size() == 1) {
            sql.append(" AND ").append(column).append(" = ?");
        } else {
            sql.append(" AND ").append(column).append(" IN (")
                    .append(String.join(", ", Collections.nCopies(present.size(), "?"))).append(")");
        }
        params.addAll(present);
    }

    private static void equal(StringBuilder sql, List<Object> params, String column, String value) {
        if (notBlank(value)) {
            sql.append(" AND ").append(column).append(" = ?");
            params.add(value.trim());
        }
    }

    @Override
    public boolean supportsQueries() {
        return true;
    }

    @Override
    public List<AuditEvent> searchAuditEvents(AuditEventQuery query, int offset, int limit) {
        Where where = where(query);
        String sql = "SELECT " + LIST_COLUMNS + "FROM conductor_audit_log" + where.sql()
                + orderBy(query) + " LIMIT ? OFFSET ?";
        return queryWithTransaction(
                sql,
                q -> {
                    bind(q, where.params());
                    q.addParameter(Math.max(1, limit));
                    q.addParameter(Math.max(0, offset));
                    return q.executeAndFetch(
                            rs -> {
                                List<AuditEvent> list = new ArrayList<>();
                                while (rs.next()) {
                                    list.add(mapAuditEvent(rs));
                                }
                                return list;
                            });
                });
    }

    @Override
    public long countAuditEvents(AuditEventQuery query) {
        Where where = where(query);
        return queryWithTransaction(
                "SELECT COUNT(*) FROM conductor_audit_log" + where.sql(),
                q -> {
                    bind(q, where.params());
                    return q.executeAndFetch(rs -> rs.next() ? rs.getLong(1) : 0L);
                });
    }

    @Override
    public Optional<AuditEvent> getAuditEvent(String id) {
        if (!notBlank(id)) {
            return Optional.empty();
        }
        return queryWithTransaction(
                "SELECT id, created_at, actor_id, actor_username, actor_name, actor_email, action, "
                        + "resource_type, resource_id, status, duration_ms, error_message, details, client_ip, "
                        + RESOURCE_NAME + " FROM conductor_audit_log WHERE id = ?",
                q -> {
                    q.addParameter(id);
                    return q.executeAndFetch(
                            rs -> rs.next() ? Optional.of(mapAuditEvent(rs)) : Optional.<AuditEvent>empty());
                });
    }

    /**
     * Bucket index of each matching event, counted in SQL so only one row per non-empty bucket
     * comes back. The origin and width are bound numbers, never concatenated.
     */
    static String histogramSql(Where where) {
        return "SELECT FLOOR((EXTRACT(EPOCH FROM created_at) * 1000 - ?) / ?)::bigint AS bucket, "
                + "COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'FAILED') AS failed "
                + "FROM conductor_audit_log" + where.sql() + " GROUP BY bucket ORDER BY bucket";
    }

    @Override
    public List<AuditHistogramBucket> getAuditHistogram(AuditEventQuery query, long origin, long bucketMs) {
        if (bucketMs <= 0) {
            throw new IllegalArgumentException("bucketMs must be positive");
        }
        Where where = where(query);
        return queryWithTransaction(
                histogramSql(where),
                q -> {
                    q.addParameter(origin);
                    q.addParameter(bucketMs);
                    bind(q, where.params());
                    return q.executeAndFetch(
                            rs -> {
                                List<AuditHistogramBucket> buckets = new ArrayList<>();
                                while (rs.next()) {
                                    buckets.add(new AuditHistogramBucket(
                                            origin + rs.getLong("bucket") * bucketMs,
                                            rs.getLong("total"),
                                            rs.getLong("failed")));
                                }
                                return buckets;
                            });
                });
    }

    @Override
    public Map<String, List<String>> getAuditFacets() {
        Map<String, List<String>> facets = new LinkedHashMap<>();
        facets.put("resourceTypes", distinct("resource_type"));
        facets.put("statuses", distinct("status"));
        facets.put("actions", distinct("action"));
        return facets;
    }

    /** Distinct values of one of our own columns (never a caller-supplied name). */
    private List<String> distinct(String column) {
        return queryWithTransaction(
                "SELECT DISTINCT " + column + " FROM conductor_audit_log WHERE " + column
                        + " IS NOT NULL ORDER BY 1 LIMIT 500",
                q -> q.executeAndFetch(
                        rs -> {
                            List<String> values = new ArrayList<>();
                            while (rs.next()) {
                                values.add(rs.getString(1));
                            }
                            return values;
                        }));
    }

    private static void bind(Query q, List<Object> params) {
        for (Object param : params) {
            if (param instanceof Timestamp ts) {
                q.addParameter(ts);
            } else if (param instanceof Long number) {
                q.addParameter(number.longValue());
            } else {
                q.addParameter(String.valueOf(param));
            }
        }
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    /** Makes % and _ (and the escape character) match literally in ILIKE. */
    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private AuditEvent mapAuditEvent(ResultSet rs) throws SQLException {
        Timestamp ts = rs.getTimestamp("created_at");
        String detailsJson = rs.getString("details");
        Map<String, Object> details = null;
        if (detailsJson != null && !detailsJson.isBlank()) {
            try {
                details = readValue(detailsJson, MAP_TYPE);
            } catch (Exception e) {
                logger.debug("Could not deserialize audit details: {}", e.getMessage());
            }
        }
        return AuditEvent.builder()
                .id(rs.getString("id"))
                .timestamp(ts != null ? ts.getTime() : null)
                .actorId(rs.getString("actor_id"))
                .actorUsername(rs.getString("actor_username"))
                .actorName(rs.getString("actor_name"))
                .actorEmail(rs.getString("actor_email"))
                .action(rs.getString("action"))
                .resourceType(rs.getString("resource_type"))
                .resourceId(rs.getString("resource_id"))
                .status(rs.getString("status"))
                .durationMs(rs.getObject("duration_ms") != null ? rs.getLong("duration_ms") : null)
                .errorMessage(rs.getString("error_message"))
                .details(details)
                .clientIp(rs.getString("client_ip"))
                .resourceName(rs.getString("resource_name"))
                .build();
    }
}
