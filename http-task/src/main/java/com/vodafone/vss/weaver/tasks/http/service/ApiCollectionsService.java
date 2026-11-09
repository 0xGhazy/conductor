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

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.http.ApiCollectionEndpointModel;
import com.vodafone.vss.weaver.common.http.ApiCollectionModel;
import com.vodafone.vss.weaver.common.http.CreateApiCollectionEndpointRequest;
import com.vodafone.vss.weaver.common.http.CreateApiCollectionRequest;
import com.vodafone.vss.weaver.common.http.ImportApiCollectionRequest;
import com.vodafone.vss.weaver.common.http.UpdateApiCollectionEndpointRequest;
import com.vodafone.vss.weaver.common.http.UpdateApiCollectionRequest;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.core.exception.NotFoundException;
import com.vodafone.vss.weaver.dao.ApiCollectionDAO;

@Service
public class ApiCollectionsService {

    private final ApiCollectionDAO dao;

    public ApiCollectionsService(ApiCollectionDAO dao) {
        this.dao = dao;
    }

    public PageResult<ApiCollectionModel> listCollections(int page, int size) {
        return dao.listCollections(page, size);
    }

    public ApiCollectionModel getCollection(UUID id) {
        return dao.findCollectionById(id)
                .orElseThrow(() -> new NotFoundException("Collection " + id + " not found"));
    }

    public ApiCollectionModel createCollection(CreateApiCollectionRequest dto) {
        String name = normalizeName(dto.name());
        if (dao.existsCollectionByName(name)) {
            throw new IllegalArgumentException("Collection '" + name + "' already exists");
        }

        Instant now = dto.createdAt() != null ? dto.createdAt() : Instant.now();
        ApiCollectionModel model =
                ApiCollectionModel.builder()
                        .name(name)
                        .description(dto.description())
                        .type(dto.type())
                        .createdAt(now)
                        .createdBy(dto.createdBy())
                        .updatedAt(now)
                        .updatedBy(dto.createdBy())
                        .build();

        return dao.createCollection(model);
    }

    public ApiCollectionModel updateCollection(UUID id, UpdateApiCollectionRequest dto) {
        ApiCollectionModel existing = getCollection(id);

        if (dto.name() != null && !dto.name().isBlank()) {
            String nextName = normalizeName(dto.name());
            dao.findCollectionByName(nextName)
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(
                            other -> {
                                throw new IllegalArgumentException("Collection '" + nextName + "' already exists");
                            });
            existing.setName(nextName);
        }

        if (dto.description() != null) existing.setDescription(dto.description());
        if (dto.type() != null) existing.setType(dto.type());
        existing.setUpdatedAt(Instant.now());
        if (dto.updatedBy() != null) existing.setUpdatedBy(dto.updatedBy());

        return dao.updateCollection(existing);
    }

    public void deleteCollection(UUID id) {
        getCollection(id);
        dao.deleteEndpointsByCollection(id);
        dao.deleteCollectionById(id);
    }

    public PageResult<ApiCollectionEndpointModel> listEndpoints(UUID collectionId, int page, int size) {
        ensureCollectionExists(collectionId);
        return dao.listEndpointsByCollection(collectionId, page, size);
    }

    public ApiCollectionEndpointModel getEndpoint(UUID collectionId, UUID endpointId) {
        ensureCollectionExists(collectionId);
        return dao.findEndpointByIdAndCollection(endpointId, collectionId)
                .orElseThrow(() -> new NotFoundException("Endpoint " + endpointId + " not found"));
    }

    public ApiCollectionEndpointModel createEndpoint(UUID collectionId, CreateApiCollectionEndpointRequest dto) {
        ensureCollectionExists(collectionId);

        Instant now = dto.createdAt() != null ? dto.createdAt() : Instant.now();
        ApiCollectionEndpointModel endpoint =
                ApiCollectionEndpointModel.builder()
                        .name(dto.name())
                        .description(dto.description())
                        .collection(collectionId)
                        .connection(dto.connection())
                        .config(dto.config())
                        .createdAt(now)
                        .createdBy(dto.createdBy())
                        .updatedAt(now)
                        .updatedBy(dto.createdBy())
                        .build();

        return dao.createEndpoint(endpoint);
    }

    public ApiCollectionEndpointModel updateEndpoint(UUID endpointId, UpdateApiCollectionEndpointRequest dto) {
        ApiCollectionEndpointModel existing =
                dao.findEndpointById(endpointId)
                        .orElseThrow(() -> new NotFoundException("Endpoint " + endpointId + " not found"));

        if (dto.name() != null && !dto.name().isBlank()) existing.setName(dto.name());
        if (dto.description() != null) existing.setDescription(dto.description());
        if (dto.connection() != null) existing.setConnection(dto.connection());
        if (dto.config() != null) existing.setConfig(dto.config());
        existing.setUpdatedAt(Instant.now());
        if (dto.updatedBy() != null) existing.setUpdatedBy(dto.updatedBy());

        return dao.updateEndpoint(existing);
    }

    public void deleteEndpoint(UUID endpointId) {
        dao.findEndpointById(endpointId)
                .orElseThrow(() -> new NotFoundException("Endpoint " + endpointId + " not found"));
        dao.deleteEndpointById(endpointId);
    }

    public ApiCollectionModel importCollection(ImportApiCollectionRequest dto) {
        String name = normalizeName(dto.name());
        if (dao.existsCollectionByName(name)) {
            throw new IllegalArgumentException("Collection '" + name + "' already exists");
        }

        Instant now = dto.createdAt() != null ? dto.createdAt() : Instant.now();
        ApiCollectionModel collection =
                ApiCollectionModel.builder()
                        .name(name)
                        .description(dto.description())
                        .type(dto.type())
                        .createdAt(now)
                        .createdBy(dto.createdBy())
                        .updatedAt(now)
                        .updatedBy(dto.createdBy())
                        .build();

        ApiCollectionModel savedCollection = dao.createCollection(collection);

        List<ImportApiCollectionRequest.ImportEndpointRequest> endpoints =
                dto.endpoints() != null ? dto.endpoints() : List.of();

        for (ImportApiCollectionRequest.ImportEndpointRequest ep : endpoints) {
            UUID epUser = ep.createdBy() != null ? ep.createdBy() : dto.createdBy();
            Instant epCreated = ep.createdAt() != null ? ep.createdAt() : now;
            ApiCollectionEndpointModel endpoint =
                    ApiCollectionEndpointModel.builder()
                            .name(ep.name())
                            .description(ep.description())
                            .collection(savedCollection.getId())
                            .connection(ep.connection() != null ? ep.connection() : dto.connection())
                            .config(ep.config())
                            .createdAt(epCreated)
                            .createdBy(epUser)
                            .updatedAt(epCreated)
                            .updatedBy(epUser)
                            .build();
            dao.createEndpoint(endpoint);
        }

        return savedCollection;
    }

    private void ensureCollectionExists(UUID id) {
        if (!dao.existsCollectionById(id)) {
            throw new NotFoundException("Collection " + id + " not found");
        }
    }

    private String normalizeName(String name) {
        return name == null ? "" : name.trim();
    }
}

