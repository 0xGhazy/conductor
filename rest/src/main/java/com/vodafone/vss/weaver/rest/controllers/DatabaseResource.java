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

import java.util.Set;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.vodafone.vss.weaver.actions.database.dto.AdhocQueryExecutionRequest;
import com.vodafone.vss.weaver.actions.database.service.DatasourceService;
import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.actions.database.validation.ApiInput;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.dto.AppResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@Validated
@RestController
@Tag(name = "Database Resource", description = "Managing RDBMS database instances and queries")
@RequestMapping(value = "/api/database", produces = MediaType.APPLICATION_JSON_VALUE)
public class DatabaseResource {

    private static final Logger log = LoggerFactory.getLogger(DatabaseResource.class);

    private final QueryService queryService;
    private final DatasourceService datasourceService;

    public DatabaseResource(QueryService queryService, DatasourceService datasourceService) {
        this.queryService = queryService;
        this.datasourceService = datasourceService;
    }

    @PostMapping("/instances")
    @Operation(summary = "Create database instance", description = "Create a new database instance. Password is required.", operationId = "createDatabaseInstance")
    public ResponseEntity<AppResponse> createDatabaseInstance(@Validated(ApiInput.class) @RequestBody DatasourceModel payload) {
        log.info("Create database instance {} request received", payload.getName());
        ResponseEntity<AppResponse> response = datasourceService.createDatabase(payload);
        log.info("Create database instance request completed successfully");
        return response;
    }

    @PutMapping("/instances/{id}")
    @Operation(summary = "Update database instance by id", description = "Update an existing database instance. A blank or masked password keeps the stored one.", operationId = "updateDatabaseInstance")
    public ResponseEntity<AppResponse> updateDatabase(@PathVariable("id") UUID id, @Validated(ApiInput.class) @RequestBody DatasourceModel payload) {
        log.info("Update database instance {} request received - id={}", payload.getName(), id);
        ResponseEntity<AppResponse> response = datasourceService.updateRest(id, payload);
        log.info("Update database instance request completed successfully");
        return response;
    }

    @GetMapping("/instances")
    @Operation(summary = "Find all databases instances (paginated)", description = "Find all database instances paginated, returned as models with connection status.", operationId = "findDatabaseInstancesPaginated")
    public ResponseEntity<AppResponse> findAllDatabaseInstances(
            @Parameter(description = "Optional case-insensitive database instance name search") @RequestParam(value = "search", required = false) String search,
            @ParameterObject @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        log.info("Fetching paginated database instances request received - search={}, pageable={}", search, pageable);
        ResponseEntity<AppResponse> response = datasourceService.findAllPaginatedRest(pageable, search);
        log.info("Fetching paginated database instances request completed successfully");
        return response;
    }

    @GetMapping("/instances/{id}")
    @Operation(summary = "Find database instance by id", description = "Find database instance by id with connection status", operationId = "findDatabaseInstanceById")
    public ResponseEntity<AppResponse> findDatabaseInstanceById(
            @Parameter(description = "Database instance id") @PathVariable("id") UUID id) {
        log.info("Fetching datasource by id request received - id={}", id);
        ResponseEntity<AppResponse> response = datasourceService.findByIdRest(id);
        log.info("Fetching datasource by id request completed successfully");
        return response;
    }

    @DeleteMapping("/instances/{id}")
    @Operation(summary = "Delete database instance by id", description = "Delete database instance by id", operationId = "deleteDatabaseInstanceById")
    public ResponseEntity<AppResponse> deleteDatabaseInstance(@Parameter(description = "Database instance id") @PathVariable("id") UUID id) {
        log.info("Deleting database instance by id request received - id={}", id);
        ResponseEntity<AppResponse> response = datasourceService.deleteByIdRest(id);
        log.info("Deleting database instance by id request completed successfully");
        return response;
    }

    @PostMapping("/instances/status")
    @Operation(summary = "Get database instances statuses", description = "Check connection status for multiple datasources. Body: JSON array of datasource ids.", operationId = "bulkPingDatabaseInstances")
    public ResponseEntity<AppResponse> bulkPingDatabaseInstances(@RequestBody @NotEmpty(message = "Requested IDs is required") Set<@NotNull UUID> ids) {
        log.info("Bulk ping database instances request received - count={}", ids.size());
        ResponseEntity<AppResponse> response = datasourceService.bulkPingRest(ids);
        log.info("Bulk ping database instances request completed successfully");
        return response;
    }

    @PostMapping("/instances/{id}/ping")
    @Operation(summary = "Ping database instance by id", description = "Check connection status for a database instance", operationId = "pingDatabaseInstanceById")
    public ResponseEntity<AppResponse> pingDatabaseInstance(@Parameter(description = "Database instance id") @PathVariable("id") UUID id) {
        log.info("Ping database instance request received - id={}", id);
        ResponseEntity<AppResponse> response = datasourceService.bulkPingRest(Set.of(id));
        log.info("Ping database instance request completed successfully");
        return response;
    }

    // ----- Queries API ----- //

    @GetMapping("/queries")
    @Operation(summary = "Find all queries (paginated)", description = "Find all queries paginated with optional datasource and search filtering.", operationId = "findQueriesPaginated")
    public ResponseEntity<AppResponse> findAllPageable(
            @Parameter(description = "Optional datasource UUID filter") @RequestParam(value = "datasource", required = false) UUID datasource,
            @Parameter(description = "If true, populates the SQL query in the response; if false, it is null.") @RequestParam(value = "includeQuery", defaultValue = "false") boolean includeQuery,
            @Parameter(description = "Optional case-insensitive query name search") @RequestParam(value = "search", required = false) String search,
            @ParameterObject @PageableDefault(page = 0, size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        log.info("Query findAll pageable request received - datasource={}, includeQuery={}, search={}, pageable={}", datasource, includeQuery, search, pageable);
        ResponseEntity<AppResponse> response = queryService.findAllPageableRest(datasource, includeQuery, search, pageable);
        log.info("Query findAll pageable request completed successfully");
        return response;
    }

    @GetMapping("/queries/{id}")
    @Operation(summary = "Find query by id", description = "Find query by id with optional SQL query inclusion", operationId = "findQueryById")
    public ResponseEntity<AppResponse> findQueryById(
            @Parameter(description = "Query UUID") @PathVariable("id") UUID id,
            @Parameter(description = "If true, populates the SQL query in the response; if false, it is null.") @RequestParam(value = "includeQuery", defaultValue = "false") boolean includeQuery) {
        log.info("Query findById request received - {}, includeQuery={}", id, includeQuery);
        ResponseEntity<AppResponse> response = queryService.findByIdRest(id, includeQuery);
        log.info("Query findById request completed successfully");
        return response;
    }

    @PostMapping("/queries")
    @Operation(summary = "Create query", description = "Create a new query definition.", operationId = "createQuery")
    public ResponseEntity<AppResponse> createQuery(@Validated(ApiInput.class) @RequestBody QueryModel payload) {
        log.info("Query create request received - {}", payload.getName());
        ResponseEntity<AppResponse> response = queryService.createRest(payload);
        log.info("Query create request completed successfully");
        return response;
    }

    @PutMapping("/queries/{id}")
    @Operation(summary = "Update query by id", description = "Update an existing query definition", operationId = "updateQueryById")
    public ResponseEntity<AppResponse> updateQuery(
            @Parameter(description = "Query UUID") @PathVariable("id") UUID id,
            @Validated(ApiInput.class) @RequestBody QueryModel payload) {
        log.info("Query update request received - {}", id);
        ResponseEntity<AppResponse> response = queryService.updateRest(id, payload);
        log.info("Query update request completed successfully");
        return response;
    }

    @DeleteMapping("/queries/{id}")
    @Operation(summary = "Delete query by id", description = "Delete a query definition by its unique identifier", operationId = "deleteQueryById")
    public ResponseEntity<AppResponse> deleteQuery(
            @Parameter(description = "Query UUID") @PathVariable("id") UUID id) {
        log.info("Query delete request received - {}", id);
        ResponseEntity<AppResponse> response = queryService.deleteByIdRest(id);
        log.info("Query delete request completed successfully");
        return response;
    }

    @DeleteMapping("/queries")
    @Operation(summary = "Bulk delete queries", description = "Delete multiple queries. Body: JSON array of query ids.", operationId = "bulkDeleteQueries")
    public ResponseEntity<AppResponse> bulkDeleteQueries(
            @RequestBody @NotEmpty(message = "Requested IDs is required") Set<@NotNull UUID> ids) {
        log.info("Bulk delete queries request received - count={}", ids.size());
        ResponseEntity<AppResponse> response = queryService.bulkDeleteRest(ids);
        log.info("Bulk delete queries request completed successfully");
        return response;
    }

    @PostMapping("/queries/adhoc-executions")
    @Operation(summary = "Execute query", description = "Execute the SQL statement sent in the request body against a datasource.", operationId = "executeAdhocQuery")
    public ResponseEntity<AppResponse> executeAdhocQuery(
            @Valid @RequestBody AdhocQueryExecutionRequest payload) {
        log.info("Execute ad-hoc query request received - datasource={}", payload.getDatasource());
        ResponseEntity<AppResponse> response = queryService.executeAdhocQueryRest(payload);
        log.info("Execute ad-hoc query request completed successfully");
        return response;
    }
}

