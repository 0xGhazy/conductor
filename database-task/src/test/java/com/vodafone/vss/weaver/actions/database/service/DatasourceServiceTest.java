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
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import com.vodafone.vss.weaver.actions.database.dto.DatabaseConnectionRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatabaseConnectionTestRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatabaseRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatasourceConfig;
import com.vodafone.vss.weaver.actions.database.registry.DatasourceConfigProvider;
import com.vodafone.vss.weaver.actions.database.registry.DatasourceHealthService;
import com.vodafone.vss.weaver.actions.database.util.PasswordEncryptionUtil;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.audit.service.UserService;
import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.common.Encryption;
import com.vodafone.vss.weaver.common.database.*;
import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.dao.DatasourceDAO;
import com.vodafone.vss.weaver.dao.QueryDAO;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.*;

class DatasourceServiceTest {

    private static final UUID ID = UUID.randomUUID();
    private static final String URL = "jdbc:postgresql://localhost:5432/orders";

    private DatasourceDAO datasourceDAO;
    private QueryDAO queryDAO;
    private DynamicDataSourceManager manager;
    private DatasourceConfigProvider configProvider;
    private DatasourceService service;

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
        datasourceDAO = mock(DatasourceDAO.class);
        queryDAO = mock(QueryDAO.class);
        manager = mock(DynamicDataSourceManager.class);
        configProvider = mock(DatasourceConfigProvider.class);
        when(manager.getConfigProvider()).thenReturn(configProvider);
        when(configProvider.toResolvedConfig(any())).thenReturn(mock(DatasourceConfig.class));
        when(manager.testConnection(any())).thenReturn(new PingResult(true, null, null));
        service = new DatasourceService(queryDAO, datasourceDAO, manager, null);
    }

    private static DatabaseConnectionRequest connection(String url, String password) {
        return DatabaseConnectionRequest.builder().url(url).username("app").password(password).build();
    }

    private static DatabaseRequest payload(String name, String url, String password) {
        return DatabaseRequest.builder().name(name).type(DatabaseType.POSTGRES).connection(connection(url, password)).build();
    }

    private static DatabaseConnectionTestRequest testPayload(UUID id, String password) {
        return new DatabaseConnectionTestRequest(id, "orders", DatabaseType.POSTGRES, connection(URL, password));
    }

    private static DatasourceModel saved(String name, String encryptedPassword) {
        DatasourceModel model = payload(name, URL, encryptedPassword).toModel();
        model.setId(ID);
        model.setVersion(1L);
        return model;
    }

    private static HttpStatus statusOf(BusinessException e) {
        return e.getStatus();
    }

    @Test
    void createRequiresFieldsAndReportsAllProblems() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.create(new DatabaseRequest()));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(e));
        assertTrue(e.getMessage().contains("Invalid database definition") || e.getReason().contains("name is required"));
        verify(datasourceDAO, never()).create(any());
    }

    @Test
    void createRejectsAnInvalidJdbcUrl() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.create(payload("orders", "jdbc:mysql://localhost/orders", "secret")));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(e));
        assertTrue(e.getReason().contains("connection.url"), e.getReason());
    }

    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    /** The entity keeps the password; its JSON (what the API returns) must not. */
    private static void assertNoPasswordInJson(DatasourceModel model) {
        try {
            String json = JSON.writeValueAsString(model);
            assertFalse(json.contains("password"), json);
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    @Test
    void createAcceptsAPlaceholderUrl() {
        when(datasourceDAO.create(any())).thenAnswer(inv -> {
            DatasourceModel m = inv.getArgument(0);
            m.setId(ID);
            return m;
        });

        DatasourceModel created = service.create(payload("orders", "${weaver.env.ORDERS_URL}", "secret"));

        assertEquals(ID, created.getId());
        assertNoPasswordInJson(created);
    }

    @Test
    void createRequiresAPassword() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.create(payload("orders", URL, " ")));
        assertTrue(e.getReason().contains("connection.password"));
    }

    @Test
    void createStoresTheEncryptedPassword() {
        when(datasourceDAO.create(any())).thenAnswer(inv -> inv.getArgument(0));

        service.create(payload("orders", URL, "secret"));

        ArgumentCaptor<DatasourceModel> stored = ArgumentCaptor.forClass(DatasourceModel.class);
        verify(datasourceDAO).create(stored.capture());
        String password = stored.getValue().getConnection().getPassword();
        assertTrue(PasswordEncryptionUtil.isEncrypted(password));
        assertEquals("secret", PasswordEncryptionUtil.decrypt(password));
    }

    @Test
    void createRejectsADuplicateName() {
        when(datasourceDAO.existsByNameIgnoreCase("orders")).thenReturn(true);

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.create(payload("orders", URL, "secret")));
        assertEquals(HttpStatus.CONFLICT, statusOf(e));
    }

    @Test
    void updateKeepsTheStoredPasswordWhenMasked() {
        String stored = PasswordEncryptionUtil.encrypt("old-secret");
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(saved("orders", stored)));
        when(datasourceDAO.update(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(ID, payload("orders", URL, "******"));

        ArgumentCaptor<DatasourceModel> updated = ArgumentCaptor.forClass(DatasourceModel.class);
        verify(datasourceDAO).update(updated.capture());
        assertEquals(stored, updated.getValue().getConnection().getPassword());
    }

    @Test
    void renameToAnExistingNameIsAConflict() {
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(saved("orders", "x")));
        when(datasourceDAO.existsByNameIgnoreCase("billing")).thenReturn(true);

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.update(ID, payload("billing", URL, null)));
        assertEquals(HttpStatus.CONFLICT, statusOf(e));
    }

    @Test
    void sameNameWithDifferentCaseIsNotAConflict() {
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(saved("orders", "x")));
        when(datasourceDAO.existsByNameIgnoreCase(any())).thenReturn(true);
        when(datasourceDAO.update(any())).thenAnswer(inv -> inv.getArgument(0));

        assertDoesNotThrow(() -> service.update(ID, payload("ORDERS", URL, null)));
    }

    @Test
    void getUnknownIsNotFound() {
        when(datasourceDAO.findById(ID)).thenReturn(Optional.empty());

        BusinessException e = assertThrows(BusinessException.class, () -> service.get(ID));
        assertEquals(HttpStatus.NOT_FOUND, statusOf(e));
    }

    @Test
    void testConnectionSavesNothingAndReportsTheFailure() {
        when(manager.testConnection(any())).thenReturn(new PingResult(false, "password authentication failed", "AUTH_FAILED"));

        DatasourceStatus status = service.testConnection(testPayload(null, "wrong"));

        assertEquals("INACTIVE", status.status());
        assertEquals("AUTH_FAILED", status.errorCode());
        verify(datasourceDAO, never()).create(any());
        verify(datasourceDAO, never()).update(any());
    }

    @Test
    void testConnectionWithASavedIdReusesTheStoredPassword() {
        String stored = PasswordEncryptionUtil.encrypt("old-secret");
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(saved("orders", stored)));
        DatasourceStatus status = service.testConnection(testPayload(ID, ""));

        assertEquals("ACTIVE", status.status());
        ArgumentCaptor<DatasourceModel> tested = ArgumentCaptor.forClass(DatasourceModel.class);
        verify(configProvider).toResolvedConfig(tested.capture());
        assertEquals(stored, tested.getValue().getConnection().getPassword());
    }

    @Test
    void testConnectionWithoutIdNeedsAPassword() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.testConnection(testPayload(null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(e));
    }

    @Test
    void pingOneReturnsThatDatabaseWithItsStatus() {
        DatasourceHealthService health = mock(DatasourceHealthService.class);
        when(manager.getHealthService()).thenReturn(health);
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(saved("orders", "x")));
        when(health.bulkPing(anySet(), anyInt())).thenReturn(Map.of(ID, new PingResult(false, "timeout", "CONNECTION_FAILED")));

        DatasourceModel result = service.ping(ID);

        assertEquals(ID, result.getId());
        assertEquals("INACTIVE", result.getStatus().status());
        assertNoPasswordInJson(result);
    }

    @Test
    void pingUnknownIdsIsNotFound() {
        when(datasourceDAO.findById(any())).thenReturn(Optional.empty());

        BusinessException e = assertThrows(BusinessException.class, () -> service.ping(Set.of(ID)));
        assertEquals(HttpStatus.NOT_FOUND, statusOf(e));
    }

    @Test
    void deleteWithQueriesIsAConflict() {
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(saved("orders", "x")));
        when(queryDAO.countByDatasourceId(ID)).thenReturn(2L);

        BusinessException e = assertThrows(BusinessException.class, () -> service.deleteDatabase(ID));
        assertEquals(HttpStatus.CONFLICT, statusOf(e));
        verify(datasourceDAO, never()).deleteById(any());
    }

    @Test
    void listPagesNewestFirst() {
        when(datasourceDAO.findAll(40, 20, "ord", false)).thenReturn(List.of(saved("orders", "x")));
        when(datasourceDAO.count("ord")).thenReturn(41L);
        when(manager.getStatus(any())).thenReturn(DatasourceStatus.active());
        when(datasourceDAO.existsById(ID)).thenReturn(true);

        var page = service.list(" ord ", 2, 20);

        assertEquals(41, page.getTotalElements());
        assertEquals(3, page.getTotalPages());
        assertEquals("ACTIVE", page.getContent().get(0).getStatus().status());
    }

    @Test
    void getAddsTheResolvedUsersToTheJson() throws Exception {
        UUID admin = UUID.fromString("b4cc7258-ede7-4774-ad7b-9c798ee99cd1");
        UUID unknown = UUID.randomUUID();
        UserService users = new UserService(null, 10, 1);
        users.putUser(new UserMinimal(admin.toString(), "admin", "Conductor", "Admin", "admin@conductor.local"));
        ReflectionTestUtils.setField(service, "userService", users);
        DatasourceModel stored = saved("orders", "x");
        stored.setCreatedBy(UserMinimal.ofId(admin.toString()));
        stored.setUpdatedBy(UserMinimal.ofId(unknown.toString()));
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(stored));
        when(datasourceDAO.existsById(ID)).thenReturn(true);
        when(manager.getStatus(ID)).thenReturn(DatasourceStatus.active());

        JsonNode json = JSON.valueToTree(service.get(ID));

        assertEquals(admin.toString(), json.path("createdBy").path("id").asText());
        assertEquals("Conductor Admin", json.path("createdBy").path("name").asText());
        assertEquals("admin@conductor.local", json.path("createdBy").path("email").asText());
        assertTrue(json.path("createdBy").path("username").isMissingNode());
        assertTrue(json.path("createdByUser").isMissingNode());
        // An id with no Keycloak user (deleted, for example): only the id.
        assertEquals(unknown.toString(), json.path("updatedBy").path("id").asText());
        assertTrue(json.path("updatedBy").path("name").isNull() || json.path("updatedBy").path("name").isMissingNode());
    }

    private void signedInAs(String actorId) {
        AuditSecurityHelper helper = mock(AuditSecurityHelper.class);
        when(helper.resolveCurrentActor()).thenReturn(
                AuditSecurityHelper.ActorContext.builder().actorId(actorId).actorUsername("someone").build());
        ReflectionTestUtils.setField(service, "auditSecurityHelper", helper);
    }

    @Test
    void createStoresTheCallersKeycloakId() {
        UUID caller = UUID.randomUUID();
        signedInAs(caller.toString());
        when(datasourceDAO.create(any())).thenAnswer(inv -> inv.getArgument(0));

        service.create(payload("orders", URL, "secret"));

        ArgumentCaptor<DatasourceModel> stored = ArgumentCaptor.forClass(DatasourceModel.class);
        verify(datasourceDAO).create(stored.capture());
        assertEquals(caller.toString(), stored.getValue().getCreatedBy().getId());
        assertEquals(caller.toString(), stored.getValue().getUpdatedBy().getId());
    }

    @Test
    void callerWithoutAKeycloakIdIsStoredAsUnknown() {
        // Security disabled ("system") or a non-Keycloak principal: no id to store.
        signedInAs("system");
        when(datasourceDAO.create(any())).thenAnswer(inv -> inv.getArgument(0));

        service.create(payload("orders", URL, "secret"));

        ArgumentCaptor<DatasourceModel> stored = ArgumentCaptor.forClass(DatasourceModel.class);
        verify(datasourceDAO).create(stored.capture());
        assertNull(stored.getValue().getCreatedBy());
    }

    @Test
    void updateRecordsTheEditorAndKeepsTheCreator() {
        UUID creator = UUID.randomUUID();
        UUID editor = UUID.randomUUID();
        DatasourceModel current = saved("orders", "x");
        current.setCreatedBy(UserMinimal.ofId(creator.toString()));
        when(datasourceDAO.findById(ID)).thenReturn(Optional.of(current));
        // Like the real DAO: returns the model it was given (created_by is never updated in SQL).
        when(datasourceDAO.update(any())).thenAnswer(inv -> inv.getArgument(0));
        signedInAs(editor.toString());

        DatasourceModel updated = service.update(ID, payload("orders", URL, null));

        assertEquals(editor.toString(), updated.getUpdatedBy().getId());
        assertEquals(creator.toString(), updated.getCreatedBy().getId());
        assertEquals(current.getCreatedAt(), updated.getCreatedAt());
    }

    @Test
    void createdByAndUpdatedByAreNeverReadFromRequests() throws Exception {
        DatasourceModel model = JSON.readValue(
                "{\"name\":\"x\",\"createdBy\":{\"id\":\"" + UUID.randomUUID() + "\"},\"updatedBy\":{\"id\":\"admin\"}}",
                DatasourceModel.class);
        assertNull(model.getCreatedBy());
        assertNull(model.getUpdatedBy());
    }

}
