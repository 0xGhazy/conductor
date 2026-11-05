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
package com.vodafone.vss.weaver.actions.database.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

import com.vodafone.vss.weaver.actions.database.dto.DatabaseConnectionRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatabaseRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.registry.DatasourceConfigProvider;
import com.vodafone.vss.weaver.actions.database.util.PasswordEncryptionUtil;
import com.vodafone.vss.weaver.audit.aspect.AuditAspect;
import com.vodafone.vss.weaver.audit.config.AuditProperties;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.audit.AuditEvent;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.PingResult;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.dao.AuditDAO;
import com.vodafone.vss.weaver.dao.DatasourceDAO;
import com.vodafone.vss.weaver.dao.QueryDAO;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Creating and updating databases and queries is audited: the real services, behind the real
 * Spring proxy and AuditAspect, with only storage mocked.
 */
class DatabaseAuditTest {

    private static final UUID DB_ID = UUID.fromString("6f1c2a7e-0d2b-4b8e-9c1a-0000000000d1");
    private static final UUID QUERY_ID = UUID.fromString("6f1c2a7e-0d2b-4b8e-9c1a-0000000000a1");

    static final AuditDAO AUDIT_DAO = mock(AuditDAO.class);
    static final DatasourceDAO DATASOURCE_DAO = mock(DatasourceDAO.class);
    static final QueryDAO QUERY_DAO = mock(QueryDAO.class);

    @Configuration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class Config {
        @Bean
        AuditAspect auditAspect() {
            AuditProperties properties = new AuditProperties();
            properties.setEnabled(true);
            properties.setCapturePayloads(true);
            AuditSecurityHelper security = mock(AuditSecurityHelper.class);
            when(security.resolveCurrentActor()).thenReturn(AuditSecurityHelper.ActorContext.builder()
                    .actorId("b4cc7258-ede7-4774-ad7b-9c798ee99cd1").actorUsername("admin").actorName("Conductor Admin").build());
            return new AuditAspect(properties, security, AUDIT_DAO);
        }

        @Bean
        QueryService queryService() {
            return new QueryService(QUERY_DAO, DATASOURCE_DAO, mock(QueryExecutorService.class), 10, 60, 100, Duration.ofSeconds(10));
        }

        @Bean
        DatasourceService datasourceService() {
            DynamicDataSourceManager manager = mock(DynamicDataSourceManager.class);
            DatasourceConfigProvider provider = mock(DatasourceConfigProvider.class);
            when(manager.getConfigProvider()).thenReturn(provider);
            when(provider.toResolvedConfig(any())).thenReturn(mock(DatasourceConfig.class));
            when(manager.testConnection(any())).thenReturn(new PingResult(true, null, null));
            return new DatasourceService(QUERY_DAO, DATASOURCE_DAO, manager, null);
        }
    }

    private AnnotationConfigApplicationContext context;
    private QueryService queryService;
    private DatasourceService datasourceService;

    @BeforeAll
    static void configureKey() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        PasswordEncryptionUtil.configure(new Encryption(Base64.getEncoder().encodeToString(key)));
    }

    @AfterAll
    static void clearKey() {
        PasswordEncryptionUtil.configure(null);
    }

    @BeforeEach
    void setUp() {
        reset(AUDIT_DAO, DATASOURCE_DAO, QUERY_DAO);
        context = new AnnotationConfigApplicationContext(Config.class);
        queryService = context.getBean(QueryService.class);
        datasourceService = context.getBean(DatasourceService.class);

        DatasourceModel saved = DatasourceModel.builder().id(DB_ID).name("orders").type(DatabaseType.POSTGRES).version(1L).build();
        when(DATASOURCE_DAO.findById(DB_ID)).thenReturn(Optional.of(saved));
        when(DATASOURCE_DAO.create(any())).thenAnswer(inv -> {
            DatasourceModel model = inv.getArgument(0);
            model.setId(DB_ID);
            return model;
        });
        when(DATASOURCE_DAO.update(any())).thenAnswer(inv -> inv.getArgument(0));
        when(QUERY_DAO.create(any())).thenAnswer(inv -> {
            QueryModel model = inv.getArgument(0);
            model.setId(QUERY_ID);
            return model;
        });
        when(QUERY_DAO.findById(QUERY_ID)).thenReturn(Optional.of(query()));
        when(QUERY_DAO.update(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    private static QueryModel query() {
        QueryModel query = QueryModel.builder().name("active orders").sql("SELECT 1").datasourceId(DB_ID).build();
        query.setId(QUERY_ID);
        return query;
    }

    private static DatabaseRequest database(String password) {
        return DatabaseRequest.builder()
                .name("orders")
                .type(DatabaseType.POSTGRES)
                .connection(DatabaseConnectionRequest.builder()
                        .url("jdbc:postgresql://localhost:5432/orders").username("app").password(password)
                        .properties(java.util.Map.of("password", "in-properties"))
                        .build())
                .build();
    }

    private AuditEvent onlyEvent() {
        ArgumentCaptor<AuditEvent> event = ArgumentCaptor.forClass(AuditEvent.class);
        verify(AUDIT_DAO, times(1)).log(event.capture());
        return event.getValue();
    }

    @Test
    void createDatabaseIsAuditedWithTheNewId() {
        datasourceService.create(database("s3cret!"));

        AuditEvent event = onlyEvent();
        assertEquals("createDatabase", event.getAction());
        assertEquals("DATABASE", event.getResourceType());
        assertEquals(DB_ID.toString(), event.getResourceId());
        assertEquals(AuditEvent.STATUS_SUCCESS, event.getStatus());
        assertEquals("Conductor Admin", event.getActorName());
    }

    @Test
    void updateDatabaseIsAuditedWithItsId() {
        datasourceService.update(DB_ID, database(null));

        AuditEvent event = onlyEvent();
        assertEquals("updateDatabase", event.getAction());
        assertEquals("DATABASE", event.getResourceType());
        assertEquals(DB_ID.toString(), event.getResourceId());
    }

    @Test
    void auditDetailsNeverContainTheDatabasePassword() {
        datasourceService.create(database("s3cret!"));

        String details = String.valueOf(onlyEvent().getDetails());
        assertTrue(details.contains("orders"), details);
        assertFalse(details.contains("s3cret!"), details);
        assertFalse(details.contains("in-properties"), details);
    }

    @Test
    void createQueryIsAuditedWithTheNewId() {
        queryService.create(QueryModel.builder().name("active orders").sql("SELECT 1").datasourceId(DB_ID).build());

        AuditEvent event = onlyEvent();
        assertEquals("createQuery", event.getAction());
        assertEquals("QUERY", event.getResourceType());
        assertEquals(QUERY_ID.toString(), event.getResourceId());
    }

    @Test
    void updateQueryIsAuditedWithItsId() {
        queryService.update(QUERY_ID, query());

        AuditEvent event = onlyEvent();
        assertEquals("updateQuery", event.getAction());
        assertEquals("QUERY", event.getResourceType());
        assertEquals(QUERY_ID.toString(), event.getResourceId());
    }

    @Test
    void rejectedChangesAreAuditedAsFailed() {
        assertThrows(BusinessException.class, () -> queryService.create(new QueryModel()));

        AuditEvent event = onlyEvent();
        assertEquals("createQuery", event.getAction());
        assertEquals(AuditEvent.STATUS_FAILED, event.getStatus());
        assertNotNull(event.getErrorMessage());
    }

    @Test
    void readsAreNotAudited() {
        queryService.get(QUERY_ID, false);
        queryService.list(DB_ID, false, null, 0, 20);
        datasourceService.get(DB_ID);

        verify(AUDIT_DAO, never()).log(any());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> changesOf(AuditEvent event) {
        return (Map<String, Object>) event.getDetails().get("changes");
    }

    @Test
    void updateQueryRecordsOnlyTheChangedFields() {
        QueryModel changed = query();
        changed.setTimeout(5000);
        changed.setDescription("Daily totals");

        queryService.update(QUERY_ID, changed);

        AuditEvent event = onlyEvent();
        assertEquals("active orders", event.getDetails().get("name"));
        Map<String, Object> changes = changesOf(event);
        assertEquals(Set.of("timeout", "description"), changes.keySet());
        assertEquals(Map.of("from", 1000, "to", 5000), changes.get("timeout"));
        assertFalse(event.getDetails().containsKey("arg0"), "raw arguments are not stored");
        assertFalse(event.getDetails().containsKey("arg1"));
    }

    @Test
    void createQueryRecordsTheInitialValues() {
        queryService.create(QueryModel.builder().name("active orders").sql("SELECT 1").datasourceId(DB_ID).build());

        Map<String, Object> changes = changesOf(onlyEvent());
        assertEquals(Map.of("to", "active orders"), changes.get("name"));
        assertEquals(Map.of("to", "SELECT 1"), changes.get("sql"));
        assertEquals(Map.of("to", DB_ID.toString()), changes.get("datasourceId"));
    }

    @Test
    void createDatabaseMarksThePasswordAndListsOnlyPropertyNames() {
        datasourceService.create(database("s3cret!"));

        Map<String, Object> changes = changesOf(onlyEvent());
        assertEquals(Map.of("to", "******"), changes.get("connection.password"));
        assertEquals(Map.of("to", new java.util.TreeSet<>(Set.of("password"))), changes.get("connection.properties"));
        assertEquals(Map.of("to", "jdbc:postgresql://localhost:5432/orders"), changes.get("connection.url"));
    }

    @Test
    void updateDatabaseNotesANewPasswordWithoutItsValue() {
        DatasourceModel stored = DatasourceModel.builder().id(DB_ID).name("orders").type(DatabaseType.POSTGRES).version(1L)
                .connection(com.vodafone.vss.weaver.common.database.JdbcConnectionDetails.builder()
                        .url("jdbc:postgresql://localhost:5432/orders").username("app").password("ENC(old)")
                        .properties(Map.of("password", "old-value")).build())
                .build();
        when(DATASOURCE_DAO.findById(DB_ID)).thenReturn(Optional.of(stored));

        datasourceService.update(DB_ID, database("n3w-secret!"));

        AuditEvent event = onlyEvent();
        Map<String, Object> changes = changesOf(event);
        assertEquals(Map.of("from", "******", "to", "****** (changed)"), changes.get("connection.password"));
        // Same property names, different value: noted, never shown.
        assertEquals("password (values changed)", ((Map<?, ?>) changes.get("connection.properties")).get("to"));
        String all = String.valueOf(event.getDetails());
        assertFalse(all.contains("n3w-secret!"), all);
        assertFalse(all.contains("old-value"), all);
        assertFalse(all.contains("in-properties"), all);
    }

    @Test
    void anUnchangedUpdateRecordsNoChanges() {
        queryService.update(QUERY_ID, query());

        assertTrue(changesOf(onlyEvent()).isEmpty());
    }
}
