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
package com.vodafone.vss.weaver.rest.controllers;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.Before;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.MethodValidationInterceptor;

import com.vodafone.vss.weaver.actions.database.dto.DatabaseConnectionTestRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatabaseRequest;
import com.vodafone.vss.weaver.actions.database.dto.SqlExecutionRequest;
import com.vodafone.vss.weaver.actions.database.exception.DatasourceUnavailableException;
import com.vodafone.vss.weaver.actions.database.service.DatasourceService;
import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.DatasourceStatus;
import com.vodafone.vss.weaver.common.database.JdbcConnectionDetails;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.common.database.QueryModel;

import static org.hamcrest.Matchers.endsWith;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class DatabaseResourceTest {

    private static final UUID ID = UUID.fromString("018f2d5e-7a91-729d-9d41-382594a9192f");

    private QueryService queryService;
    private DatasourceService datasourceService;
    private MockMvc mockMvc;

    @Before
    public void setUp() {
        queryService = mock(QueryService.class);
        datasourceService = mock(DatasourceService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(withMethodValidation(new DatabaseResource(queryService, datasourceService)))
                .setControllerAdvice(new ValidationExceptionMapper(), new ApplicationExceptionMapper())
                .build();
    }

    @Test
    public void listUsesPageAndSize() throws Exception {
        DatasourceModel db = DatasourceModel.builder().id(ID).name("orders").build();
        when(datasourceService.list("ord", 2, 5)).thenReturn(new PageImpl<>(List.of(db), PageRequest.of(2, 5), 11));

        mockMvc.perform(get("/api/databases").param("search", "ord").param("page", "2").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("orders"))
                .andExpect(jsonPath("$.details.totalElements").value(11))
                .andExpect(jsonPath("$.details.totalPages").value(3))
                .andExpect(jsonPath("$.details.pageNumber").value(2));
    }

    @Test
    public void listRejectsOversizedPage() throws Exception {
        mockMvc.perform(get("/api/databases").param("size", "1001"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(datasourceService);

        // The UI loads whole lists for pickers with size=1000.
        when(datasourceService.list(null, 0, 1000)).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 1000), 0));
        mockMvc.perform(get("/api/databases").param("size", "1000")).andExpect(status().isOk());
    }

    @Test
    public void createReturns201WithLocation() throws Exception {
        when(datasourceService.create(any())).thenReturn(DatasourceModel.builder().id(ID).name("orders").build());

        mockMvc.perform(post("/api/databases").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"orders\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/api/databases/" + ID)))
                .andExpect(jsonPath("$.data.id").value(ID.toString()));
    }

    @Test
    public void createReadsOnlyCallerFieldsFromTheBody() throws Exception {
        when(datasourceService.create(any())).thenReturn(DatasourceModel.builder().id(ID).build());

        // Server-managed fields in the body (id, status, createdBy) are not part of the request and are dropped.
        mockMvc.perform(post("/api/databases").contentType(MediaType.APPLICATION_JSON).content(
                        "{\"id\":\"" + UUID.randomUUID() + "\",\"name\":\"orders\",\"type\":\"POSTGRES\","
                                + "\"status\":{\"status\":\"ACTIVE\"},\"createdBy\":\"me\","
                                + "\"connection\":{\"url\":\"jdbc:postgresql://h:5432/db\",\"username\":\"app\","
                                + "\"password\":\"secret\",\"maxPoolSize\":7}}"))
                .andExpect(status().isCreated());

        ArgumentCaptor<DatabaseRequest> request = ArgumentCaptor.forClass(DatabaseRequest.class);
        verify(datasourceService).create(request.capture());
        DatasourceModel model = request.getValue().toModel();
        assertEquals("orders", model.getName());
        assertEquals(DatabaseType.POSTGRES, model.getType());
        assertEquals("jdbc:postgresql://h:5432/db", model.getConnection().getUrl());
        assertEquals("secret", model.getConnection().getPassword());
        assertEquals(Integer.valueOf(7), model.getConnection().getMaxPoolSize());
        assertNull(model.getId());
        assertNull(model.getStatus());
        assertNull(model.getCreatedBy());
    }

    @Test
    public void testConnectionReadsTheSavedId() throws Exception {
        when(datasourceService.testConnection(any())).thenReturn(DatasourceStatus.active());

        mockMvc.perform(post("/api/databases/test").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"" + ID + "\",\"name\":\"orders\",\"type\":\"POSTGRES\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        ArgumentCaptor<DatabaseConnectionTestRequest> request = ArgumentCaptor.forClass(DatabaseConnectionTestRequest.class);
        verify(datasourceService).testConnection(request.capture());
        assertEquals(ID, request.getValue().getId());
        assertEquals("orders", request.getValue().getName());
    }

    @Test
    public void createPassesServiceValidationErrorsThrough() throws Exception {
        when(datasourceService.create(any())).thenThrow(ExceptionUtils.throwBadInputs("Invalid database definition", "name is required"));

        mockMvc.perform(post("/api/databases").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void malformedJsonIs400() throws Exception {
        mockMvc.perform(post("/api/databases").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testConnectionReportsStatusWithoutSaving() throws Exception {
        when(datasourceService.testConnection(any()))
                .thenReturn(DatasourceStatus.inactive("Connection test failed", "password authentication failed", "AUTH_FAILED"));

        mockMvc.perform(post("/api/databases/test").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("AUTH_FAILED"))
                .andExpect(jsonPath("$.data.status").value("INACTIVE"));
        verify(datasourceService, never()).create(any());
    }

    @Test
    public void responsesNeverContainThePassword() throws Exception {
        DatasourceModel db = DatasourceModel.builder().id(ID).name("orders")
                .connection(JdbcConnectionDetails.builder().url("jdbc:postgresql://h/db").username("app").password("ENC(x)").build())
                .build();
        when(datasourceService.get(ID)).thenReturn(db);

        mockMvc.perform(get("/api/databases/{id}", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.connection.username").value("app"))
                .andExpect(jsonPath("$.data.connection.password").doesNotExist());
    }

    @Test
    public void getUnknownIdIs404AndBadIdIs400() throws Exception {
        when(datasourceService.get(ID)).thenThrow(ExceptionUtils.throwNotFound("Database not found"));

        mockMvc.perform(get("/api/databases/{id}", ID)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/databases/not-a-uuid")).andExpect(status().isBadRequest());
    }

    @Test
    public void updateAndDelete() throws Exception {
        when(datasourceService.update(eq(ID), any())).thenReturn(DatasourceModel.builder().id(ID).name("renamed").build());

        mockMvc.perform(put("/api/databases/{id}", ID).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"renamed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("renamed"));

        mockMvc.perform(delete("/api/databases/{id}", ID)).andExpect(status().isNoContent());
        verify(datasourceService).deleteDatabase(ID);
    }

    @Test
    public void pingOneReturnsASingleDatabase() throws Exception {
        DatasourceModel db = DatasourceModel.builder().id(ID).status(DatasourceStatus.active()).build();
        when(datasourceService.ping(ID)).thenReturn(db);

        mockMvc.perform(post("/api/databases/{id}/ping", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(ID.toString()))
                .andExpect(jsonPath("$.data.status.status").value("ACTIVE"));
    }

    @Test
    public void pingSeveral() throws Exception {
        when(datasourceService.ping(Set.of(ID))).thenReturn(List.of(DatasourceModel.builder().id(ID).build()));

        mockMvc.perform(post("/api/databases/ping").contentType(MediaType.APPLICATION_JSON).content("[\"" + ID + "\"]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(ID.toString()));
    }

    @Test
    public void listDatabaseQueriesFiltersByPathId() throws Exception {
        QueryModel query = QueryModel.builder().id(UUID.randomUUID()).name("q").sql("SELECT 1").datasourceId(ID).build();
        when(queryService.list(ID, true, null, 0, 20)).thenReturn(new PageImpl<>(List.of(query), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/databases/{id}/queries", ID).param("includeSql", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].sql").value("SELECT 1"));
        verify(datasourceService).get(ID);
    }

    @Test
    public void executeRunsSqlFromBody() throws Exception {
        QueryExecutionResult result = QueryExecutionResult.builder().status("SUCCESS").truncated(true).build();
        when(queryService.runSql(eq(ID), any())).thenReturn(result);

        mockMvc.perform(post("/api/databases/{id}/execute", ID).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sql\":\"SELECT * FROM t WHERE a = :a\",\"parameters\":{\"a\":1},\"maxRows\":10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.truncated").value(true));

        ArgumentCaptor<SqlExecutionRequest> request = ArgumentCaptor.forClass(SqlExecutionRequest.class);
        verify(queryService).runSql(eq(ID), request.capture());
        assertEquals("SELECT * FROM t WHERE a = :a", request.getValue().getSql());
        assertEquals(Integer.valueOf(10), request.getValue().getMaxRows());
        assertEquals(1, request.getValue().getParameters().get("a"));
    }

    @Test
    public void executeWithoutSqlIs400() throws Exception {
        mockMvc.perform(post("/api/databases/{id}/execute", ID).contentType(MediaType.APPLICATION_JSON).content("{\"sql\":\" \"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(queryService);
    }

    @Test
    public void failedSqlIs422WithTheDatabaseError() throws Exception {
        QueryExecutionResult failed = QueryExecutionResult.builder()
                .status("FAILED").errorCode("SYNTAX_ERROR").reason("Table or relation not found").build();
        when(queryService.runSql(eq(ID), any())).thenReturn(failed);

        mockMvc.perform(post("/api/databases/{id}/execute", ID).contentType(MediaType.APPLICATION_JSON).content("{\"sql\":\"SELECT * FROM nope\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("SYNTAX_ERROR"))
                .andExpect(jsonPath("$.reason").value("Table or relation not found"));
    }

    @Test
    public void unreachableDatabaseIs503() throws Exception {
        when(queryService.runSql(eq(ID), any()))
                .thenThrow(new DatasourceUnavailableException("down", DatabaseErrorCode.CONNECTION_FAILED, true));

        mockMvc.perform(post("/api/databases/{id}/execute", ID).contentType(MediaType.APPLICATION_JSON).content("{\"sql\":\"SELECT 1\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.retryable").value(true));
    }


    @Test
    public void getWithQueriesReturnsTheDatabaseAndItsQueriesInOneCall() throws Exception {
        when(datasourceService.get(ID)).thenReturn(DatasourceModel.builder().id(ID).name("orders").build());
        QueryModel query = QueryModel.builder().id(UUID.randomUUID()).name("active orders").datasourceId(ID).build();
        when(queryService.list(ID, false, null, 0, 100)).thenReturn(new PageImpl<>(List.of(query), PageRequest.of(0, 100), 1));

        mockMvc.perform(get("/api/databases/{id}", ID).param("withQueries", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("orders"))
                .andExpect(jsonPath("$.data.queries[0].name").value("active orders"))
                .andExpect(jsonPath("$.data.queries[0].sql").doesNotExist());
    }

    @Test
    public void getWithoutTheFlagHasNoQueriesAndDoesNotLoadThem() throws Exception {
        when(datasourceService.get(ID)).thenReturn(DatasourceModel.builder().id(ID).name("orders").build());

        mockMvc.perform(get("/api/databases/{id}", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.queries").doesNotExist());
        verifyNoInteractions(queryService);
    }

    /** Same @Validated proxy Spring Boot puts around the controller in the server. */
    static Object withMethodValidation(Object controller) {
        ProxyFactory factory = new ProxyFactory(controller);
        factory.setProxyTargetClass(true);
        factory.addAdvice(new MethodValidationInterceptor());
        return factory.getProxy();
    }
}
