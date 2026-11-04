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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vodafone.vss.weaver.common.ControllerUtils;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptBulkDeleteRequest;
import com.vodafone.vss.weaver.common.scripting.ScriptBulkDeleteResponse;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionRequest;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionResponse;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskDto;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.common.scripting.ScriptPageResponse;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;
import com.vodafone.vss.weaver.tasks.scripting.service.ScriptExecutorService;
import com.vodafone.vss.weaver.tasks.scripting.service.ScriptService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@Tag(name = "Scripts API", description = "Create, manage, and execute Python, JavaScript, and JEXL scripts")
@RequestMapping(value = "/api/scripts", produces = MediaType.APPLICATION_JSON_VALUE)
public class ScriptResource {

    private static final Logger log = LoggerFactory.getLogger(ScriptResource.class);

    private final ScriptExecutorService scriptExecutorService;
    private final ScriptService scriptService;
    private final ScriptMetricsService scriptMetricsService;

    @Autowired
    public ScriptResource(
            ScriptExecutorService scriptExecutorService,
            ScriptService scriptService,
            @Autowired(required = false) ScriptMetricsService scriptMetricsService) {
        this.scriptExecutorService = scriptExecutorService;
        this.scriptService = scriptService;
        this.scriptMetricsService = scriptMetricsService;
    }

    @PostMapping("/execute")
    @Operation(summary = "Execute script", description = "Executes an inline script payload and returns a normalized script engine result.")
    public ResponseEntity<ScriptEngineTaskResult> executeScript(@Valid @RequestBody ScriptEngineTaskDto payload) {
        long startedAt = System.nanoTime();
        Languages language = payload == null ? null : payload.getLanguage();
        ScriptEngineTaskResult result = null;
        try {
            result = scriptExecutorService.executeScript(payload);
            log.info("Script execute completed. language={}, durationMs={}, status={}, code={}",
                    language, elapsedMs(startedAt), result.getStatus(), result.getCode());
            return ResponseEntity.ok(result);
        } catch (RuntimeException ex) {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordExecutionFailure("api", language, "exception", elapsedMs(startedAt));
            }
            throw ex;
        } finally {
            if (result != null && scriptMetricsService != null) {
                scriptMetricsService.recordExecution("api", language, result, elapsedMs(startedAt));
            }
        }
    }

    @GetMapping
    @Operation(summary = "List scripts", description = "Returns stored scripts with pagination, optional language filter, and optional search by name or description.")
    public ResponseEntity<ApiResponse> fetchScripts(
            @Parameter(description = "Optional script language filter", example = "JAVA_SCRIPT")
            @RequestParam(required = false) Languages language,
            @Parameter(description = "Optional search term matched against script name or description", example = "sum")
            @RequestParam(required = false) String search,
            @ParameterObject
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        long startedAt = System.nanoTime();
        String status = "success";
        log.info("Fetching scripts request received - language={}, search={}, page={}, size={}",
                language, search, pageable.getPageNumber(), pageable.getPageSize());
        try {
            ScriptPageResponse scripts = scriptService.findAll(language, search, pageable);
            ApiResponse response = ControllerUtils.buildSuccessResponse(scripts, "Scripts fetched successfully", HttpStatus.OK, null);
            log.info("Fetching scripts request completed successfully - count={}, total={}",
                    scripts.numberOfElements(), scripts.totalElements());
            return new ResponseEntity<>(response, response.getStatus());
        } catch (RuntimeException ex) {
            status = "failed";
            throw ex;
        } finally {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordCrud("list", status, elapsedMs(startedAt));
            }
        }
    }

    @PostMapping
    @Operation(summary = "Create script", description = "Creates a stored script definition for later discovery or execution.")
    public ResponseEntity<ApiResponse> createScript(@Valid @RequestBody ScriptDefinitionRequest payload) {
        long startedAt = System.nanoTime();
        String status = "success";
        log.info("Creating script request received - name={}, language={}", payload.name(), payload.language());
        try {
            ScriptDefinitionResponse script = scriptService.create(payload);
            ApiResponse response = ControllerUtils.buildSuccessResponse(script, "Script created successfully", HttpStatus.CREATED, null);
            log.info("Creating script request completed successfully - id={}", script.id());
            return new ResponseEntity<>(response, response.getStatus());
        } catch (RuntimeException ex) {
            status = "failed";
            throw ex;
        } finally {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordCrud("create", status, elapsedMs(startedAt));
            }
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get script by id", description = "Fetches a single stored script by UUID.")
    public ResponseEntity<ApiResponse> fetchScriptById(
            @Parameter(description = "Script UUID", example = "018f5c0a-2ab1-7b87-9a1d-2c4d5e6f7001")
            @PathVariable UUID id) {
        long startedAt = System.nanoTime();
        String status = "success";
        log.info("Fetching script by id request received - id={}", id);
        try {
            ScriptDefinitionResponse script = scriptService.findById(id);
            ApiResponse response = ControllerUtils.buildSuccessResponse(script, "Script fetched successfully", HttpStatus.OK, null);
            log.info("Fetching script by id request completed successfully - id={}", id);
            return new ResponseEntity<>(response, response.getStatus());
        } catch (RuntimeException ex) {
            status = "failed";
            throw ex;
        } finally {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordCrud("get", status, elapsedMs(startedAt));
            }
        }
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update script by id", description = "Replaces a stored script definition by UUID.")
    public ResponseEntity<ApiResponse> updateScriptById(
            @Parameter(description = "Script UUID", example = "018f5c0a-2ab1-7b87-9a1d-2c4d5e6f7001")
            @PathVariable UUID id,
            @Valid @RequestBody ScriptDefinitionRequest payload) {
        long startedAt = System.nanoTime();
        String status = "success";
        log.info("Updating script by id request received - id={}, name={}, language={}",
                id, payload.name(), payload.language());
        try {
            ScriptDefinitionResponse script = scriptService.update(id, payload);
            ApiResponse response = ControllerUtils.buildSuccessResponse(script, "Script updated successfully", HttpStatus.OK, null);
            log.info("Updating script by id request completed successfully - id={}", id);
            return new ResponseEntity<>(response, response.getStatus());
        } catch (RuntimeException ex) {
            status = "failed";
            throw ex;
        } finally {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordCrud("update", status, elapsedMs(startedAt));
            }
        }
    }

    @DeleteMapping("/bulk")
    @Operation(summary = "Bulk delete scripts", description = "Deletes multiple stored script definitions by UUID.")
    public ResponseEntity<ApiResponse> bulkDeleteScripts(@Valid @RequestBody ScriptBulkDeleteRequest payload) {
        long startedAt = System.nanoTime();
        String status = "success";
        log.info("Bulk deleting scripts request received - count={}", payload.ids().size());
        try {
            ScriptBulkDeleteResponse result = scriptService.deleteBulk(payload.ids());
            ApiResponse response = ControllerUtils.buildSuccessResponse(result, "Scripts deleted successfully", HttpStatus.OK, null);
            log.info("Bulk deleting scripts request completed successfully - deletedCount={}", result.deletedCount());
            return new ResponseEntity<>(response, response.getStatus());
        } catch (RuntimeException ex) {
            status = "failed";
            throw ex;
        } finally {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordCrud("bulk_delete", status, elapsedMs(startedAt));
            }
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete script by id", description = "Deletes a stored script definition by UUID.")
    public ResponseEntity<Void> deleteScriptById(
            @Parameter(description = "Script UUID", example = "018f5c0a-2ab1-7b87-9a1d-2c4d5e6f7001")
            @PathVariable UUID id) {
        long startedAt = System.nanoTime();
        String status = "success";
        log.info("Deleting script by id request received - id={}", id);
        try {
            scriptService.delete(id);
            log.info("Deleting script by id request completed successfully - id={}", id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException ex) {
            status = "failed";
            throw ex;
        } finally {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordCrud("delete", status, elapsedMs(startedAt));
            }
        }
    }

    private long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}

