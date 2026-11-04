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

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.http.ApiCollectionEndpointModel;
import com.vodafone.vss.weaver.common.http.ApiCollectionModel;
import com.vodafone.vss.weaver.common.http.CreateApiCollectionEndpointRequest;
import com.vodafone.vss.weaver.common.http.CreateApiCollectionRequest;
import com.vodafone.vss.weaver.common.http.ImportApiCollectionRequest;
import com.vodafone.vss.weaver.common.http.UpdateApiCollectionEndpointRequest;
import com.vodafone.vss.weaver.common.http.UpdateApiCollectionRequest;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.tasks.http.service.ApiCollectionsService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@Tag(name = "API Collections", description = "Endpoints for managing HTTP API collections and endpoint definitions")
@RequestMapping(value = "/api/actions/http/collections", produces = MediaType.APPLICATION_JSON_VALUE)
public class ApiCollectionsResource {

    private final ApiCollectionsService service;

    public ApiCollectionsResource(ApiCollectionsService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List API collections with pagination")
    public ResponseEntity<AppResponse> listCollections(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        PageResult<ApiCollectionModel> result = service.listCollections(page, size);
        AppResponse response =
                AppResponse.builder()
                        .message("Collections fetched successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(result.content())
                        .details(result.pagination())
                        .build();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get API collection by ID")
    public ResponseEntity<AppResponse> getCollection(@PathVariable("id") UUID id) {
        ApiCollectionModel collection = service.getCollection(id);
        AppResponse response =
                AppResponse.builder()
                        .message("Collection fetched successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(collection)
                        .build();
        return ResponseEntity.ok(response);
    }

    @PostMapping
    @Operation(summary = "Create a new API collection")
    public ResponseEntity<AppResponse> createCollection(@Valid @RequestBody CreateApiCollectionRequest payload) {
        ApiCollectionModel created = service.createCollection(payload);
        AppResponse response =
                AppResponse.builder()
                        .message("Collection created successfully")
                        .status(HttpStatus.CREATED)
                        .success(true)
                        .data(created)
                        .build();
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Update an API collection")
    public ResponseEntity<AppResponse> updateCollection(
            @PathVariable("id") UUID id, @Valid @RequestBody UpdateApiCollectionRequest payload) {
        ApiCollectionModel updated = service.updateCollection(id, payload);
        AppResponse response =
                AppResponse.builder()
                        .message("Collection updated successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(updated)
                        .build();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an API collection and its endpoints")
    public ResponseEntity<Void> deleteCollection(@PathVariable("id") UUID id) {
        service.deleteCollection(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import")
    @Operation(summary = "Import an API collection (Postman/Swagger)")
    public ResponseEntity<AppResponse> importCollection(@Valid @RequestBody ImportApiCollectionRequest payload) {
        ApiCollectionModel created = service.importCollection(payload);
        AppResponse response =
                AppResponse.builder()
                        .message("Collection imported successfully")
                        .status(HttpStatus.CREATED)
                        .success(true)
                        .data(created)
                        .build();
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping("/{id}/endpoints")
    @Operation(summary = "List endpoints within an API collection")
    public ResponseEntity<AppResponse> listEndpoints(
            @PathVariable("id") UUID id,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "50") int size) {
        PageResult<ApiCollectionEndpointModel> result = service.listEndpoints(id, page, size);
        AppResponse response =
                AppResponse.builder()
                        .message("Endpoints fetched successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(result.content())
                        .details(result.pagination())
                        .build();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/endpoints/{endpointId}")
    @Operation(summary = "Get an endpoint by ID within a collection")
    public ResponseEntity<AppResponse> getEndpoint(@PathVariable("id") UUID id, @PathVariable("endpointId") UUID endpointId) {
        ApiCollectionEndpointModel endpoint = service.getEndpoint(id, endpointId);
        AppResponse response =
                AppResponse.builder()
                        .message("Endpoint fetched successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(endpoint)
                        .build();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/endpoints")
    @Operation(summary = "Create an endpoint within a collection")
    public ResponseEntity<AppResponse> createEndpoint(
            @PathVariable("id") UUID id, @Valid @RequestBody CreateApiCollectionEndpointRequest payload) {
        ApiCollectionEndpointModel created = service.createEndpoint(id, payload);
        AppResponse response =
                AppResponse.builder()
                        .message("Endpoint created successfully")
                        .status(HttpStatus.CREATED)
                        .success(true)
                        .data(created)
                        .build();
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PatchMapping("/endpoints/{endpointId}")
    @Operation(summary = "Update an endpoint")
    public ResponseEntity<AppResponse> updateEndpoint(
            @PathVariable("endpointId") UUID endpointId, @Valid @RequestBody UpdateApiCollectionEndpointRequest payload) {
        ApiCollectionEndpointModel updated = service.updateEndpoint(endpointId, payload);
        AppResponse response =
                AppResponse.builder()
                        .message("Endpoint updated successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(updated)
                        .build();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/endpoints/{endpointId}")
    @Operation(summary = "Delete an endpoint")
    public ResponseEntity<Void> deleteEndpoint(@PathVariable("endpointId") UUID endpointId) {
        service.deleteEndpoint(endpointId);
        return ResponseEntity.noContent().build();
    }
}

