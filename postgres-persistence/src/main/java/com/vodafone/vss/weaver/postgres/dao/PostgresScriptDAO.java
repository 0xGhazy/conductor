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

import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptModel;
import com.vodafone.vss.weaver.dao.ScriptDAO;
import com.vodafone.vss.weaver.postgres.util.Query;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

public class PostgresScriptDAO extends PostgresBaseDAO implements ScriptDAO {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    public PostgresScriptDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public ScriptModel create(ScriptModel script) {
        if (script.getId() == null) {
            script.setId(UUID.randomUUID());
        }
        if (script.getCreatedAt() == null) {
            script.setCreatedAt(Instant.now());
        }
        script.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO scripts ("
                        + "id, name, description, script, language, variables, timeout, "
                        + "created_at, updated_at, created_by, updated_by"
                        + ") VALUES (?::uuid, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?::uuid, ?::uuid)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(script.getId().toString());
                    q.addParameter(script.getName());
                    q.addParameter(script.getDescription());
                    q.addParameter(script.getScript());
                    q.addParameter(script.getLanguage() != null ? script.getLanguage().name() : null);
                    q.addParameter(toJson(script.getVariables()));
                    q.addParameter(script.getTimeout() != null ? script.getTimeout() : 3000);
                    q.addTimestampParameter(toTimestamp(script.getCreatedAt()));
                    q.addTimestampParameter(toTimestamp(script.getUpdatedAt()));
                    q.addParameter(script.getCreatedBy() != null ? script.getCreatedBy().toString() : null);
                    q.addParameter(script.getUpdatedBy() != null ? script.getUpdatedBy().toString() : null);
                    q.executeUpdate();
                });

        return script;
    }

    @Override
    public ScriptModel update(ScriptModel script) {
        script.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE scripts SET "
                        + "name = ?, description = ?, script = ?, language = ?, variables = ?::jsonb, "
                        + "timeout = ?, updated_at = ?, updated_by = ?::uuid "
                        + "WHERE id = ?::uuid";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(script.getName());
                    q.addParameter(script.getDescription());
                    q.addParameter(script.getScript());
                    q.addParameter(script.getLanguage() != null ? script.getLanguage().name() : null);
                    q.addParameter(toJson(script.getVariables()));
                    q.addParameter(script.getTimeout() != null ? script.getTimeout() : 3000);
                    q.addTimestampParameter(toTimestamp(script.getUpdatedAt()));
                    q.addParameter(script.getUpdatedBy() != null ? script.getUpdatedBy().toString() : null);
                    q.addParameter(script.getId().toString());
                    q.executeUpdate();
                });

        return script;
    }

    @Override
    public Optional<ScriptModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql = "SELECT * FROM scripts WHERE id = ?::uuid";
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
    public Optional<ScriptModel> findByName(String name) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        String sql = "SELECT * FROM scripts WHERE LOWER(name) = LOWER(?)";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name.trim());
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
    public boolean existsByName(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String sql = "SELECT 1 FROM scripts WHERE LOWER(name) = LOWER(?) LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name.trim());
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public boolean existsById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "SELECT 1 FROM scripts WHERE id = ?::uuid LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public List<ScriptModel> findAll() {
        String sql = "SELECT * FROM scripts ORDER BY name ASC";
        return queryWithTransaction(
                sql,
                q ->
                        q.executeAndFetch(
                                rs -> {
                                    List<ScriptModel> list = new ArrayList<>();
                                    while (rs.next()) {
                                        list.add(mapRow(rs));
                                    }
                                    return list;
                                }));
    }

    @Override
    public PageResult<ScriptModel> search(
            String search, int page, int size, String sortBy, String sortOrder) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (search != null && !search.isBlank()) {
            where.append(" AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)");
            params.add("%" + search.trim().toLowerCase() + "%");
            params.add("%" + search.trim().toLowerCase() + "%");
        }

        String countSql = "SELECT COUNT(1) FROM scripts" + where;
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
        if ("name".equalsIgnoreCase(sortBy)) {
            orderCol = "name";
        } else if ("createdAt".equalsIgnoreCase(sortBy) || "created_at".equalsIgnoreCase(sortBy)) {
            orderCol = "created_at";
        }
        String direction = "ASC".equalsIgnoreCase(sortOrder) ? "ASC" : "DESC";

        int effectiveSize = size > 0 ? size : 20;
        int effectivePage = Math.max(0, page);
        int offset = effectivePage * effectiveSize;

        String dataSql =
                "SELECT * FROM scripts"
                        + where
                        + " ORDER BY "
                        + orderCol
                        + " "
                        + direction
                        + " LIMIT ? OFFSET ?";

        List<ScriptModel> list =
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
                                        List<ScriptModel> result = new ArrayList<>();
                                        while (rs.next()) {
                                            result.add(mapRow(rs));
                                        }
                                        return result;
                                    });
                        });

        return PageResult.of(list, totalHits, effectivePage, effectiveSize);
    }

    @Override
    public boolean deleteById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "DELETE FROM scripts WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeUpdate() > 0;
                });
    }

    @Override
    public int deleteByIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        StringBuilder placeholders = new StringBuilder();
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) {
                placeholders.append(", ");
            }
            placeholders.append("?::uuid");
        }
        String sql = "DELETE FROM scripts WHERE id IN (" + placeholders + ")";
        return queryWithTransaction(
                sql,
                q -> {
                    for (UUID id : ids) {
                        q.addParameter(id.toString());
                    }
                    return q.executeUpdate();
                });
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

    private ScriptModel mapRow(ResultSet rs) throws SQLException {
        ScriptModel model = new ScriptModel();
        model.setId(UUID.fromString(rs.getString("id")));
        model.setName(rs.getString("name"));
        model.setDescription(rs.getString("description"));
        model.setScript(rs.getString("script"));
        String lang = rs.getString("language");
        if (lang != null) {
            try {
                model.setLanguage(Languages.valueOf(lang));
            } catch (Exception ignore) {}
        }
        String variablesJson = rs.getString("variables");
        if (variablesJson != null && !variablesJson.isBlank()) {
            try {
                model.setVariables(objectMapper.readValue(variablesJson, MAP_TYPE));
            } catch (Exception e) {
                model.setVariables(new HashMap<>());
            }
        } else {
            model.setVariables(new HashMap<>());
        }
        model.setTimeout(rs.getInt("timeout"));

        Timestamp cat = rs.getTimestamp("created_at");
        if (cat != null) {
            model.setCreatedAt(cat.toInstant());
        }
        Timestamp uat = rs.getTimestamp("updated_at");
        if (uat != null) {
            model.setUpdatedAt(uat.toInstant());
        }
        String cb = rs.getString("created_by");
        if (cb != null) {
            model.setCreatedBy(UUID.fromString(cb));
        }
        String ub = rs.getString("updated_by");
        if (ub != null) {
            model.setUpdatedBy(UUID.fromString(ub));
        }

        return model;
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant != null ? Timestamp.from(instant) : null;
    }
}
