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

import com.vodafone.vss.weaver.actions.database.dto.BulkDeleteResult;
import com.vodafone.vss.weaver.actions.database.dto.QueryExecutionRequest;
import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.common.database.QueryModel;

import static org.hamcrest.Matchers.endsWith;
import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class QueryResourceTest {

    private static final UUID QUERY_ID = UUID.fromString("018f2d5e-7a91-729d-9d41-382594a91930");
    private static final UUID DB_ID = UUID.fromString("018f2d5e-7a91-729d-9d41-382594a9192f");

    private QueryService queryService;
    private MockMvc mockMvc;

    @Before
    public void setUp() {
        queryService = mock(QueryService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(withMethodValidation(new QueryResource(queryService)))
                .setControllerAdvice(new ValidationExceptionMapper(), new ApplicationExceptionMapper())
                .build();
    }

    @Test
    public void listFiltersByDatabaseIdAndIncludesSql() throws Exception {
        QueryModel query = QueryModel.builder().id(QUERY_ID).name("q").sql("SELECT 1").datasourceId(DB_ID).build();
        when(queryService.list(DB_ID, true, null, 0, 20)).thenReturn(new PageImpl<>(List.of(query), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/queries").param("databaseId", DB_ID.toString()).param("includeSql", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].sql").value("SELECT 1"))
                .andExpect(jsonPath("$.details.totalElements").value(1));
    }

    @Test
    public void listWithoutFilterDefaultsToFirstPageWithoutSql() throws Exception {
        when(queryService.list(null, false, null, 0, 20)).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/api/queries")).andExpect(status().isOk());
        verify(queryService).list(null, false, null, 0, 20);
    }

    @Test
    public void createReturns201WithLocation() throws Exception {
        when(queryService.create(any())).thenReturn(QueryModel.builder().id(QUERY_ID).name("q").build());

        mockMvc.perform(post("/api/queries").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"q\",\"sql\":\"SELECT 1\",\"datasourceId\":\"" + DB_ID + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/api/queries/" + QUERY_ID)));
    }

    @Test
    public void duplicateNameIs409() throws Exception {
        when(queryService.create(any())).thenThrow(ExceptionUtils.throwAlreadyExist("exists"));

        mockMvc.perform(post("/api/queries").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"q\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    public void getUpdateDelete() throws Exception {
        when(queryService.get(QUERY_ID, false)).thenReturn(QueryModel.builder().id(QUERY_ID).name("q").build());
        mockMvc.perform(get("/api/queries/{id}", QUERY_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("q"));

        when(queryService.update(eq(QUERY_ID), any())).thenReturn(QueryModel.builder().id(QUERY_ID).name("q2").build());
        mockMvc.perform(put("/api/queries/{id}", QUERY_ID).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"q2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("q2"));

        mockMvc.perform(delete("/api/queries/{id}", QUERY_ID)).andExpect(status().isNoContent());
        verify(queryService).delete(QUERY_ID);
    }

    @Test
    public void unknownQueryIs404() throws Exception {
        when(queryService.get(QUERY_ID, false)).thenThrow(ExceptionUtils.throwNotFound("Query not found"));

        mockMvc.perform(get("/api/queries/{id}", QUERY_ID)).andExpect(status().isNotFound());
    }

    @Test
    public void bulkDeleteReportsMissingIds() throws Exception {
        UUID missing = UUID.randomUUID();
        when(queryService.deleteAll(Set.of(QUERY_ID, missing)))
                .thenReturn(new BulkDeleteResult(List.of(QUERY_ID), List.of(missing)));

        mockMvc.perform(post("/api/queries/bulk-delete").contentType(MediaType.APPLICATION_JSON)
                        .content("[\"" + QUERY_ID + "\",\"" + missing + "\"]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted[0]").value(QUERY_ID.toString()))
                .andExpect(jsonPath("$.data.notFound[0]").value(missing.toString()));
    }

    @Test
    public void bulkDeleteNeedsIds() throws Exception {
        mockMvc.perform(post("/api/queries/bulk-delete").contentType(MediaType.APPLICATION_JSON).content("[]"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(queryService);
    }

    @Test
    public void executeRunsSavedQueryWithArguments() throws Exception {
        when(queryService.runQuery(eq(QUERY_ID), any()))
                .thenReturn(QueryExecutionResult.builder().status("SUCCESS").build());

        mockMvc.perform(post("/api/queries/{id}/execute", QUERY_ID).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parameters\":{\"status\":\"COMPLETED\"},\"maxRows\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        ArgumentCaptor<QueryExecutionRequest> request = ArgumentCaptor.forClass(QueryExecutionRequest.class);
        verify(queryService).runQuery(eq(QUERY_ID), request.capture());
        assertEquals("COMPLETED", request.getValue().getParameters().get("status"));
        assertEquals(Integer.valueOf(5), request.getValue().getMaxRows());
    }

    @Test
    public void executeWithoutBodyIsAllowed() throws Exception {
        when(queryService.runQuery(eq(QUERY_ID), isNull()))
                .thenReturn(QueryExecutionResult.builder().status("SUCCESS").build());

        mockMvc.perform(post("/api/queries/{id}/execute", QUERY_ID)).andExpect(status().isOk());
        verify(queryService).runQuery(QUERY_ID, null);
    }

    @Test
    public void executeRejectsZeroMaxRows() throws Exception {
        mockMvc.perform(post("/api/queries/{id}/execute", QUERY_ID).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"maxRows\":0}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(queryService);
    }

    @Test
    public void failedQueryIs422() throws Exception {
        when(queryService.runQuery(eq(QUERY_ID), any()))
                .thenReturn(QueryExecutionResult.builder().status("FAILED").errorCode("QUERY_TIMEOUT").build());

        mockMvc.perform(post("/api/queries/{id}/execute", QUERY_ID).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("QUERY_TIMEOUT"));
    }

    /** Same @Validated proxy Spring Boot puts around the controller in the server. */
    static Object withMethodValidation(Object controller) {
        ProxyFactory factory = new ProxyFactory(controller);
        factory.setProxyTargetClass(true);
        factory.addAdvice(new MethodValidationInterceptor());
        return factory.getProxy();
    }
}
