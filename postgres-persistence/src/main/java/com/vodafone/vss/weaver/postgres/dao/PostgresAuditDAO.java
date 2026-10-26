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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.dao.AuditDAO;

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
                            + "action, resource_type, resource_id, status, duration_ms, error_message, details, client_ip "
                            + "FROM conductor_audit_log WHERE resource_id = ? AND resource_type = ? "
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
                .build();
    }
}
