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
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import javax.sql.DataSource;

import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.dao.UserLookupDAO;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * PostgreSQL implementation of UserLookupDAO querying Keycloak user_entity table via JDBC.
 */
public class PostgresUserLookupDAO extends PostgresBaseDAO implements UserLookupDAO, AutoCloseable {

    // Keycloak's own tables, read from its database. The realm can be given by name or id.
    private static final String SELECT_USERS =
            "SELECT u.id, u.username, u.first_name, u.last_name, u.email "
                    + "FROM user_entity u JOIN realm r ON r.id = u.realm_id ";
    private static final String REALM_FILTER = "(r.name = ? OR r.id = ?)";

    public PostgresUserLookupDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public Optional<UserMinimal> findByIdAndRealm(String id, String realmId) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        return findOne(SELECT_USERS + "WHERE u.id = ? AND " + REALM_FILTER, id, realmId);
    }

    @Override
    public List<UserMinimal> findByRealm(String realmId) {
        if (realmId == null || realmId.isBlank()) {
            return Collections.emptyList();
        }
        return findMany(SELECT_USERS + "WHERE " + REALM_FILTER, realmId, realmId);
    }

    @Override
    public List<UserMinimal> findAll() {
        return findMany(SELECT_USERS);
    }

    /** Closes the connection pool to the Keycloak database. */
    @Override
    public void close() {
        if (dataSource instanceof AutoCloseable closeable) {
            try {
                closeable.close();
            } catch (Exception ex) {
                logger.debug("Could not close the user lookup connection pool: {}", ex.getMessage());
            }
        }
    }

    private Optional<UserMinimal> findOne(String sql, String key, String realmId) {
        try {
            return queryWithTransaction(
                    sql,
                    q -> {
                        q.addParameter(key);
                        q.addParameter(realmId);
                        q.addParameter(realmId);
                        return q.executeAndFetch(
                                rs -> rs.next() ? Optional.of(mapUser(rs)) : Optional.<UserMinimal>empty());
                    });
        } catch (Exception ex) {
            // The lookup only decorates responses; never fail a request because of it.
            logger.debug("Could not look up Keycloak user '{}': {}", key, ex.getMessage());
            return Optional.empty();
        }
    }

    private List<UserMinimal> findMany(String sql, String... parameters) {
        try {
            return queryWithTransaction(
                    sql,
                    q -> {
                        for (String parameter : parameters) {
                            q.addParameter(parameter);
                        }
                        return q.executeAndFetch(
                                rs -> {
                                    List<UserMinimal> users = new ArrayList<>();
                                    while (rs.next()) {
                                        users.add(mapUser(rs));
                                    }
                                    return users;
                                });
                    });
        } catch (Exception ex) {
            logger.debug("Could not list Keycloak users: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private UserMinimal mapUser(ResultSet rs) throws SQLException {
        return new UserMinimal(
                rs.getString("id"),
                rs.getString("username"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("email"));
    }
}
