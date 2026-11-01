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

import com.vodafone.vss.weaver.common.respond.WorkflowTranslationModel;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;
import com.vodafone.vss.weaver.postgres.util.Query;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

public class PostgresWorkflowTranslationDAO extends PostgresBaseDAO
        implements WorkflowTranslationDAO {

    private static final TypeReference<Map<String, String>> MAP_TYPE = new TypeReference<>() {};

    public PostgresWorkflowTranslationDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public WorkflowTranslationModel create(WorkflowTranslationModel translation) {
        if (translation.getId() == null) {
            translation.setId(UUID.randomUUID());
        }
        if (translation.getCreatedAt() == null) {
            translation.setCreatedAt(Instant.now());
        }
        translation.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO workflow_translation ("
                        + "id, workflow_name, workflow_version, message_code, translations, created_at, updated_at"
                        + ") VALUES (?::uuid, ?, ?, ?, ?::jsonb, ?, ?)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(translation.getId().toString());
                    q.addParameter(translation.getWorkflowName());
                    q.addParameter(translation.getWorkflowVersion() != null ? translation.getWorkflowVersion() : 1);
                    q.addParameter(translation.getMessageCode());
                    q.addParameter(toJson(translation.getTranslations()));
                    q.addTimestampParameter(toTimestamp(translation.getCreatedAt()));
                    q.addTimestampParameter(toTimestamp(translation.getUpdatedAt()));
                });

        return translation;
    }

    @Override
    public WorkflowTranslationModel update(WorkflowTranslationModel translation) {
        translation.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE workflow_translation SET "
                        + "workflow_name = ?, workflow_version = ?, message_code = ?, translations = ?::jsonb, updated_at = ? "
                        + "WHERE id = ?::uuid";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(translation.getWorkflowName());
                    q.addParameter(translation.getWorkflowVersion() != null ? translation.getWorkflowVersion() : 1);
                    q.addParameter(translation.getMessageCode());
                    q.addParameter(toJson(translation.getTranslations()));
                    q.addTimestampParameter(toTimestamp(translation.getUpdatedAt()));
                    q.addParameter(translation.getId().toString());
                });

        return translation;
    }

    @Override
    public Optional<WorkflowTranslationModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql = "SELECT * FROM workflow_translation WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public List<WorkflowTranslationModel> findByWorkflowNameAndVersion(
            String workflowName, Integer workflowVersion) {
        String sql =
                "SELECT * FROM workflow_translation "
                        + "WHERE workflow_name = ? AND workflow_version = ? "
                        + "ORDER BY message_code ASC";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(workflowName);
                    q.addParameter(workflowVersion != null ? workflowVersion : 1);
                    return q.executeAndFetch(
                            rs -> {
                                List<WorkflowTranslationModel> list = new ArrayList<>();
                                while (rs.next()) {
                                    list.add(mapRow(rs));
                                }
                                return list;
                            });
                });
    }

    @Override
    public Optional<WorkflowTranslationModel> findByWorkflowNameVersionAndMessageCode(
            String workflowName, Integer workflowVersion, String messageCode) {
        String sql =
                "SELECT * FROM workflow_translation "
                        + "WHERE workflow_name = ? AND workflow_version = ? AND message_code = ?";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(workflowName);
                    q.addParameter(workflowVersion != null ? workflowVersion : 1);
                    q.addParameter(messageCode);
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public boolean existsByWorkflowNameVersionAndMessageCode(
            String workflowName, Integer workflowVersion, String messageCode) {
        String sql =
                "SELECT 1 FROM workflow_translation "
                        + "WHERE workflow_name = ? AND workflow_version = ? AND message_code = ? "
                        + "LIMIT 1";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(workflowName);
                    q.addParameter(workflowVersion != null ? workflowVersion : 1);
                    q.addParameter(messageCode);
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public boolean deleteById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "DELETE FROM workflow_translation WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeUpdate() > 0;
                });
    }

    @Override
    public List<WorkflowTranslationModel> findAll() {
        String sql = "SELECT * FROM workflow_translation ORDER BY workflow_name, workflow_version, message_code";
        return queryWithTransaction(
                sql,
                q ->
                        q.executeAndFetch(
                                rs -> {
                                    List<WorkflowTranslationModel> list = new ArrayList<>();
                                    while (rs.next()) {
                                        list.add(mapRow(rs));
                                    }
                                    return list;
                                }));
    }

    @Override
    public PageResult<WorkflowTranslationModel> search(
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
            where.append(" AND LOWER(workflow_name) LIKE ?");
            params.add("%" + workflowName.trim().toLowerCase() + "%");
        }
        if (workflowVersion != null) {
            where.append(" AND workflow_version = ?");
            params.add(workflowVersion);
        }
        if (search != null && !search.isBlank()) {
            where.append(" AND (LOWER(message_code) LIKE ? OR LOWER(workflow_name) LIKE ?)");
            params.add("%" + search.trim().toLowerCase() + "%");
            params.add("%" + search.trim().toLowerCase() + "%");
        }

        String countSql = "SELECT COUNT(1) FROM workflow_translation" + where;
        Long total =
                queryWithTransaction(
                        countSql,
                        q -> {
                            for (Object p : params) {
                                applyParam(q, p);
                            }
                            return q.executeScalar(Long.class);
                        });
        long totalHits = total != null ? total : 0;

        String orderCol = "updated_at";
        if ("messageCode".equalsIgnoreCase(sortBy) || "message_code".equalsIgnoreCase(sortBy)) {
            orderCol = "message_code";
        } else if ("workflowName".equalsIgnoreCase(sortBy) || "workflow_name".equalsIgnoreCase(sortBy)) {
            orderCol = "workflow_name";
        }
        String direction = "ASC".equalsIgnoreCase(sortOrder) ? "ASC" : "DESC";

        int effectiveSize = size > 0 ? size : 20;
        int effectivePage = Math.max(0, page);
        int offset = effectivePage * effectiveSize;

        String dataSql =
                "SELECT * FROM workflow_translation"
                        + where
                        + " ORDER BY "
                        + orderCol
                        + " "
                        + direction
                        + " LIMIT ? OFFSET ?";

        List<WorkflowTranslationModel> list =
                queryWithTransaction(
                        dataSql,
                        q -> {
                            for (Object p : params) {
                                applyParam(q, p);
                            }
                            q.addParameter(effectiveSize);
                            q.addParameter(offset);
                            return q.executeAndFetch(
                                    rs -> {
                                        List<WorkflowTranslationModel> result = new ArrayList<>();
                                        while (rs.next()) {
                                            result.add(mapRow(rs));
                                        }
                                        return result;
                                    });
                        });

        return PageResult.of(list, totalHits, effectivePage, effectiveSize);
    }

    private void applyParam(Query q, Object p) {
        if (p instanceof String s) {
            q.addParameter(s);
        } else if (p instanceof Integer i) {
            q.addParameter(i);
        } else if (p instanceof Long l) {
            q.addParameter(l);
        } else if (p instanceof Boolean b) {
            q.addParameter(b);
        } else if (p != null) {
            q.addParameter(p.toString());
        }
    }

    private WorkflowTranslationModel mapRow(ResultSet rs) throws SQLException {
        WorkflowTranslationModel model = new WorkflowTranslationModel();
        model.setId(UUID.fromString(rs.getString("id")));
        model.setWorkflowName(rs.getString("workflow_name"));
        model.setWorkflowVersion(rs.getInt("workflow_version"));
        model.setMessageCode(rs.getString("message_code"));

        String translationsJson = rs.getString("translations");
        if (translationsJson != null && !translationsJson.isBlank()) {
            try {
                model.setTranslations(objectMapper.readValue(translationsJson, MAP_TYPE));
            } catch (Exception e) {
                model.setTranslations(new HashMap<>());
            }
        } else {
            model.setTranslations(new HashMap<>());
        }

        Timestamp cat = rs.getTimestamp("created_at");
        if (cat != null) {
            model.setCreatedAt(cat.toInstant());
        }
        Timestamp uat = rs.getTimestamp("updated_at");
        if (uat != null) {
            model.setUpdatedAt(uat.toInstant());
        }

        return model;
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant != null ? Timestamp.from(instant) : null;
    }
}
