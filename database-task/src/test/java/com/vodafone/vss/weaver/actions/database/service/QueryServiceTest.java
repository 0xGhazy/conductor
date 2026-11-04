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

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import org.springframework.test.util.ReflectionTestUtils;

import com.vodafone.vss.weaver.actions.database.dto.BulkDeleteResult;
import com.vodafone.vss.weaver.actions.database.dto.QueryExecutionRequest;
import com.vodafone.vss.weaver.actions.database.dto.SqlExecutionRequest;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.audit.service.UserService;
import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.DatasourceMinimal;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.database.QueryParameterDataType;
import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.dao.DatasourceDAO;
import com.vodafone.vss.weaver.dao.QueryDAO;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class QueryServiceTest {

    private static final UUID DB_ID = UUID.randomUUID();
    private static final UUID QUERY_ID = UUID.randomUUID();

    private QueryDAO queryDAO;
    private DatasourceDAO datasourceDAO;
    private QueryExecutorService executor;
    private QueryService service;

    @BeforeEach
    void setUp() {
        queryDAO = mock(QueryDAO.class);
        datasourceDAO = mock(DatasourceDAO.class);
        executor = mock(QueryExecutorService.class);
        // max 100 rows, 10 s timeout
        service = new QueryService(queryDAO, datasourceDAO, executor, 100, 60, 100, Duration.ofSeconds(10));
        when(datasourceDAO.findById(DB_ID)).thenReturn(Optional.of(
                DatasourceModel.builder().id(DB_ID).name("orders").type(DatabaseType.POSTGRES).build()));
        when(executor.execute(any(), anyString(), anyMap(), anyInt(), anyString(), anyInt()))
                .thenReturn(QueryExecutionResult.builder().status("SUCCESS").build());
    }

    private static QueryModel query(String name) {
        return QueryModel.builder().name(name).sql("SELECT * FROM t WHERE a = :a").datasourceId(DB_ID).build();
    }

    @Test
    void createValidatesRequiredFields() {
        BusinessException e = assertThrows(BusinessException.class, () -> service.create(new QueryModel()));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertTrue(e.getReason().contains("name is required"));
        assertTrue(e.getReason().contains("sql is required"));
        assertTrue(e.getReason().contains("datasourceId is required"));
    }

    @Test
    void createOnUnknownDatabaseIsNotFound() {
        QueryModel q = query("q");
        q.setDatasourceId(UUID.randomUUID());

        BusinessException e = assertThrows(BusinessException.class, () -> service.create(q));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    void duplicateNameOnTheSameDatabaseIsAConflict() {
        when(queryDAO.findByNameAndDatasourceId("q", DB_ID))
                .thenReturn(Optional.of(QueryModel.builder().id(UUID.randomUUID()).build()));

        BusinessException e = assertThrows(BusinessException.class, () -> service.create(query("q")));
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
    }

    @Test
    void updateKeepsItsOwnName() {
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(QueryModel.builder().id(QUERY_ID).timeout(2000).build()));
        when(queryDAO.findByNameAndDatasourceId("q", DB_ID))
                .thenReturn(Optional.of(QueryModel.builder().id(QUERY_ID).build()));
        when(queryDAO.update(any())).thenAnswer(inv -> inv.getArgument(0));

        QueryModel updated = service.update(QUERY_ID, query("q"));

        assertEquals(QUERY_ID, updated.getId());
    }

    @Test
    void getUnknownIsNotFoundNot500() {
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.empty());

        BusinessException e = assertThrows(BusinessException.class, () -> service.get(QUERY_ID, true));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        // The task path keeps its own exception type.
        assertThrows(NoSuchElementException.class, () -> service.findById(QUERY_ID));
    }

    @Test
    void getHidesSqlUnlessAsked() {
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(query("q")));

        assertNull(service.get(QUERY_ID, false).getSql());
        assertNotNull(service.get(QUERY_ID, true).getSql());
    }

    @Test
    void listPassesTheDatabaseFilter() {
        when(queryDAO.findAll(20, 10, "q", DB_ID)).thenReturn(List.of(query("q")));
        when(queryDAO.count("q", DB_ID)).thenReturn(21L);

        var page = service.list(DB_ID, false, " q ", 2, 10);

        assertEquals(21, page.getTotalElements());
        assertNull(page.getContent().get(0).getSql());
    }

    @Test
    void bulkDeleteReportsWhatWasMissing() {
        UUID missing = UUID.randomUUID();
        when(queryDAO.deleteById(QUERY_ID)).thenReturn(true);
        when(queryDAO.deleteById(missing)).thenReturn(false);

        BulkDeleteResult result = service.deleteAll(new LinkedHashSet<>(List.of(QUERY_ID, missing)));

        assertEquals(List.of(QUERY_ID), result.deleted());
        assertEquals(List.of(missing), result.notFound());
    }

    @Test
    void deleteUnknownIsNotFound() {
        when(queryDAO.deleteById(QUERY_ID)).thenReturn(false);

        BusinessException e = assertThrows(BusinessException.class, () -> service.delete(QUERY_ID));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    void runSqlCapsRowsAndTimeout() {
        service.runSql(DB_ID, SqlExecutionRequest.builder().sql(" SELECT 1 ").timeout(600_000).maxRows(5_000).build());

        // 10 s cap and 100 row cap
        verify(executor).execute(eq(DB_ID), eq("SELECT 1"), anyMap(), eq(10), eq("adhoc"), eq(100));
    }

    @Test
    void runSqlUsesDefaultsWhenNotGiven() {
        service.runSql(DB_ID, SqlExecutionRequest.builder().sql("SELECT 1").build());

        verify(executor).execute(eq(DB_ID), eq("SELECT 1"), anyMap(), eq(5), eq("adhoc"), eq(100));
    }

    @Test
    void runSqlKeepsASmallerRowLimit() {
        service.runSql(DB_ID, SqlExecutionRequest.builder().sql("SELECT 1").maxRows(7).build());

        verify(executor).execute(any(), anyString(), anyMap(), anyInt(), anyString(), eq(7));
    }

    @Test
    void runSqlOnUnknownDatabaseIsNotFound() {
        UUID unknown = UUID.randomUUID();
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.runSql(unknown, SqlExecutionRequest.builder().sql("SELECT 1").build()));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        verifyNoInteractions(executor);
    }

    @Test
    void runQueryConvertsArgumentsToDeclaredTypes() {
        QueryModel saved = query("q");
        saved.setId(QUERY_ID);
        saved.setParameters(Map.of("a", QueryParameterDataType.INTEGER));
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(saved));

        service.runQuery(QUERY_ID, QueryExecutionRequest.builder().parameters(Map.of("a", "42")).maxRows(3).build());

        verify(executor).execute(eq(DB_ID), eq("SELECT * FROM t WHERE a = :a"),
                eq(Map.of("a", 42)), anyInt(), eq("q"), eq(3));
    }

    @Test
    void runQueryWithoutBodyUsesTheRowCap() {
        QueryModel saved = query("q");
        saved.setId(QUERY_ID);
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(saved));

        service.runQuery(QUERY_ID, null);

        verify(executor).execute(any(), anyString(), anyMap(), anyInt(), anyString(), eq(100));
    }

    @Test
    void taskExecutionHasNoRowCap() {
        QueryModel saved = query("q");
        saved.setId(QUERY_ID);
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(saved));

        service.executeSavedQuery(QUERY_ID, Map.of());

        verify(executor).execute(any(), anyString(), anyMap(), anyInt(), anyString(), eq(0));
    }

    @Test
    void responsesCarryTheResolvedUsersWithoutChangingTheCachedQuery() {
        UUID admin = UUID.randomUUID();
        UserService users = new UserService(null, 10, 1);
        users.putUser(new UserMinimal(admin.toString(), "admin", "Conductor", "Admin", "admin@conductor.local"));
        ReflectionTestUtils.setField(service, "userService", users);
        QueryModel saved = query("q");
        saved.setId(QUERY_ID);
        saved.setCreatedBy(UserMinimal.ofId(admin.toString()));
        saved.setUpdatedBy(UserMinimal.ofId(admin.toString()));
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(saved));

        QueryModel response = service.get(QUERY_ID, false);

        assertEquals(admin.toString(), response.getCreatedBy().getId());
        assertEquals("Conductor Admin", response.getUpdatedBy().getName());
        assertNull(service.findById(QUERY_ID).getCreatedBy().getName(), "cached query is not modified");
    }

    @Test
    void createAndUpdateStoreKeycloakIds() {
        UUID creator = UUID.randomUUID();
        UUID editor = UUID.randomUUID();
        AuditSecurityHelper helper = mock(AuditSecurityHelper.class);
        ReflectionTestUtils.setField(service, "auditSecurityHelper", helper);
        when(queryDAO.create(any())).thenAnswer(inv -> {
            QueryModel q = inv.getArgument(0);
            q.setId(UUID.randomUUID()); // the real DAO assigns the id
            return q;
        });
        when(queryDAO.update(any())).thenAnswer(inv -> inv.getArgument(0));

        when(helper.resolveCurrentActor()).thenReturn(
                AuditSecurityHelper.ActorContext.builder().actorId(creator.toString()).build());
        QueryModel created = service.create(query("q"));
        assertEquals(creator.toString(), created.getCreatedBy().getId());

        QueryModel existing = query("q");
        existing.setId(QUERY_ID);
        existing.setCreatedBy(UserMinimal.ofId(creator.toString()));
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(existing));
        when(helper.resolveCurrentActor()).thenReturn(
                AuditSecurityHelper.ActorContext.builder().actorId(editor.toString()).build());
        QueryModel updated = service.update(QUERY_ID, query("q"));

        assertEquals(creator.toString(), updated.getCreatedBy().getId());
        assertEquals(editor.toString(), updated.getUpdatedBy().getId());
    }

    @Test
    void responsesCarryTheirDatabaseLoadedOncePerResponse() {
        QueryModel a = query("a");
        QueryModel b = query("b");
        a.setId(UUID.randomUUID());
        b.setId(UUID.randomUUID());
        when(queryDAO.findAll(0, 20, null, null)).thenReturn(List.of(a, b));
        when(queryDAO.count(null, null)).thenReturn(2L);

        var page = service.list(null, false, null, 0, 20);

        DatasourceMinimal database = page.getContent().get(0).getDatasource();
        assertEquals(DB_ID, database.getId());
        assertEquals("orders", database.getName());
        assertEquals(DatabaseType.POSTGRES, database.getType());
        assertEquals("orders", page.getContent().get(1).getDatasource().getName());
        verify(datasourceDAO, times(1)).findById(DB_ID);
    }

    @Test
    void missingDatabaseIsShownByIdOnly() {
        UUID gone = UUID.randomUUID();
        QueryModel saved = query("q");
        saved.setId(QUERY_ID);
        saved.setDatasourceId(gone);
        when(queryDAO.findById(QUERY_ID)).thenReturn(Optional.of(saved));
        when(datasourceDAO.findById(gone)).thenReturn(Optional.empty());

        DatasourceMinimal database = service.get(QUERY_ID, false).getDatasource();

        assertEquals(gone, database.getId());
        assertNull(database.getName());
    }

    @Test
    void jsonShowsTheDatabaseAndReadsOnlyDatasourceIdFromRequests() throws Exception {
        ObjectMapper json = new ObjectMapper().findAndRegisterModules();
        QueryModel response = query("q");
        response.setDatasource(new DatasourceMinimal(DB_ID, "orders", DatabaseType.POSTGRES));

        JsonNode out = json.valueToTree(response);
        assertEquals("orders", out.path("datasource").path("name").asText());
        assertEquals("POSTGRES", out.path("datasource").path("type").asText());
        assertTrue(out.path("datasourceId").isMissingNode());

        QueryModel request = json.readValue(
                "{\"name\":\"q\",\"datasourceId\":\"" + DB_ID + "\",\"datasource\":{\"id\":\"" + UUID.randomUUID() + "\"}}",
                QueryModel.class);
        assertEquals(DB_ID, request.getDatasourceId());
        assertNull(request.getDatasource());
    }
}
