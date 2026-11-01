package com.vodafone.vss.weaver.tasks.respond.controller;

import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.vodafone.vss.weaver.common.language.SupportedLanguageDto;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.tasks.respond.service.SupportedLanguageService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

@Log4j2
@RestController
@RequestMapping(path = "/api/settings/languages", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Supported Languages Settings", description = "Application-wide supported languages management")
@RequiredArgsConstructor
public class SupportedLanguageController {

    private final SupportedLanguageService languageService;

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

