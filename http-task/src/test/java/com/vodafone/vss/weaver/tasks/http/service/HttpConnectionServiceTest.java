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
package com.vodafone.vss.weaver.tasks.http.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.vodafone.vss.weaver.common.http.AuthenticationStrategy;
import com.vodafone.vss.weaver.common.http.CreateConnectionRequest;
import com.vodafone.vss.weaver.common.http.HttpConnectionModel;
import com.vodafone.vss.weaver.common.http.ShortDetailedHttpConnection;
import com.vodafone.vss.weaver.dao.HttpConnectionDAO;
import com.vodafone.vss.weaver.tasks.http.security.ApiKey;
import com.vodafone.vss.weaver.tasks.http.security.AuthStrategy;
import com.vodafone.vss.weaver.tasks.http.security.BasicAuthentication;
import com.vodafone.vss.weaver.tasks.http.security.CookieAuth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HttpConnectionServiceTest {

    @Mock
    private HttpConnectionDAO dao;

    private HttpConnectionService service;

    @BeforeEach
    void setUp() {
        service = new HttpConnectionService(dao);
    }

    @Test
    void init_loads_existing_connections_into_pool() {
        HttpConnectionModel conn1 =
                HttpConnectionModel.builder()
                        .id(UUID.randomUUID())
                        .name("TEST-API-KEY")
                        .strategy(AuthenticationStrategy.API_KEY)
                        .authConfig(Map.of("apiKey", "secret-key", "apiKeyHeader", "X-API-KEY"))
                        .build();

        HttpConnectionModel conn2 =
                HttpConnectionModel.builder()
                        .id(UUID.randomUUID())
                        .name("TEST-BASIC")
                        .strategy(AuthenticationStrategy.BASIC_AUTHENTICATION)
                        .authConfig(Map.of("username", "admin", "password", "pass123"))
                        .build();

        when(dao.findAll()).thenReturn(List.of(conn1, conn2));

        service.init();

        AuthStrategy s1 = service.getConnection("TEST-API-KEY");
        assertNotNull(s1);
        assertInstanceOf(ApiKey.class, s1);
        assertTrue(s1.testAuthentication());

        AuthStrategy s2 = service.getConnection("TEST-BASIC");
        assertNotNull(s2);
        assertInstanceOf(BasicAuthentication.class, s2);
        assertTrue(s2.testAuthentication());
    }

    @Test
    void registerConnection_creates_and_pools_connection() {
        CreateConnectionRequest request =
                new CreateConnectionRequest(
                        "COOKIE-CONN",
                        AuthenticationStrategy.COOKIE,
                        Map.of("cookie", "SESSION=abc123xyz")
                );

        when(dao.existsByName("COOKIE-CONN")).thenReturn(false);
        when(dao.create(any())).thenAnswer(inv -> {
            HttpConnectionModel m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            return m;
        });

        ShortDetailedHttpConnection created = service.registerConnection(request);

        assertNotNull(created);
        assertEquals("COOKIE-CONN", created.getName());
        assertTrue(created.isStatus());

        AuthStrategy strategy = service.getConnection("COOKIE-CONN");
        assertInstanceOf(CookieAuth.class, strategy);
    }

    @Test
    void registerConnection_fails_when_duplicate() {
        CreateConnectionRequest request =
                new CreateConnectionRequest(
                        "DUP-CONN",
                        AuthenticationStrategy.API_KEY,
                        Map.of("apiKey", "key", "apiKeyHeader", "X-Key")
                );

        when(dao.existsByName("DUP-CONN")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> service.registerConnection(request));
    }

    @Test
    void deleteConnectionById_removes_from_dao_and_pool() {
        UUID id = UUID.randomUUID();
        HttpConnectionModel conn =
                HttpConnectionModel.builder()
                        .id(id)
                        .name("DELETE-ME")
                        .strategy(AuthenticationStrategy.API_KEY)
                        .authConfig(Map.of("apiKey", "val", "apiKeyHeader", "H"))
                        .build();

        when(dao.findAll()).thenReturn(List.of(conn));
        service.init();

        assertNotNull(service.getConnection("DELETE-ME"));

        when(dao.findById(id)).thenReturn(Optional.of(conn));
        service.deleteConnectionById(id);

        verify(dao).deleteById(id);
        assertThrows(Exception.class, () -> service.getConnection("DELETE-ME"));
    }
}

