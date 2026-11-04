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

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.respond.TranslationModel;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationModel;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.core.exception.ConflictException;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;
import com.vodafone.vss.weaver.postgres.util.Query;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Postgres implementation over the {@code translations} table (one row per language). */
public class PostgresWorkflowTranslationDAO extends PostgresBaseDAO
        implements WorkflowTranslationDAO {

    private static final TypeReference<Map<String, String>> MAP_TYPE = new TypeReference<>() {};
    private static final String UNIQUE_VIOLATION = "23505";

    private static final String COLUMNS =
            "id, workflow_name, workflow_version, message_code, language_code, message, "
                    + "created_at, updated_at, created_by, updated_by";

    public PostgresWorkflowTranslationDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public List<TranslationModel> findByWorkflow(String workflowName, int workflowVersion) {
        String sql =
                "SELECT " + COLUMNS + " FROM translations "
                        + "WHERE workflow_name = ? AND workflow_version = ? "
                        + "ORDER BY message_code, language_code";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(workflowName);
                    q.addParameter(workflowVersion);
                    return q.executeAndFetch(this::mapRows);
                });
    }

    @Override
    public List<TranslationModel> findByMessage(
            String workflowName, int workflowVersion, String messageCode) {
        String sql =
                "SELECT " + COLUMNS + " FROM translations "
                        + "WHERE workflow_name = ? AND workflow_version = ? AND message_code = ? "
                        + "ORDER BY language_code";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(workflowName);
                    q.addParameter(workflowVersion);
                    q.addParameter(messageCode);
                    return q.executeAndFetch(this::mapRows);
                });
    }

    @Override
    public Optional<TranslationModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql = "SELECT " + COLUMNS + " FROM translations WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(
                            rs -> rs.next() ? Optional.of(mapRow(rs)) : Optional.empty());
                });
    }

    @Override
    public boolean messageExists(String workflowName, int workflowVersion, String messageCode) {
        String sql =
                "SELECT 1 FROM translations "
                        + "WHERE workflow_name = ? AND workflow_version = ? AND message_code = ? "
                        + "LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(workflowName);
                    q.addParameter(workflowVersion);
                    q.addParameter(messageCode);
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    /**
     * Two statements in one transaction: delete the languages that are no longer present, then
     * upsert the rest. The upsert keeps {@code created_at}/{@code created_by} of existing rows and
     * only touches rows whose text actually changed.
     */
    @Override
    public void saveMessage(
            String workflowName,
            int workflowVersion,
            String messageCode,
            Map<String, String> messages,
            UUID actorId) {
        Instant now = Instant.now();
        String actor = actorId != null ? actorId.toString() : null;
        List<String> languages = new ArrayList<>(messages.keySet());

        String deleteRemoved =
                "DELETE FROM translations "
                        + "WHERE workflow_name = ? AND workflow_version = ? AND message_code = ? "
                        + "AND NOT (language_code = ANY (?))";
        String upsert =
                "INSERT INTO translations (" + COLUMNS + ") "
                        + "VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?, ?::uuid, ?::uuid) "
                        + "ON CONFLICT ON CONSTRAINT uk_translations DO UPDATE SET "
                        + "message = EXCLUDED.message, updated_at = EXCLUDED.updated_at, "
                        + "updated_by = EXCLUDED.updated_by "
                        + "WHERE translations.message IS DISTINCT FROM EXCLUDED.message";
        try {
            withTransaction(
                    tx -> {
                        execute(
                                tx,
                                deleteRemoved,
                                q -> {
                                    q.addParameter(workflowName);
                                    q.addParameter(workflowVersion);
                                    q.addParameter(messageCode);
                                    q.addParameter(languages);
                                    q.executeDelete();
                                });
                        for (Map.Entry<String, String> entry : messages.entrySet()) {
                            execute(
                                    tx,
                                    upsert,
                                    q -> {
                                        q.addParameter(UUID.randomUUID().toString());
                                        q.addParameter(workflowName);
                                        q.addParameter(workflowVersion);
                                        q.addParameter(messageCode);
                                        q.addParameter(entry.getKey());
                                        q.addParameter(entry.getValue());
                                        q.addParameter(Timestamp.from(now));
                                        q.addParameter(Timestamp.from(now));
                                        q.addParameter(actor);
                                        q.addParameter(actor);
                                        q.executeUpdate();
                                    });
                        }
                    });
        } catch (RuntimeException e) {
            throw translateConflict(e, workflowName, workflowVersion, messageCode);
        }
    }

    @Override
    public int deleteMessage(String workflowName, int workflowVersion, String messageCode) {
        String sql =
                "DELETE FROM translations "
                        + "WHERE workflow_name = ? AND workflow_version = ? AND message_code = ?";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(workflowName);
                    q.addParameter(workflowVersion);
                    q.addParameter(messageCode);
                    return q.executeUpdate();
                });
    }

    @Override
    public long countByLanguage(String languageCode) {
        String sql = "SELECT COUNT(1) FROM translations WHERE language_code = ?";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(languageCode);
                    Long count = q.executeScalar(Long.class);
                    return count != null ? count : 0L;
                });
    }

    @Override
    public List<TranslationModel> findAll() {
        String sql =
                "SELECT " + COLUMNS + " FROM translations "
                        + "ORDER BY workflow_name, workflow_version, message_code, language_code";
        return queryWithTransaction(sql, q -> q.executeAndFetch(this::mapRows));
    }

    /**
     * Pages over messages, not rows: rows are grouped by (workflow name, version, message code)
     * and each group becomes one {@link WorkflowTranslationModel}. Filters apply to rows before
     * grouping; sorting is by group, with the group key as a tie-breaker so pages are stable.
     */
    @Override
    public PageResult<WorkflowTranslationModel> searchMessages(
            String workflowName,
            Integer workflowVersion,
            String search,
            int page,
            int size,
            String sortBy,
            String sortOrder) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (workflowName != null && !workflowName.isBlank()) {
            where.append(" AND LOWER(workflow_name) LIKE ? ESCAPE '\\'");
            params.add(containsPattern(workflowName));
        }
        if (workflowVersion != null) {
            where.append(" AND workflow_version = ?");
            params.add(workflowVersion);
        }
        if (search != null && !search.isBlank()) {
            where.append(
                    " AND (LOWER(message_code) LIKE ? ESCAPE '\\' OR LOWER(workflow_name) LIKE ? ESCAPE '\\'"
                            + " OR LOWER(message) LIKE ? ESCAPE '\\')");
            String pattern = containsPattern(search);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }

        String groupBy = " GROUP BY workflow_name, workflow_version, message_code";

        String countSql =
                "SELECT COUNT(1) FROM (SELECT 1 FROM translations" + where + groupBy + ") g";
        Long total =
                queryWithTransaction(
                        countSql,
                        q -> {
                            params.forEach(p -> applyParam(q, p));
                            return q.executeScalar(Long.class);
                        });
        long totalHits = total != null ? total : 0;

        String orderCol = "MAX(updated_at)";
        if ("messageCode".equalsIgnoreCase(sortBy) || "message_code".equalsIgnoreCase(sortBy)) {
            orderCol = "message_code";
        } else if ("workflowName".equalsIgnoreCase(sortBy)
                || "workflow_name".equalsIgnoreCase(sortBy)) {
            orderCol = "workflow_name";
        }
        String direction = "ASC".equalsIgnoreCase(sortOrder) ? "ASC" : "DESC";

        int effectiveSize = size > 0 ? size : 20;
        int effectivePage = Math.max(0, page);
        int offset = effectivePage * effectiveSize;

        String dataSql =
                "SELECT workflow_name, workflow_version, message_code, "
                        + "(ARRAY_AGG(id ORDER BY created_at, id))[1] AS id, "
                        + "JSONB_OBJECT_AGG(language_code, message) AS translations, "
                        + "MIN(created_at) AS created_at, MAX(updated_at) AS updated_at, "
                        + "(ARRAY_AGG(created_by ORDER BY created_at, id))[1] AS created_by, "
                        + "(ARRAY_AGG(updated_by ORDER BY updated_at DESC, id))[1] AS updated_by "
                        + "FROM translations"
                        + where
                        + groupBy
                        + " ORDER BY " + orderCol + " " + direction
                        + ", workflow_name, workflow_version, message_code"
                        + " LIMIT ? OFFSET ?";

        List<WorkflowTranslationModel> content =
                queryWithTransaction(
                        dataSql,
                        q -> {
                            params.forEach(p -> applyParam(q, p));
                            q.addParameter(effectiveSize);
                            q.addParameter(offset);
                            return q.executeAndFetch(
                                    rs -> {
                                        List<WorkflowTranslationModel> list = new ArrayList<>();
                                        while (rs.next()) {
                                            list.add(mapGroup(rs));
                                        }
                                        return list;
                                    });
                        });

        return PageResult.of(content, totalHits, effectivePage, effectiveSize);
    }

    // ---------------------------------------------------------------------------------------

    /** Lower-cased {@code %text%} with LIKE wildcards in the user's text escaped. */
    private static String containsPattern(String text) {
        String escaped =
                text.trim()
                        .toLowerCase()
                        .replace("\\", "\\\\")
                        .replace("%", "\\%")
                        .replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private static void applyParam(Query q, Object p) {
        if (p instanceof Integer i) {
            q.addParameter(i);
        } else if (p != null) {
            q.addParameter(p.toString());
        }
    }

    private RuntimeException translateConflict(
            RuntimeException e, String workflowName, int workflowVersion, String messageCode) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SQLException sql && UNIQUE_VIOLATION.equals(sql.getSQLState())) {
                return new ConflictException(
                        "Translation already exists for workflow '%s', version %d, message code '%s'",
                        workflowName, workflowVersion, messageCode);
            }
        }
        return e;
    }

    private List<TranslationModel> mapRows(ResultSet rs) throws SQLException {
        List<TranslationModel> list = new ArrayList<>();
        while (rs.next()) {
            list.add(mapRow(rs));
        }
        return list;
    }

    private TranslationModel mapRow(ResultSet rs) throws SQLException {
        return TranslationModel.builder()
                .id(UUID.fromString(rs.getString("id")))
                .workflowName(rs.getString("workflow_name"))
                .workflowVersion(rs.getInt("workflow_version"))
                .messageCode(rs.getString("message_code"))
                .languageCode(rs.getString("language_code"))
                .message(rs.getString("message"))
                .createdAt(toInstant(rs.getTimestamp("created_at")))
                .updatedAt(toInstant(rs.getTimestamp("updated_at")))
                .createdBy(toUuid(rs.getString("created_by")))
                .updatedBy(toUuid(rs.getString("updated_by")))
                .build();
    }

    private WorkflowTranslationModel mapGroup(ResultSet rs) throws SQLException {
        Map<String, String> translations;
        try {
            translations = objectMapper.readValue(rs.getString("translations"), MAP_TYPE);
        } catch (Exception e) {
            // Built by JSONB_OBJECT_AGG from text columns, so this should never happen.
            logger.error(
                    "Could not read aggregated translations for workflow '{}' v{} message '{}'",
                    rs.getString("workflow_name"),
                    rs.getInt("workflow_version"),
                    rs.getString("message_code"),
                    e);
            translations = new HashMap<>();
        }
        return WorkflowTranslationModel.builder()
                .id(UUID.fromString(rs.getString("id")))
                .workflowName(rs.getString("workflow_name"))
                .workflowVersion(rs.getInt("workflow_version"))
                .messageCode(rs.getString("message_code"))
                .translations(translations)
                .createdAt(toInstant(rs.getTimestamp("created_at")))
                .updatedAt(toInstant(rs.getTimestamp("updated_at")))
                .createdBy(toUuid(rs.getString("created_by")))
                .updatedBy(toUuid(rs.getString("updated_by")))
                .build();
    }

    private static Instant toInstant(Timestamp ts) {
        return ts != null ? ts.toInstant() : null;
    }

    private static UUID toUuid(String value) {
        return value != null ? UUID.fromString(value) : null;
    }
}
