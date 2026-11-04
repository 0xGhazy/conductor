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
import java.util.UUID;

import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.http.CreateConnectionRequest;
import com.vodafone.vss.weaver.common.http.HttpConnectionModel;
import com.vodafone.vss.weaver.common.http.ShortDetailedHttpConnection;
import com.vodafone.vss.weaver.tasks.http.service.HttpConnectionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@Tag(name = "HTTP Connections Management", description = "Endpoints for managing and defining HTTP connections")
@RequestMapping(value = "/api/actions/http/connections", produces = MediaType.APPLICATION_JSON_VALUE)
public class HttpConnectionResource {

    private static final Logger log = LoggerFactory.getLogger(HttpConnectionResource.class);

    private final HttpConnectionService service;

    public HttpConnectionResource(HttpConnectionService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List HTTP connections with health state", description = "Returns all stored HTTP connections and their current active state.")
    public ResponseEntity<AppResponse> fetchConnections() {
        log.debug("Fetching all HTTP connections");
        List<ShortDetailedHttpConnection> result = service.listConnectionsWithStates();
        AppResponse response =
                AppResponse.builder()
                        .message("Connections fetched successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(result)
                        .build();
        return ResponseEntity.ok(response);
    }

    @PostMapping
    @Operation(summary = "Create an HTTP connection", description = "Registers a new HTTP connection and authentication strategy.")
    public ResponseEntity<AppResponse> storeConnection(@Valid @RequestBody CreateConnectionRequest payload) {
        log.info("Registering HTTP connection: name={}, strategy={}", payload.name(), payload.strategy());
        ShortDetailedHttpConnection result = service.registerConnection(payload);
        AppResponse response =
                AppResponse.builder()
                        .message("Connection registered successfully")
                        .status(HttpStatus.CREATED)
                        .success(true)
                        .data(result)
                        .build();
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get HTTP connection by id", description = "Fetches a single HTTP connection by UUID")
    public ResponseEntity<AppResponse> fetchConnectionById(@PathVariable("id") UUID id) {
        log.debug("Fetching HTTP connection: id={}", id);
        HttpConnectionModel result = service.fetchConnectionById(id);
        AppResponse response =
                AppResponse.builder()
                        .message("Connection fetched successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(result)
                        .build();
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update HTTP connection by id", description = "Updates a stored HTTP connection by UUID")
    public ResponseEntity<AppResponse> updateConnectionById(
            @PathVariable("id") UUID id, @Valid @RequestBody CreateConnectionRequest payload) {
        log.info("Updating HTTP connection: id={}, name={}, strategy={}", id, payload.name(), payload.strategy());
        ShortDetailedHttpConnection result = service.updateConnectionById(id, payload);
        AppResponse response =
                AppResponse.builder()
                        .message("Connection updated successfully")
                        .status(HttpStatus.OK)
                        .success(true)
                        .data(result)
                        .build();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete HTTP connection by id", description = "Deletes a stored HTTP connection by UUID")
    public ResponseEntity<Void> deleteConnectionById(@PathVariable("id") UUID id) {
        log.info("Deleting HTTP connection: id={}", id);
        service.deleteConnectionById(id);
        return ResponseEntity.noContent().build();
    }
}

