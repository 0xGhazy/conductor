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

import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.JdbcConnectionDetails;
import com.vodafone.vss.weaver.core.exception.NonTransientException;
import com.vodafone.vss.weaver.dao.DatasourceDAO;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * PostgreSQL JDBC implementation of DatasourceDAO.
 */
public class PostgresDatasourceDAO extends PostgresBaseDAO implements DatasourceDAO {

    /** Writes the connection with its (encrypted) password, which normal JSON leaves out. */
    private final ObjectMapper storageMapper;

    public PostgresDatasourceDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
        this.storageMapper = storageMapper(objectMapper);
    }

    /** Overrides {@code WRITE_ONLY} on the password so it is kept in the stored JSON. */
    abstract static class StoredConnectionMixin {
        @JsonProperty(access = JsonProperty.Access.READ_WRITE)
        private String password;
    }

    static ObjectMapper storageMapper(ObjectMapper objectMapper) {
        return objectMapper.copy().addMixIn(JdbcConnectionDetails.class, StoredConnectionMixin.class);
    }

    private String toStoredJson(JdbcConnectionDetails connection) {
        try {
            return storageMapper.writeValueAsString(connection);
        } catch (JsonProcessingException ex) {
            throw new NonTransientException(ex.getMessage(), ex);
        }
    }

    @Override
    public DatasourceModel create(DatasourceModel datasource) {
        if (datasource.getId() == null) {
            datasource.setId(UUID.randomUUID());
        }
        if (datasource.getVersion() == null) {
            datasource.setVersion(0L);
        }
        if (datasource.getCreatedAt() == null) {
            datasource.setCreatedAt(Instant.now());
        }
        datasource.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO conductor_datasources ("
                        + "id, name, version, type, connection, created_at, updated_at, created_by, updated_by"
                        + ") VALUES (?::uuid, ?, ?, ?, ?::jsonb, ?, ?, ?::uuid, ?::uuid)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(datasource.getId().toString());
                    q.addParameter(datasource.getName());
                    q.addParameter(datasource.getVersion());
                    q.addParameter(datasource.getType().name());
                    q.addParameter(toStoredJson(datasource.getConnection()));
                    q.addParameter(Timestamp.from(datasource.getCreatedAt()));
                    q.addParameter(Timestamp.from(datasource.getUpdatedAt()));
                    q.addParameter(uuidText(datasource.getCreatedBy()));
                    q.addParameter(uuidText(datasource.getUpdatedBy()));
                    q.executeUpdate();
                });

        return datasource;
    }

    @Override
    public DatasourceModel update(DatasourceModel datasource) {
        datasource.setUpdatedAt(Instant.now());
        Long currentVersion = datasource.getVersion() != null ? datasource.getVersion() : 0L;
        Long nextVersion = currentVersion + 1;

        String sql =
                "UPDATE conductor_datasources SET "
                        + "name = ?, version = ?, type = ?, connection = ?::jsonb, "
                        + "updated_at = ?, updated_by = ?::uuid "
                        + "WHERE id = ?::uuid AND version = ?";

        int rows =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(datasource.getName());
                            q.addParameter(nextVersion);
                            q.addParameter(datasource.getType().name());
                            q.addParameter(toStoredJson(datasource.getConnection()));
                            q.addParameter(Timestamp.from(datasource.getUpdatedAt()));
                            q.addParameter(uuidText(datasource.getUpdatedBy()));
                            q.addParameter(datasource.getId().toString());
                            q.addParameter(currentVersion);
                            return q.executeUpdate();
                        });

        if (rows == 0) {
            throw new IllegalStateException(
                    "Optimistic locking failure: datasource "
                            + datasource.getId()
                            + " was updated by another transaction");
        }

        datasource.setVersion(nextVersion);
        return datasource;
    }

    @Override
    public Optional<DatasourceModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, name, version, type, connection, created_at, updated_at, created_by, updated_by "
                        + "FROM conductor_datasources WHERE id = ?::uuid";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapRow(rs, false));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public boolean existsById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "SELECT 1 FROM conductor_datasources WHERE id = ?::uuid LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public Optional<DatasourceModel> findByName(String name) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, name, version, type, connection, created_at, updated_at, created_by, updated_by "
                        + "FROM conductor_datasources WHERE name = ?";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name);
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapRow(rs, false));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public List<DatasourceModel> findAll(
            int offset, int limit, String search, boolean minimal) {
        int effectiveLimit = limit > 0 ? limit : 20;
        int effectiveOffset = Math.max(0, offset);

        StringBuilder sql =
                new StringBuilder(
                        "SELECT id, name, version, type, connection, created_at, updated_at, created_by, updated_by "
                                + "FROM conductor_datasources ");
        boolean hasSearch = search != null && !search.isBlank();
        if (hasSearch) {
            sql.append("WHERE name ILIKE ? ");
        }
        sql.append("ORDER BY created_at DESC LIMIT ? OFFSET ?");

        return queryWithTransaction(
                sql.toString(),
                q -> {
                    if (hasSearch) {
                        q.addParameter("%" + search.trim() + "%");
                    }
                    q.addParameter(effectiveLimit);
                    q.addParameter(effectiveOffset);
                    return q.executeAndFetch(
                            rs -> {
                                List<DatasourceModel> list = new ArrayList<>();
                                while (rs.next()) {
                                    list.add(mapRow(rs, minimal));
                                }
                                return list;
                            });
                });
    }

    @Override
    public List<DatasourceModel> findAll(
            int offset, int limit, boolean minimal, String search) {
        return findAll(offset, limit, search, minimal);
    }

    @Override
    public long count(String search) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM conductor_datasources ");
        boolean hasSearch = search != null && !search.isBlank();
        if (hasSearch) {
            sql.append("WHERE name ILIKE ?");
        }

        return queryWithTransaction(
                sql.toString(),
                q -> {
                    if (hasSearch) {
                        q.addParameter("%" + search.trim() + "%");
                    }
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return rs.getLong(1);
                                }
                                return 0L;
                            });
                });
    }

    @Override
    public boolean deleteById(UUID id) {
        if (id == null) {
            return false;
        }
        String sql = "DELETE FROM conductor_datasources WHERE id = ?::uuid";
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
    public boolean existsByName(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String sql = "SELECT 1 FROM conductor_datasources WHERE name = ? LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name);
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public boolean existsByNameIgnoreCase(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String sql = "SELECT 1 FROM conductor_datasources WHERE LOWER(name) = LOWER(?) LIMIT 1";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name.trim());
                    return q.executeAndFetch(ResultSet::next);
                });
    }

    @Override
    public Optional<Long> findVersionById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql = "SELECT version FROM conductor_datasources WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(rs.getLong(1));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public void bumpVersions(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        String sql =
                "UPDATE conductor_datasources SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid";
        withTransaction(
                conn -> {
                    try (var ps = conn.prepareStatement(sql)) {
                        for (UUID id : ids) {
                            ps.setString(1, id.toString());
                            ps.addBatch();
                        }
                        ps.executeBatch();
                    } catch (SQLException e) {
                        throw new NonTransientException("Failed to bump versions: " + e.getMessage(), e);
                    }
                });
    }

    private DatasourceModel mapRow(ResultSet rs, boolean minimal) throws SQLException {
        JdbcConnectionDetails connection = null;
        if (!minimal) {
            String connJson = rs.getString("connection");
            if (connJson != null && !connJson.isBlank()) {
                connection = readValue(connJson, JdbcConnectionDetails.class);
            }
        }

        Timestamp createdTs = rs.getTimestamp("created_at");
        Timestamp updatedTs = rs.getTimestamp("updated_at");
        String idStr = rs.getString("id");

        return DatasourceModel.builder()
                .id(idStr != null ? UUID.fromString(idStr) : null)
                .name(rs.getString("name"))
                .version(rs.getLong("version"))
                .type(DatabaseType.valueOf(rs.getString("type")))
                .connection(connection)
                .createdAt(createdTs != null ? createdTs.toInstant() : null)
                .updatedAt(updatedTs != null ? updatedTs.toInstant() : null)
                .createdBy(userRef(rs.getObject("created_by", UUID.class)))
                .updatedBy(userRef(rs.getObject("updated_by", UUID.class)))
                .build();
    }

    /** The user's Keycloak id as text for a {@code ?::uuid} parameter; only the id is stored. */
    private static String uuidText(UserMinimal user) {
        return user == null || user.getId() == null ? null : user.getId();
    }

    /** A stored Keycloak user id as an id-only user; the service fills in name and email. */
    private static UserMinimal userRef(UUID id) {
        return id == null ? null : UserMinimal.ofId(id.toString());
    }
}
