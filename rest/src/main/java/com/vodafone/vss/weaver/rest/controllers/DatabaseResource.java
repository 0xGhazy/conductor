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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.vodafone.vss.weaver.actions.database.dto.DatabaseConnectionTestRequest;
import com.vodafone.vss.weaver.actions.database.dto.DatabaseRequest;
import com.vodafone.vss.weaver.actions.database.dto.SqlExecutionRequest;
import com.vodafone.vss.weaver.actions.database.service.DatasourceService;
import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.DatasourceStatus;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.response.PaginatedResult;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Databases (JDBC connections) used by DATABASE tasks and saved queries.
 *
 * <p>Writes, connection tests and SQL execution need the admin or operator role when security is
 * enabled (see WeaverSecurityConfiguration). Passwords are never returned.
 */
@Validated
@RestController
@Tag(name = "Databases", description = "Manage database connections and run SQL against them")
@RequestMapping(value = "/api/databases", produces = MediaType.APPLICATION_JSON_VALUE)
public class DatabaseResource {

    // Pickers in the UI load whole lists (up to 1000); these tables are small.
    static final int MAX_PAGE_SIZE = 1000;

    private final QueryService queryService;
    private final DatasourceService datasourceService;

    public DatabaseResource(QueryService queryService, DatasourceService datasourceService) {
        this.queryService = queryService;
        this.datasourceService = datasourceService;
    }

    @GetMapping
    @Operation(summary = "List databases", description = "Newest first, with connection status.", operationId = "listDatabases")
    public ResponseEntity<AppResponse> listDatabases(
            @Parameter(description = "Case-insensitive name search") @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "Page number, from 0") @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @Parameter(description = "Page size, 1 to 1000") @RequestParam(name = "size", defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size) {
        return page(datasourceService.list(search, page, size), "Databases fetched successfully");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create database", description = "The password is required. Returns 201 with a Location header.", operationId = "createDatabase")
    public ResponseEntity<AppResponse> createDatabase(@RequestBody DatabaseRequest payload) {
        DatasourceModel created = datasourceService.create(payload);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.getId()).toUri();
        return ResponseEntity.created(location).body(ok(HttpStatus.CREATED, "Database created successfully", created));
    }

    @PostMapping(path = "/test", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Test a connection without saving",
            description = "Tries to connect with the given definition and returns the status (ACTIVE or INACTIVE with the reason). "
                    + "Nothing is saved. Include the id of a saved database to reuse its stored password.",
            operationId = "testDatabaseConnection")
    public ResponseEntity<AppResponse> testConnection(@RequestBody DatabaseConnectionTestRequest payload) {
        DatasourceStatus status = datasourceService.testConnection(payload);
        boolean reachable = "ACTIVE".equals(status.status());
        AppResponse body = AppResponse.builder()
                .message(reachable ? "Connection succeeded" : "Connection failed")
                .reason(reachable ? null : status.reason())
                .code(reachable ? null : status.errorCode())
                .data(status)
                .status(HttpStatus.OK)
                .success(reachable)
                .retryable(!reachable)
                .build();
        return ResponseEntity.ok(body);
    }

    @PostMapping(path = "/ping", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Ping several databases", description = "Body: JSON array of database ids. 404 lists any unknown ids.", operationId = "pingDatabases")
    public ResponseEntity<AppResponse> pingDatabases(
            @RequestBody @NotEmpty(message = "At least one database id is required") Set<@NotNull UUID> ids) {
        List<DatasourceModel> results = datasourceService.ping(ids);
        return ResponseEntity.ok(ok(HttpStatus.OK, "Ping completed", results));
    }

    /** Queries returned by {@code ?withQueries=true}; the same first page the database page shows. */
    static final int EMBEDDED_QUERIES = 100;

    @GetMapping("/{id}")
    @Operation(summary = "Get database",
            description = "With connection status. withQueries=true also returns its saved queries "
                    + "(newest first, at most 100, without SQL), like GET /api/databases/{id}/queries?size=100.",
            operationId = "getDatabase")
    public ResponseEntity<AppResponse> getDatabase(
            @Parameter(description = "Database id") @PathVariable("id") UUID id,
            @Parameter(description = "Also return the database's saved queries")
                    @RequestParam(name = "withQueries", defaultValue = "false") boolean withQueries) {
        DatasourceModel database = datasourceService.get(id);
        if (withQueries) {
            database.setQueries(queryService.list(id, false, null, 0, EMBEDDED_QUERIES).getContent());
        }
        return ResponseEntity.ok(ok(HttpStatus.OK, "Database fetched successfully", database));
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Update database", description = "A blank or masked password keeps the stored one.", operationId = "updateDatabase")
    public ResponseEntity<AppResponse> updateDatabase(
            @Parameter(description = "Database id") @PathVariable("id") UUID id,
            @RequestBody DatabaseRequest payload) {
        return ResponseEntity.ok(ok(HttpStatus.OK, "Database updated successfully", datasourceService.update(id, payload)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete database", description = "204 on success; 409 while saved queries still use it.", operationId = "deleteDatabase")
    public ResponseEntity<Void> deleteDatabase(@Parameter(description = "Database id") @PathVariable("id") UUID id) {
        datasourceService.deleteDatabase(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/ping")
    @Operation(summary = "Ping database", description = "Returns the database with a fresh connection status.", operationId = "pingDatabase")
    public ResponseEntity<AppResponse> pingDatabase(@Parameter(description = "Database id") @PathVariable("id") UUID id) {
        return ResponseEntity.ok(ok(HttpStatus.OK, "Ping completed", datasourceService.ping(id)));
    }

    @GetMapping("/{id}/queries")
    @Operation(summary = "List the database's saved queries", description = "Same as GET /api/queries?databaseId={id}.", operationId = "listDatabaseQueries")
    public ResponseEntity<AppResponse> listDatabaseQueries(
            @Parameter(description = "Database id") @PathVariable("id") UUID id,
            @Parameter(description = "Include each query's SQL") @RequestParam(name = "includeSql", defaultValue = "false") boolean includeSql,
            @Parameter(description = "Case-insensitive name search") @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "Page number, from 0") @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @Parameter(description = "Page size, 1 to 1000") @RequestParam(name = "size", defaultValue = "20") @Min(1) @Max(MAX_PAGE_SIZE) int size) {
        datasourceService.get(id); // 404 for an unknown database instead of an empty page
        Page<QueryModel> result = queryService.list(id, includeSql, search, page, size);
        return page(result, "Queries fetched successfully");
    }

    @PostMapping(path = "/{id}/execute", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Run SQL on the database",
            description = "Runs the SQL in the body. Rows are capped by maxRows (and weaver.database.execute.max-rows); "
                    + "the result has truncated=true when rows were cut. 422 when the database rejects the SQL.",
            operationId = "executeSqlOnDatabase")
    public ResponseEntity<AppResponse> executeSql(
            @Parameter(description = "Database id") @PathVariable("id") UUID id,
            @Valid @RequestBody SqlExecutionRequest payload) {
        return executionResponse(queryService.runSql(id, payload));
    }

    /** 200 when the SQL ran, 422 with the database's error when it did not. */
    static ResponseEntity<AppResponse> executionResponse(QueryExecutionResult result) {
        boolean succeeded = "SUCCESS".equals(result.getStatus());
        HttpStatus status = succeeded ? HttpStatus.OK : HttpStatus.UNPROCESSABLE_ENTITY;
        AppResponse body = AppResponse.builder()
                .message(succeeded ? "SQL executed successfully" : "SQL execution failed")
                .reason(succeeded || result.getReason() == null ? null : String.valueOf(result.getReason()))
                .code(succeeded ? null : result.getErrorCode())
                .data(result)
                .status(status)
                .success(succeeded)
                .retryable(false)
                .build();
        return ResponseEntity.status(status).body(body);
    }

    static AppResponse ok(HttpStatus status, String message, Object data) {
        return AppResponse.builder()
                .message(message)
                .data(data)
                .status(status)
                .success(true)
                .retryable(false)
                .build();
    }

    static ResponseEntity<AppResponse> page(Page<?> page, String message) {
        PaginatedResult details = new PaginatedResult(
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.getNumberOfElements());
        AppResponse body = AppResponse.builder()
                .message(message)
                .data(page.getContent())
                .details(details)
                .status(HttpStatus.OK)
                .success(true)
                .retryable(false)
                .build();
        return ResponseEntity.ok(body);
    }
}
