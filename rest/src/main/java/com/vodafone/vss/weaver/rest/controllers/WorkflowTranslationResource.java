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

import com.vodafone.vss.weaver.common.respond.WorkflowTranslationDto;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.tasks.respond.service.WorkflowTranslationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping(path = "/api/workflows/translations", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Workflow Translations", description = "Workflow localized translation management endpoints")
public class WorkflowTranslationResource {

    private final WorkflowTranslationService translationService;

    public WorkflowTranslationResource(WorkflowTranslationService translationService) {
        this.translationService = translationService;
    }

    @GetMapping
    @Operation(summary = "Search workflow translations (paginated)")
    public ResponseEntity<ApiResponse> searchTranslations(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Max(200) @Min(1) int size,
            @RequestParam(required = false) String workflowName,
            @RequestParam(required = false) Integer workflowVersion,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortOrder) {
        ApiResponse response =
                translationService.searchTranslations(
                        workflowName, workflowVersion, search, page, size, sortBy, sortOrder);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @GetMapping("/{workflowName}/{version}")
    @Operation(summary = "Get translations map for a workflow version")
    public ResponseEntity<ApiResponse> getTranslationsMap(
            @PathVariable String workflowName, @PathVariable Integer version) {
        ApiResponse response = translationService.getTranslationsMap(workflowName, version);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @GetMapping("/id/{id}")
    @Operation(summary = "Get translation by ID")
    public ResponseEntity<ApiResponse> getById(@PathVariable UUID id) {
        ApiResponse response = translationService.getById(id);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create workflow translation")
    public ResponseEntity<ApiResponse> createTranslation(
            @Valid @RequestBody WorkflowTranslationDto dto) {
        ApiResponse response = translationService.createTranslation(dto);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Update workflow translation")
    public ResponseEntity<ApiResponse> updateTranslation(
            @PathVariable UUID id, @Valid @RequestBody WorkflowTranslationDto dto) {
        ApiResponse response = translationService.updateTranslation(id, dto);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete workflow translation")
    public ResponseEntity<ApiResponse> deleteTranslation(@PathVariable UUID id) {
        ApiResponse response = translationService.deleteTranslation(id);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PostMapping("/cache/reload")
    @Operation(summary = "Force reload all translations into cache")
    public ResponseEntity<ApiResponse> reloadCache() {
        ApiResponse response = translationService.reloadCache();
        return new ResponseEntity<>(response, response.getStatus());
    }
}

