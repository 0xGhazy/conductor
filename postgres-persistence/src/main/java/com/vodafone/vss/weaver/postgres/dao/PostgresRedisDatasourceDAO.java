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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.redis.RedisDatasourceModel;
import com.vodafone.vss.weaver.dao.RedisDatasourceDAO;

import com.fasterxml.jackson.databind.ObjectMapper;

public class PostgresRedisDatasourceDAO extends PostgresBaseDAO implements RedisDatasourceDAO {

    public PostgresRedisDatasourceDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public RedisDatasourceModel create(RedisDatasourceModel datasource) {
        if (datasource.getId() == null) {
            datasource.setId(UUID.randomUUID());
        }
        if (datasource.getCreatedAt() == null) {
            datasource.setCreatedAt(Instant.now());
        }
        datasource.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO redis_instances ("
                        + "id, name, host, port, username, password, database_index, ssl, timeout_ms, active, "
                        + "created_at, updated_at, created_by, updated_by"
                        + ") VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::uuid, ?::uuid)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(datasource.getId().toString());
                    q.addParameter(datasource.getName());
                    q.addParameter(datasource.getHost());
                    q.addParameter(datasource.getPort() != null ? datasource.getPort() : 6379);
                    q.addParameter(datasource.getUsername());
                    q.addParameter(datasource.getPassword());
                    q.addParameter(datasource.getDatabaseIndex() != null ? datasource.getDatabaseIndex() : 0);
                    q.addParameter(Boolean.TRUE.equals(datasource.getSsl()));
                    q.addParameter(datasource.getTimeoutMs() != null ? datasource.getTimeoutMs() : 2000);
                    q.addParameter(!Boolean.FALSE.equals(datasource.getActive()));
                    q.addTimestampParameter(toTimestamp(datasource.getCreatedAt()));
                    q.addTimestampParameter(toTimestamp(datasource.getUpdatedAt()));
                    q.addParameter(datasource.getCreatedBy() != null ? datasource.getCreatedBy().toString() : null);
                    q.addParameter(datasource.getUpdatedBy() != null ? datasource.getUpdatedBy().toString() : null);
                });

        return datasource;
    }

    @Override
    public RedisDatasourceModel update(RedisDatasourceModel datasource) {
        datasource.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE redis_instances SET "
                        + "name = ?, host = ?, port = ?, username = ?, password = ?, database_index = ?, "
                        + "ssl = ?, timeout_ms = ?, active = ?, updated_at = ?, updated_by = ?::uuid "
                        + "WHERE id = ?::uuid";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(datasource.getName());
                    q.addParameter(datasource.getHost());
                    q.addParameter(datasource.getPort() != null ? datasource.getPort() : 6379);
                    q.addParameter(datasource.getUsername());
                    q.addParameter(datasource.getPassword());
                    q.addParameter(datasource.getDatabaseIndex() != null ? datasource.getDatabaseIndex() : 0);
                    q.addParameter(Boolean.TRUE.equals(datasource.getSsl()));
                    q.addParameter(datasource.getTimeoutMs() != null ? datasource.getTimeoutMs() : 2000);
                    q.addParameter(!Boolean.FALSE.equals(datasource.getActive()));
                    q.addTimestampParameter(toTimestamp(datasource.getUpdatedAt()));
                    q.addParameter(datasource.getUpdatedBy() != null ? datasource.getUpdatedBy().toString() : null);
                    q.addParameter(datasource.getId().toString());
                });

        return datasource;
    }

    @Override
    public Optional<RedisDatasourceModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql = "SELECT * FROM redis_instances WHERE id = ?::uuid";
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
    public Optional<RedisDatasourceModel> findByName(String name) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        String sql = "SELECT * FROM redis_instances WHERE LOWER(name) = LOWER(?)";
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
        String sql = "SELECT 1 FROM redis_instances WHERE LOWER(name) = LOWER(?) LIMIT 1";
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
        String sql = "SELECT 1 FROM redis_instances WHERE id = ?::uuid LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public List<RedisDatasourceModel> findAll() {
        String sql = "SELECT * FROM redis_instances ORDER BY name ASC";
        return queryWithTransaction(
                sql,
                q ->
                        q.executeAndFetch(
                                rs -> {
                                    List<RedisDatasourceModel> list = new ArrayList<>();
                                    while (rs.next()) {
                                        list.add(mapRow(rs));
                                    }
                                    return list;
                                }));
    }

    @Override
    public boolean deleteById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "DELETE FROM redis_instances WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeUpdate() > 0;
                });
    }

    private RedisDatasourceModel mapRow(ResultSet rs) throws SQLException {
        RedisDatasourceModel model = new RedisDatasourceModel();
        model.setId(UUID.fromString(rs.getString("id")));
        model.setName(rs.getString("name"));
        model.setHost(rs.getString("host"));
        model.setPort(rs.getInt("port"));
        model.setUsername(rs.getString("username"));
        model.setPassword(rs.getString("password"));
        model.setDatabaseIndex(rs.getInt("database_index"));
        model.setSsl(rs.getBoolean("ssl"));
        model.setTimeoutMs(rs.getInt("timeout_ms"));
        model.setActive(rs.getBoolean("active"));

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
