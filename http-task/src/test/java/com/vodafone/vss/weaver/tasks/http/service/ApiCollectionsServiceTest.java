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

import com.vodafone.vss.weaver.common.http.ApiCollectionEndpointModel;
import com.vodafone.vss.weaver.common.http.ApiCollectionModel;
import com.vodafone.vss.weaver.common.http.ApiCollectionType;
import com.vodafone.vss.weaver.common.http.CreateApiCollectionEndpointRequest;
import com.vodafone.vss.weaver.common.http.CreateApiCollectionRequest;
import com.vodafone.vss.weaver.common.http.ImportApiCollectionRequest;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.dao.ApiCollectionDAO;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApiCollectionsServiceTest {

    @Mock
    private ApiCollectionDAO dao;

    private ApiCollectionsService service;

    @BeforeEach
    void setUp() {
        service = new ApiCollectionsService(dao);
    }

    @Test
    void createCollection_succeeds_when_unique() {
        CreateApiCollectionRequest request =
                new CreateApiCollectionRequest("Payment APIs", "Payment gateway endpoints", null, ApiCollectionType.SWAGGER, null, null);

        when(dao.existsCollectionByName("Payment APIs")).thenReturn(false);
        when(dao.createCollection(any())).thenAnswer(inv -> {
            ApiCollectionModel m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            return m;
        });

        ApiCollectionModel created = service.createCollection(request);

        assertNotNull(created);
        assertEquals("Payment APIs", created.getName());
        verify(dao).createCollection(any());
    }

    @Test
    void createCollection_fails_when_duplicate() {
        CreateApiCollectionRequest request =
                new CreateApiCollectionRequest("Payment APIs", null, null, null, null, null);

        when(dao.existsCollectionByName("Payment APIs")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> service.createCollection(request));
    }

    @Test
    void deleteCollection_deletes_endpoints_and_collection() {
        UUID collectionId = UUID.randomUUID();
        ApiCollectionModel model = ApiCollectionModel.builder().id(collectionId).name("Col").build();
        when(dao.findCollectionById(collectionId)).thenReturn(Optional.of(model));

        service.deleteCollection(collectionId);

        verify(dao).deleteEndpointsByCollection(collectionId);
        verify(dao).deleteCollectionById(collectionId);
    }

    @Test
    void importCollection_creates_collection_and_all_endpoints() {
        UUID connId = UUID.randomUUID();
        ImportApiCollectionRequest.ImportEndpointRequest ep1 =
                new ImportApiCollectionRequest.ImportEndpointRequest("Get Balance", "Fetches balance", null, Map.of("method", "GET"), null, null);
        ImportApiCollectionRequest.ImportEndpointRequest ep2 =
                new ImportApiCollectionRequest.ImportEndpointRequest("Transfer", "Performs transfer", null, Map.of("method", "POST"), null, null);

        ImportApiCollectionRequest request =
                new ImportApiCollectionRequest(
                        "Banking Collection",
                        "Imported from Postman",
                        connId,
                        ApiCollectionType.POSTMAN,
                        List.of(ep1, ep2),
                        null,
                        null
                );

        when(dao.existsCollectionByName("Banking Collection")).thenReturn(false);
        when(dao.createCollection(any())).thenAnswer(inv -> {
            ApiCollectionModel m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            return m;
        });

        ApiCollectionModel imported = service.importCollection(request);

        assertNotNull(imported);
        assertEquals("Banking Collection", imported.getName());
        verify(dao).createCollection(any());
        verify(dao, times(2)).createEndpoint(any());
    }
}

