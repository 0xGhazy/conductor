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

import com.vodafone.vss.weaver.common.http.ApiCollectionEndpointModel;
import com.vodafone.vss.weaver.common.http.ApiCollectionModel;
import com.vodafone.vss.weaver.common.http.ApiCollectionType;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.dao.ApiCollectionDAO;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * PostgreSQL JDBC implementation of ApiCollectionDAO.
 */
public class PostgresApiCollectionDAO extends PostgresBaseDAO implements ApiCollectionDAO {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    public PostgresApiCollectionDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    // --- Collections ---

    @Override
    public ApiCollectionModel createCollection(ApiCollectionModel collection) {
        if (collection.getId() == null) {
            collection.setId(UUID.randomUUID());
        }
        if (collection.getCreatedAt() == null) {
            collection.setCreatedAt(Instant.now());
        }
        collection.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO api_collections ("
                        + "id, name, description, connection, type, created_at, created_by, updated_at, updated_by"
                        + ") VALUES (?::uuid, ?, ?, ?::uuid, ?, ?, ?::uuid, ?, ?::uuid)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(collection.getId().toString());
                    q.addParameter(collection.getName());
                    q.addParameter(collection.getDescription());
                    q.addParameter(collection.getConnection() != null ? collection.getConnection().toString() : null);
                    q.addParameter(collection.getType() != null ? collection.getType().name() : null);
                    q.addTimestampParameter(toTimestamp(collection.getCreatedAt()));
                    q.addParameter(collection.getCreatedBy() != null ? collection.getCreatedBy().toString() : null);
                    q.addTimestampParameter(toTimestamp(collection.getUpdatedAt()));
                    q.addParameter(collection.getUpdatedBy() != null ? collection.getUpdatedBy().toString() : null);
                });

        return collection;
    }

    @Override
    public ApiCollectionModel updateCollection(ApiCollectionModel collection) {
        collection.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE api_collections SET "
                        + "name = ?, description = ?, connection = ?::uuid, type = ?, updated_at = ?, updated_by = ?::uuid "
                        + "WHERE id = ?::uuid";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(collection.getName());
                    q.addParameter(collection.getDescription());
                    q.addParameter(collection.getConnection() != null ? collection.getConnection().toString() : null);
                    q.addParameter(collection.getType() != null ? collection.getType().name() : null);
                    q.addTimestampParameter(toTimestamp(collection.getUpdatedAt()));
                    q.addParameter(collection.getUpdatedBy() != null ? collection.getUpdatedBy().toString() : null);
                    q.addParameter(collection.getId().toString());
                });

        return collection;
    }

    @Override
    public Optional<ApiCollectionModel> findCollectionById(UUID id) {
        if (id == null) return Optional.empty();
        String sql = "SELECT * FROM api_collections WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapCollectionRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public Optional<ApiCollectionModel> findCollectionByName(String name) {
        if (name == null) return Optional.empty();
        String sql = "SELECT * FROM api_collections WHERE LOWER(name) = LOWER(?)";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(name);
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapCollectionRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public boolean existsCollectionByName(String name) {
        if (name == null) return false;
        String sql = "SELECT COUNT(1) FROM api_collections WHERE LOWER(name) = LOWER(?)";
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
    public boolean existsCollectionById(UUID id) {
        if (id == null) return false;
        String sql = "SELECT COUNT(1) FROM api_collections WHERE id = ?::uuid";
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
    public PageResult<ApiCollectionModel> listCollections(int page, int size) {
        int effectiveSize = size > 0 ? size : 20;
        int effectivePage = Math.max(0, page);
        int offset = effectivePage * effectiveSize;

        String countSql = "SELECT COUNT(1) FROM api_collections";
        Long total = queryWithTransaction(countSql, q -> q.executeScalar(Long.class));
        long totalHits = total != null ? total : 0;

        String sql = "SELECT * FROM api_collections ORDER BY name ASC LIMIT ? OFFSET ?";
        List<ApiCollectionModel> items =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(effectiveSize);
                            q.addParameter(offset);
                            return q.executeAndFetch(
                                    rs -> {
                                        List<ApiCollectionModel> list = new ArrayList<>();
                                        while (rs.next()) {
                                            list.add(mapCollectionRow(rs));
                                        }
                                        return list;
                                    });
                        });

        return PageResult.of(items, totalHits, effectivePage, effectiveSize);
    }

    @Override
    public boolean deleteCollectionById(UUID id) {
        if (id == null) return false;
        String sql = "DELETE FROM api_collections WHERE id = ?::uuid";
        int rows =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(id.toString());
                            return q.executeUpdate();
                        });
        return rows > 0;
    }

    // --- Endpoints ---

    @Override
    public ApiCollectionEndpointModel createEndpoint(ApiCollectionEndpointModel endpoint) {
        if (endpoint.getId() == null) {
            endpoint.setId(UUID.randomUUID());
        }
        if (endpoint.getCreatedAt() == null) {
            endpoint.setCreatedAt(Instant.now());
        }
        endpoint.setUpdatedAt(Instant.now());

        String sql =
                "INSERT INTO api_collections_endpoints ("
                        + "id, name, description, collection, connection, config, created_at, created_by, updated_at, updated_by"
                        + ") VALUES (?::uuid, ?, ?, ?::uuid, ?::uuid, ?::jsonb, ?, ?::uuid, ?, ?::uuid)";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(endpoint.getId().toString());
                    q.addParameter(endpoint.getName());
                    q.addParameter(endpoint.getDescription());
                    q.addParameter(endpoint.getCollection().toString());
                    q.addParameter(endpoint.getConnection() != null ? endpoint.getConnection().toString() : null);
                    q.addParameter(toJson(endpoint.getConfig()));
                    q.addTimestampParameter(toTimestamp(endpoint.getCreatedAt()));
                    q.addParameter(endpoint.getCreatedBy() != null ? endpoint.getCreatedBy().toString() : null);
                    q.addTimestampParameter(toTimestamp(endpoint.getUpdatedAt()));
                    q.addParameter(endpoint.getUpdatedBy() != null ? endpoint.getUpdatedBy().toString() : null);
                });

        return endpoint;
    }

    @Override
    public ApiCollectionEndpointModel updateEndpoint(ApiCollectionEndpointModel endpoint) {
        endpoint.setUpdatedAt(Instant.now());

        String sql =
                "UPDATE api_collections_endpoints SET "
                        + "name = ?, description = ?, connection = ?::uuid, config = ?::jsonb, updated_at = ?, updated_by = ?::uuid "
                        + "WHERE id = ?::uuid";

        executeWithTransaction(
                sql,
                q -> {
                    q.addParameter(endpoint.getName());
                    q.addParameter(endpoint.getDescription());
                    q.addParameter(endpoint.getConnection() != null ? endpoint.getConnection().toString() : null);
                    q.addParameter(toJson(endpoint.getConfig()));
                    q.addTimestampParameter(toTimestamp(endpoint.getUpdatedAt()));
                    q.addParameter(endpoint.getUpdatedBy() != null ? endpoint.getUpdatedBy().toString() : null);
                    q.addParameter(endpoint.getId().toString());
                });

        return endpoint;
    }

    @Override
    public Optional<ApiCollectionEndpointModel> findEndpointById(UUID id) {
        if (id == null) return Optional.empty();
        String sql = "SELECT * FROM api_collections_endpoints WHERE id = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(id.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapEndpointRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public Optional<ApiCollectionEndpointModel> findEndpointByIdAndCollection(UUID endpointId, UUID collectionId) {
        if (endpointId == null || collectionId == null) return Optional.empty();
        String sql = "SELECT * FROM api_collections_endpoints WHERE id = ?::uuid AND collection = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(endpointId.toString());
                    q.addParameter(collectionId.toString());
                    return q.executeAndFetch(
                            rs -> {
                                if (rs.next()) {
                                    return Optional.of(mapEndpointRow(rs));
                                }
                                return Optional.empty();
                            });
                });
    }

    @Override
    public PageResult<ApiCollectionEndpointModel> listEndpointsByCollection(UUID collectionId, int page, int size) {
        int effectiveSize = size > 0 ? size : 50;
        int effectivePage = Math.max(0, page);
        int offset = effectivePage * effectiveSize;

        String countSql = "SELECT COUNT(1) FROM api_collections_endpoints WHERE collection = ?::uuid";
        Long total =
                queryWithTransaction(
                        countSql,
                        q -> {
                            q.addParameter(collectionId.toString());
                            return q.executeScalar(Long.class);
                        });
        long totalHits = total != null ? total : 0;

        String sql = "SELECT * FROM api_collections_endpoints WHERE collection = ?::uuid ORDER BY name ASC LIMIT ? OFFSET ?";
        List<ApiCollectionEndpointModel> items =
                queryWithTransaction(
                        sql,
                        q -> {
                            q.addParameter(collectionId.toString());
                            q.addParameter(effectiveSize);
                            q.addParameter(offset);
                            return q.executeAndFetch(
                                    rs -> {
                                        List<ApiCollectionEndpointModel> list = new ArrayList<>();
                                        while (rs.next()) {
                                            list.add(mapEndpointRow(rs));
                                        }
                                        return list;
                                    });
                        });

        return PageResult.of(items, totalHits, effectivePage, effectiveSize);
    }

    @Override
    public boolean deleteEndpointById(UUID id) {
        if (id == null) return false;
        String sql = "DELETE FROM api_collections_endpoints WHERE id = ?::uuid";
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
    public int deleteEndpointsByCollection(UUID collectionId) {
        if (collectionId == null) return 0;
        String sql = "DELETE FROM api_collections_endpoints WHERE collection = ?::uuid";
        return queryWithTransaction(
                sql,
                q -> {
                    q.addParameter(collectionId.toString());
                    return q.executeUpdate();
                });
    }

    private ApiCollectionModel mapCollectionRow(ResultSet rs) throws SQLException {
        ApiCollectionModel model = new ApiCollectionModel();
        model.setId(UUID.fromString(rs.getString("id")));
        model.setName(rs.getString("name"));
        model.setDescription(rs.getString("description"));
        String conn = rs.getString("connection");
        if (conn != null) {
            model.setConnection(UUID.fromString(conn));
        }
        String type = rs.getString("type");
        if (type != null) {
            try {
                model.setType(ApiCollectionType.valueOf(type));
            } catch (Exception ignored) {}
        }
        model.setCreatedAt(toInstant(rs.getTimestamp("created_at")));
        String createdBy = rs.getString("created_by");
        if (createdBy != null) {
            model.setCreatedBy(UUID.fromString(createdBy));
        }
        model.setUpdatedAt(toInstant(rs.getTimestamp("updated_at")));
        String updatedBy = rs.getString("updated_by");
        if (updatedBy != null) {
            model.setUpdatedBy(UUID.fromString(updatedBy));
        }
        return model;
    }

    private ApiCollectionEndpointModel mapEndpointRow(ResultSet rs) throws SQLException {
        ApiCollectionEndpointModel model = new ApiCollectionEndpointModel();
        model.setId(UUID.fromString(rs.getString("id")));
        model.setName(rs.getString("name"));
        model.setDescription(rs.getString("description"));
        model.setCollection(UUID.fromString(rs.getString("collection")));
        String conn = rs.getString("connection");
        if (conn != null) {
            model.setConnection(UUID.fromString(conn));
        }
        model.setConfig(readJsonMap(rs.getString("config")));
        model.setCreatedAt(toInstant(rs.getTimestamp("created_at")));
        String createdBy = rs.getString("created_by");
        if (createdBy != null) {
            model.setCreatedBy(UUID.fromString(createdBy));
        }
        model.setUpdatedAt(toInstant(rs.getTimestamp("updated_at")));
        String updatedBy = rs.getString("updated_by");
        if (updatedBy != null) {
            model.setUpdatedBy(UUID.fromString(updatedBy));
        }
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
