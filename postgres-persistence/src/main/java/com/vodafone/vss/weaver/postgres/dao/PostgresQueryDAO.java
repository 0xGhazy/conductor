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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.database.QueryParameterDataType;
import com.vodafone.vss.weaver.dao.QueryDAO;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * PostgreSQL JDBC implementation of QueryDAO.
 */
public class PostgresQueryDAO extends PostgresBaseDAO implements QueryDAO {

    private static final TypeReference<Map<String, QueryParameterDataType>> PARAM_MAP_TYPE =
            new TypeReference<>() {};

    public PostgresQueryDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public QueryModel create(QueryModel query) {
        if (query.getId() == null) {
            query.setId(UUID.randomUUID());
        }
        if (query.getCreatedAt() == null) {
            query.setCreatedAt(Instant.now());
        }
        query.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO conductor_queries ("
                        + "id, name, description, sql_query, timeout, parameters, datasource_id, "
                        + "created_at, updated_at, created_by, updated_by"
                        + ") VALUES (?::uuid, ?, ?, ?, ?, ?::jsonb, ?::uuid, ?, ?, ?::uuid, ?::uuid)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(query.getId().toString());
                    q.addParameter(query.getName());
                    q.addParameter(query.getDescription());
                    q.addParameter(query.getSql());
                    q.addParameter(query.getTimeout() != null ? query.getTimeout() : 1000);
                    q.addParameter(
                            query.getParameters() != null ? toJson(query.getParameters()) : null);
                    q.addParameter(query.getDatasourceId().toString());
                    q.addParameter(Timestamp.from(query.getCreatedAt()));
                    q.addParameter(Timestamp.from(query.getUpdatedAt()));
                    q.addParameter(uuidText(query.getCreatedBy()));
                    q.addParameter(uuidText(query.getUpdatedBy()));
                    q.executeUpdate();
                });

        return query;
    }

    @Override
    public QueryModel update(QueryModel query) {
        query.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE conductor_queries SET "
                        + "name = ?, description = ?, sql_query = ?, timeout = ?, "
                        + "parameters = ?::jsonb, datasource_id = ?::uuid, updated_at = ?, updated_by = ?::uuid "
                        + "WHERE id = ?::uuid";

        int rows =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(query.getName());
                            q.addParameter(query.getDescription());
                            q.addParameter(query.getSql());
                            q.addParameter(query.getTimeout() != null ? query.getTimeout() : 1000);
                            q.addParameter(
                                    query.getParameters() != null
                                            ? toJson(query.getParameters())
                                            : null);
                            q.addParameter(query.getDatasourceId().toString());
                            q.addParameter(Timestamp.from(query.getUpdatedAt()));
                            q.addParameter(uuidText(query.getUpdatedBy()));
                            q.addParameter(query.getId().toString());
                            return q.executeUpdate();
                        });

        if (rows == 0) {
            throw new IllegalStateException("Query not found with id: " + query.getId());
        }

        return query;
    }

    @Override
    public Optional<QueryModel> findById(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, name, description, sql_query, timeout, parameters, datasource_id, "
                        + "created_at, updated_at, created_by, updated_by "
                        + "FROM conductor_queries WHERE id = ?::uuid";

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
    public Optional<QueryModel> findByNameAndDatasourceId(String name, UUID datasourceId) {
        if (name == null || datasourceId == null) {
            return Optional.empty();
        }
        String sql =
                "SELECT id, name, description, sql_query, timeout, parameters, datasource_id, "
                        + "created_at, updated_at, created_by, updated_by "
                        + "FROM conductor_queries WHERE name = ? AND datasource_id = ?::uuid";

        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name);
                    q.addParameter(datasourceId.toString());
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
    public List<QueryModel> findAll(
            int offset, int limit, String search, UUID datasourceId) {
        int effectiveLimit = limit > 0 ? limit : 20;
        int effectiveOffset = Math.max(0, offset);

        StringBuilder sql =
                new StringBuilder(
                        "SELECT id, name, description, sql_query, timeout, parameters, datasource_id, "
                                + "created_at, updated_at, created_by, updated_by "
                                + "FROM conductor_queries WHERE 1=1 ");

        boolean hasSearch = search != null && !search.isBlank();
        boolean hasDs = datasourceId != null;

        if (hasDs) {
            sql.append("AND datasource_id = ?::uuid ");
        }
        if (hasSearch) {
            sql.append("AND (name ILIKE ? OR description ILIKE ?) ");
        }
        sql.append("ORDER BY created_at DESC LIMIT ? OFFSET ?");

        return queryWithTransaction(
                sql.toString(),
                q -> {
                    if (hasDs) {
                        q.addParameter(datasourceId.toString());
                    }
                    if (hasSearch) {
                        String pattern = "%" + search.trim() + "%";
                        q.addParameter(pattern);
                        q.addParameter(pattern);
                    }
                    q.addParameter(effectiveLimit);
                    q.addParameter(effectiveOffset);
                    return q.executeAndFetch(
                            rs -> {
                                List<QueryModel> list = new ArrayList<>();
                                while (rs.next()) {
                                    list.add(mapRow(rs));
                                }
                                return list;
                            });
                });
    }

    @Override
    public long count(String search, UUID datasourceId) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM conductor_queries WHERE 1=1 ");
        boolean hasSearch = search != null && !search.isBlank();
        boolean hasDs = datasourceId != null;

        if (hasDs) {
            sql.append("AND datasource_id = ?::uuid ");
        }
        if (hasSearch) {
            sql.append("AND (name ILIKE ? OR description ILIKE ?) ");
        }

        return queryWithTransaction(
                sql.toString(),
                q -> {
                    if (hasDs) {
                        q.addParameter(datasourceId.toString());
                    }
                    if (hasSearch) {
                        String pattern = "%" + search.trim() + "%";
                        q.addParameter(pattern);
                        q.addParameter(pattern);
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
        String sql = "DELETE FROM conductor_queries WHERE id = ?::uuid";
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
    public int deleteByDatasourceId(UUID datasourceId) {
        if (datasourceId == null) {
            return 0;
        }
        String sql = "DELETE FROM conductor_queries WHERE datasource_id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(datasourceId.toString());
                    return q.executeUpdate();
                });
    }

    @Override
    public int reassign(UUID fromDatasourceId, UUID toDatasourceId) {
        if (fromDatasourceId == null || toDatasourceId == null) {
            return 0;
        }
        String sql =
                "UPDATE conductor_queries SET datasource_id = ?::uuid, updated_at = CURRENT_TIMESTAMP WHERE datasource_id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(toDatasourceId.toString());
                    q.addParameter(fromDatasourceId.toString());
                    return q.executeUpdate();
                });
    }

    @Override
    public long countByDatasourceId(UUID datasourceId) {
        if (datasourceId == null) {
            return 0L;
        }
        String sql = "SELECT COUNT(*) FROM conductor_queries WHERE datasource_id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(datasourceId.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return rs.getLong(1);
                                }
                                return 0L;
                            });
                });
    }

    private QueryModel mapRow(ResultSet rs) throws SQLException {
        Map<String, QueryParameterDataType> parameters = Collections.emptyMap();
        String paramJson = rs.getString("parameters");
        if (paramJson != null && !paramJson.isBlank()) {
            parameters = readValue(paramJson, PARAM_MAP_TYPE);
        }

        Timestamp createdTs = rs.getTimestamp("created_at");
        Timestamp updatedTs = rs.getTimestamp("updated_at");
        String idStr = rs.getString("id");
        String dsIdStr = rs.getString("datasource_id");

        return QueryModel.builder()
                .id(idStr != null ? UUID.fromString(idStr) : null)
                .name(rs.getString("name"))
                .description(rs.getString("description"))
                .sql(rs.getString("sql_query"))
                .timeout(rs.getInt("timeout"))
                .parameters(parameters)
                .datasourceId(dsIdStr != null ? UUID.fromString(dsIdStr) : null)
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
