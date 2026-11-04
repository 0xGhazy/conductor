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

import java.util.UUID;

import org.junit.Before;
import org.junit.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.vodafone.vss.weaver.actions.database.service.DatasourceService;
import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.dto.AppResponse;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class DatabaseResourceTest {

    private QueryService queryService;
    private DatasourceService datasourceService;
    private DatabaseResource resource;

    @Before
    public void setUp() {
        queryService = mock(QueryService.class);
        datasourceService = mock(DatasourceService.class);
        resource = new DatabaseResource(queryService, datasourceService);
    }

    @Test
    public void testCreateDatabaseInstance() {
        DatasourceModel model = new DatasourceModel();
        model.setName("TestDB");

        AppResponse appResponse = AppResponse.builder().status(HttpStatus.CREATED).build();
        when(datasourceService.createDatabase(model)).thenReturn(new ResponseEntity<>(appResponse, HttpStatus.CREATED));

        ResponseEntity<AppResponse> response = resource.createDatabaseInstance(model);

        assertNotNull(response);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        verify(datasourceService).createDatabase(model);
    }

    @Test
    public void testFindDatabaseInstanceById() {
        UUID id = UUID.randomUUID();
        AppResponse appResponse = AppResponse.builder().status(HttpStatus.OK).build();
        when(datasourceService.findByIdRest(id)).thenReturn(ResponseEntity.ok(appResponse));

        ResponseEntity<AppResponse> response = resource.findDatabaseInstanceById(id);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(datasourceService).findByIdRest(id);
    }
}

