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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.vodafone.vss.weaver.common.language.SupportedLanguageDto;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.tasks.respond.service.SupportedLanguageService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping(path = "/api/settings/languages", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Supported Languages Settings", description = "Application-wide supported languages management")
public class SupportedLanguageResource {

    private static final Logger log = LoggerFactory.getLogger(SupportedLanguageResource.class);

    private final SupportedLanguageService languageService;

    public SupportedLanguageResource(SupportedLanguageService languageService) {
        this.languageService = languageService;
    }

    @GetMapping
    @Operation(summary = "Get all application-wide supported languages")
    public ResponseEntity<ApiResponse> getAllLanguages() {
        ApiResponse response = languageService.getAllLanguages();
        return new ResponseEntity<>(response, response.getStatus());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get supported language by ID")
    public ResponseEntity<ApiResponse> getLanguageById(@PathVariable UUID id) {
        ApiResponse response = languageService.getLanguageById(id);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Add a new supported language")
    public ResponseEntity<ApiResponse> createLanguage(@Valid @RequestBody SupportedLanguageDto dto) {
        ApiResponse response = languageService.createLanguage(dto);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Update an existing supported language")
    public ResponseEntity<ApiResponse> updateLanguage(
            @PathVariable UUID id, @Valid @RequestBody SupportedLanguageDto dto) {
        ApiResponse response = languageService.updateLanguage(id, dto);
        return new ResponseEntity<>(response, response.getStatus());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a supported language")
    public ResponseEntity<ApiResponse> deleteLanguage(@PathVariable UUID id) {
        ApiResponse response = languageService.deleteLanguage(id);
        return new ResponseEntity<>(response, response.getStatus());
    }
}

