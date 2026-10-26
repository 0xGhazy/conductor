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
public class PostgresUserLookupDAO extends PostgresBaseDAO implements UserLookupDAO {

    public PostgresUserLookupDAO(
            RetryTemplate retryTemplate, ObjectMapper objectMapper, DataSource dataSource) {
        super(retryTemplate, objectMapper, dataSource);
    }

    @Override
    public Optional<UserMinimal> findByIdAndRealm(String id, String realmId) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        try {
            String sql =
                    "SELECT id, username, first_name, last_name, email FROM keycloak.user_entity "
                            + "WHERE id = ? AND realm_id = ?";
            return queryWithTransaction(
                    sql,
                    q -> {
                        q.addParameter(id);
                        q.addParameter(realmId);
                        return q.executeAndFetch(
                                rs -> {
                                    if (rs.next()) {
                                        return Optional.of(mapUser(rs));
                                    }
                                    return Optional.empty();
                                });
                    });
        } catch (Exception ex) {
            logger.debug("Could not query keycloak.user_entity for user '{}': {}", id, ex.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public List<UserMinimal> findByRealm(String realmId) {
        if (realmId == null || realmId.isBlank()) {
            return Collections.emptyList();
        }
        try {
            String sql =
                    "SELECT id, username, first_name, last_name, email FROM keycloak.user_entity "
                            + "WHERE realm_id = ?";
            return queryWithTransaction(
                    sql,
                    q -> {
                        q.addParameter(realmId);
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
            logger.debug(
                    "Could not query keycloak.user_entity for realm '{}': {}",
                    realmId,
                    ex.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    public List<UserMinimal> findAll() {
        try {
            String sql = "SELECT id, username, first_name, last_name, email FROM keycloak.user_entity";
            return queryWithTransaction(
                    sql,
                    q ->
                            q.executeAndFetch(
                                    rs -> {
                                        List<UserMinimal> users = new ArrayList<>();
                                        while (rs.next()) {
                                            users.add(mapUser(rs));
                                        }
                                        return users;
                                    }));
        } catch (Exception ex) {
            logger.debug("Could not query keycloak.user_entity for all users: {}", ex.getMessage());
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
