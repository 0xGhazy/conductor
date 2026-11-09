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

import java.net.URI;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.vodafone.vss.weaver.actions.database.dto.BulkDeleteResult;
import com.vodafone.vss.weaver.actions.database.dto.QueryExecutionRequest;
import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.dto.AppResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import static com.vodafone.vss.weaver.rest.controllers.DatabaseResource.MAX_PAGE_SIZE;

/**
 * Saved SQL queries, each bound to one database.
 *
 * <p>Writes and execution need the admin or operator role when security is enabled
 * (see WeaverSecurityConfiguration).
 */
@Validated
@RestController
@Tag(name = "Queries", description = "Manage and run saved SQL queries")
@RequestMapping(value = "/api/queries", produces = MediaType.APPLICATION_JSON_VALUE)
public class QueryResource {

    private final QueryService queryService;

    public QueryResource(QueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    @Operation(summary = "List queries", description = "Newest first; optionally only one database's queries.", operationId = "listQueries")
    public ResponseEntity<AppResponse> listQueries(
            @Parameter(description = "Only queries of this database") @RequestParam(name = "databaseId", required = false) UUID databaseId,
            @Parameter(description = "Include each query's SQL") @RequestParam(name = "includeSql", defaultValue = "false") boolean includeSql,
            @Parameter(description = "Case-insensitive name search") @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "Page number, from 0") @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @Parameter(description = "Page size, 1 to 1000") @RequestParam(name = "size", defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size) {
        return DatabaseResource.page(queryService.list(databaseId, includeSql, search, page, size), "Queries fetched successfully");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create query", description = "Returns 201 with a Location header; 409 when the database already has a query with that name.", operationId = "createQuery")
    public ResponseEntity<AppResponse> createQuery(@RequestBody QueryModel payload) {
        QueryModel created = queryService.create(payload);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.getId()).toUri();
        return ResponseEntity.created(location)
                .body(DatabaseResource.ok(HttpStatus.CREATED, "Query created successfully", created));
    }

    @PostMapping(path = "/bulk-delete", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Delete several queries", description = "Body: JSON array of query ids. Returns the deleted ids and the ids that did not exist.", operationId = "bulkDeleteQueries")
    public ResponseEntity<AppResponse> bulkDeleteQueries(
            @RequestBody @NotEmpty(message = "At least one query id is required") Set<@NotNull UUID> ids) {
        BulkDeleteResult result = queryService.deleteAll(ids);
        return ResponseEntity.ok(DatabaseResource.ok(HttpStatus.OK, "Queries deleted", result));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get query", operationId = "getQuery")
    public ResponseEntity<AppResponse> getQuery(
            @Parameter(description = "Query id") @PathVariable("id") UUID id,
            @Parameter(description = "Include the SQL") @RequestParam(name = "includeSql", defaultValue = "false") boolean includeSql) {
        return ResponseEntity.ok(DatabaseResource.ok(HttpStatus.OK, "Query fetched successfully", queryService.get(id, includeSql)));
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Update query", operationId = "updateQuery")
    public ResponseEntity<AppResponse> updateQuery(
            @Parameter(description = "Query id") @PathVariable("id") UUID id,
            @RequestBody QueryModel payload) {
        return ResponseEntity.ok(DatabaseResource.ok(HttpStatus.OK, "Query updated successfully", queryService.update(id, payload)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete query", description = "204 on success.", operationId = "deleteQuery")
    public ResponseEntity<Void> deleteQuery(@Parameter(description = "Query id") @PathVariable("id") UUID id) {
        queryService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/execute")
    @Operation(summary = "Run saved query",
            description = "Runs the saved SQL with the given parameters (converted to their declared types). "
                    + "Rows are capped like POST /api/databases/{id}/execute. 422 when the database rejects the SQL.",
            operationId = "executeQuery")
    public ResponseEntity<AppResponse> executeQuery(
            @Parameter(description = "Query id") @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) QueryExecutionRequest payload) {
        return DatabaseResource.executionResponse(queryService.runQuery(id, payload));
    }
}
