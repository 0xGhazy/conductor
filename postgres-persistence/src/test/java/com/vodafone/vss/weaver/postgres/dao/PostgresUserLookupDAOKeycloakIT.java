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

import java.util.List;
import java.util.Optional;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.audit.UserMinimal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

/**
 * Runs the user lookup SQL against a real Keycloak database. Skipped unless a URL is given:
 *
 * <pre>
 * ./mvnw -pl postgres-persistence test -Dtest=PostgresUserLookupDAOKeycloakIT \
 *   -Dkeycloak.lookup.url=jdbc:postgresql://localhost:5432/keycloak \
 *   -Dkeycloak.lookup.username=keycloak_reader -Dkeycloak.lookup.password=keycloak_reader
 * </pre>
 *
 * Expects the "weaver" realm imported from docker/keycloak/weaver-realm.json (user "admin").
 */
public class PostgresUserLookupDAOKeycloakIT {

    private PostgresUserLookupDAO dao;

    @Before
    public void setUp() {
        String url = System.getProperty("keycloak.lookup.url");
        assumeTrue("set -Dkeycloak.lookup.url to run", url != null && !url.isBlank());
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(System.getProperty("keycloak.lookup.username", "keycloak_reader"));
        config.setPassword(System.getProperty("keycloak.lookup.password", "keycloak_reader"));
        config.setReadOnly(true);
        config.setMaximumPoolSize(1);
        dao = new PostgresUserLookupDAO(new RetryTemplate(), new ObjectMapper(), new HikariDataSource(config));
    }

    @After
    public void tearDown() {
        if (dao != null) {
            dao.close();
        }
    }

    @Test
    public void findsUsersByRealmNameAndId() {
        List<UserMinimal> users = dao.findByRealm("weaver");
        assertFalse(users.isEmpty());

        UserMinimal admin = users.stream()
                .filter(u -> "admin@conductor.local".equals(u.getEmail()))
                .findFirst()
                .orElseThrow();
        assertEquals("Conductor Admin", admin.getName());

        Optional<UserMinimal> byId = dao.findByIdAndRealm(admin.getId(), "weaver");
        assertEquals(admin.getId(), byId.orElseThrow().getId());

        assertTrue(dao.findByIdAndRealm(admin.getId(), "no-such-realm").isEmpty());
        assertTrue(dao.findByIdAndRealm("system", "weaver").isEmpty());
    }
}
