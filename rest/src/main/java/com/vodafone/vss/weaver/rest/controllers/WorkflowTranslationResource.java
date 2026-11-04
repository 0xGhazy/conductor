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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
            @RequestParam(value = "page", defaultValue = "0") @Min(0) int page,
            @RequestParam(value = "size", defaultValue = "20") @Max(200) @Min(1) int size,
            @RequestParam(value = "workflowName", required = false) String workflowName,
            @RequestParam(value = "workflowVersion", required = false) Integer workflowVersion,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "sortBy", defaultValue = "updatedAt") String sortBy,
            @RequestParam(value = "sortOrder", defaultValue = "DESC") String sortOrder) {
        ApiResponse response =
                translationService.searchTranslations(
                        workflowName, workflowVersion, search, page, size, sortBy, sortOrder);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @GetMapping("/{workflowName}/{version}")
    @Operation(summary = "Get translations map for a workflow version")
    public ResponseEntity<ApiResponse> getTranslationsMap(
            @PathVariable("workflowName") String workflowName, @PathVariable("version") Integer version) {
        ApiResponse response = translationService.getTranslationsMap(workflowName, version);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @GetMapping("/id/{id}")
    @Operation(summary = "Get translation by ID")
    public ResponseEntity<ApiResponse> getById(@PathVariable("id") UUID id) {
        ApiResponse response = translationService.getById(id);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create a workflow translation (all languages of one message code)")
    public ResponseEntity<ApiResponse> createTranslation(
            @Valid @RequestBody WorkflowTranslationDto dto) {
        ApiResponse response = translationService.createTranslation(dto, currentUserId());
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Replace the languages of a workflow translation",
            description =
                    "id is any row id of the message (the id returned by the list). Workflow name,"
                            + " version and message code cannot be changed.")
    public ResponseEntity<ApiResponse> updateTranslation(
            @PathVariable("id") UUID id, @Valid @RequestBody WorkflowTranslationDto dto) {
        ApiResponse response = translationService.updateTranslation(id, dto, currentUserId());
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PutMapping(
            path = "/{workflowName}/{version}/{messageCode}",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            summary = "Replace the languages of a workflow translation by workflow, version and message code",
            description = "Only the translations map of the body is used.")
    public ResponseEntity<ApiResponse> updateMessage(
            @PathVariable("workflowName") String workflowName,
            @PathVariable("version") @Min(1) int version,
            @PathVariable("messageCode") String messageCode,
            @RequestBody WorkflowTranslationDto dto) {
        ApiResponse response =
                translationService.updateMessage(workflowName, version, messageCode, dto, currentUserId());
        return new ResponseEntity<>(response, response.getStatus());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a workflow translation (all its languages)")
    public ResponseEntity<ApiResponse> deleteTranslation(@PathVariable("id") UUID id) {
        ApiResponse response = translationService.deleteTranslation(id);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @DeleteMapping("/{workflowName}/{version}/{messageCode}")
    @Operation(summary = "Delete a workflow translation by workflow, version and message code")
    public ResponseEntity<ApiResponse> deleteMessage(
            @PathVariable("workflowName") String workflowName,
            @PathVariable("version") @Min(1) int version,
            @PathVariable("messageCode") String messageCode) {
        ApiResponse response = translationService.deleteMessage(workflowName, version, messageCode);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PostMapping("/cache/reload")
    @Operation(summary = "Reload all translations into this server node's cache")
    public ResponseEntity<ApiResponse> reloadCache() {
        ApiResponse response = translationService.reloadCache();
        return new ResponseEntity<>(response, response.getStatus());
    }

    /**
     * The logged-in user's id, taken from the security context (for a Keycloak JWT this is the
     * token subject). Null when security is disabled or the id is not a UUID.
     */
    static UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(auth.getName());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
