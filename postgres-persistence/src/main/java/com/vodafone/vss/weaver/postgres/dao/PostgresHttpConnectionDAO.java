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

import com.vodafone.vss.weaver.common.http.AuthenticationStrategy;
import com.vodafone.vss.weaver.common.http.HttpConnectionModel;
import com.vodafone.vss.weaver.dao.HttpConnectionDAO;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * PostgreSQL JDBC implementation of HttpConnectionDAO.
 */
public class PostgresHttpConnectionDAO extends PostgresBaseDAO implements HttpConnectionDAO {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    public PostgresHttpConnectionDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public HttpConnectionModel create(HttpConnectionModel connection) {
        if (connection.getId() == null) {
            connection.setId(UUID.randomUUID());
        }
        if (connection.getCreatedAt() == null) {
            connection.setCreatedAt(Instant.now());
        }
        connection.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO http_connections ("
                        + "id, name, strategy, auth_config, created_at, updated_at, last_check, error"
                        + ") VALUES (?::uuid, ?, ?, ?::jsonb, ?, ?, ?, ?)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(connection.getId().toString());
                    q.addParameter(connection.getName());
                    q.addParameter(connection.getStrategy() != null ? connection.getStrategy().name() : null);
                    q.addParameter(toJson(connection.getAuthConfig()));
                    q.addTimestampParameter(toTimestamp(connection.getCreatedAt()));
                    q.addTimestampParameter(toTimestamp(connection.getUpdatedAt()));
                    q.addTimestampParameter(toTimestamp(connection.getLastCheck()));
                    q.addParameter(connection.getError());
                    q.executeUpdate();
                });

        return connection;
    }

    @Override
    public HttpConnectionModel update(HttpConnectionModel connection) {
        connection.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE http_connections SET "
                        + "name = ?, strategy = ?, auth_config = ?::jsonb, updated_at = ?, last_check = ?, error = ? "
                        + "WHERE id = ?::uuid";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(connection.getName());
                    q.addParameter(connection.getStrategy() != null ? connection.getStrategy().name() : null);
                    q.addParameter(toJson(connection.getAuthConfig()));
                    q.addTimestampParameter(toTimestamp(connection.getUpdatedAt()));
                    q.addTimestampParameter(toTimestamp(connection.getLastCheck()));
                    q.addParameter(connection.getError());
                    q.addParameter(connection.getId().toString());
                    q.executeUpdate();
                });

        return connection;
    }

    @Override
    public Optional<HttpConnectionModel> findById(UUID id) {
        if (id == null) return Optional.empty();
        String sql = "SELECT * FROM http_connections WHERE id = ?::uuid";
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
    public Optional<HttpConnectionModel> findByName(String name) {
        if (name == null) return Optional.empty();
        String sql = "SELECT * FROM http_connections WHERE LOWER(name) = LOWER(?)";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name);
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
        if (name == null) return false;
        String sql = "SELECT COUNT(1) FROM http_connections WHERE LOWER(name) = LOWER(?)";
        Long count =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(name);
                            return q.executeScalar(Long.class);
                        });
        return count != null && count > 0;
    }

    @Override
    public boolean existsById(UUID id) {
        if (id == null) return false;
        String sql = "SELECT COUNT(1) FROM http_connections WHERE id = ?::uuid";
        Long count =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(id.toString());
                            return q.executeScalar(Long.class);
                        });
        return count != null && count > 0;
    }

    @Override
    public List<HttpConnectionModel> findAll() {
        String sql = "SELECT * FROM http_connections ORDER BY name ASC";
        return queryWithTransaction(
                sql,
                q ->
                        q.executeAndFetch(
                                rs -> {
                                    List<HttpConnectionModel> list = new ArrayList<>();
                                    while (rs.next()) {
                                        list.add(mapRow(rs));
                                    }
                                    return list;
                                }));
    }

    @Override
    public boolean deleteById(UUID id) {
        if (id == null) return false;
        String sql = "DELETE FROM http_connections WHERE id = ?::uuid";
        int rows =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(id.toString());
                            return q.executeUpdate();
                        });
        return rows > 0;
    }

    @Override
    public List<HttpConnectionModel> findByAuthConfigLike(String pattern) {
        String sql = "SELECT * FROM http_connections WHERE auth_config::text LIKE ?";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(pattern);
                    return q.executeAndFetch(
                            rs -> {
                                List<HttpConnectionModel> list = new ArrayList<>();
                                while (rs.next()) {
                                    list.add(mapRow(rs));
                                }
                                return list;
                            });
                });
    }

    private HttpConnectionModel mapRow(ResultSet rs) throws SQLException {
        HttpConnectionModel model = new HttpConnectionModel();
        model.setId(UUID.fromString(rs.getString("id")));
        model.setName(rs.getString("name"));
        String strat = rs.getString("strategy");
        if (strat != null) {
            try {
                model.setStrategy(AuthenticationStrategy.valueOf(strat));
            } catch (Exception ignored) {}
        }
        model.setAuthConfig(readJsonMap(rs.getString("auth_config")));
        model.setCreatedAt(toInstant(rs.getTimestamp("created_at")));
        model.setUpdatedAt(toInstant(rs.getTimestamp("updated_at")));
        model.setLastCheck(toInstant(rs.getTimestamp("last_check")));
        model.setError(rs.getString("error"));
        return model;
    }

    private Map<String, Object> readJsonMap(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant != null ? Timestamp.from(instant) : null;
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp != null ? timestamp.toInstant() : null;
    }
}
