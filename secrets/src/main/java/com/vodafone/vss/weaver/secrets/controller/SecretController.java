package com.vodafone.vss.weaver.secrets.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.vodafone.vss.weaver.common.ControllerUtils;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.common.response.PaginatedResult;
import com.vodafone.vss.weaver.common.secrets.SecretRequest;
import com.vodafone.vss.weaver.common.secrets.SecretResponse;
import com.vodafone.vss.weaver.common.secrets.SecretUpdateRequest;
import com.vodafone.vss.weaver.common.secrets.SecretUsage;
import com.vodafone.vss.weaver.secrets.service.SecretService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

@Log4j2
@Validated
@RestController
@Tag(name = "Secrets Resource", description = "Managing secrets referenced as ${weaver.secrets.<name>} in connections")
@RequestMapping(value = "/api/secrets", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SecretController {

    private final SecretService secretService;

    @PostMapping
    @Operation(summary = "Create secret", description = "Create a new encrypted secret", operationId = "createSecret")
    public ResponseEntity<ApiResponse> createSecret(@Valid @RequestBody SecretRequest payload) {
        log.info("Create secret {} request received", payload.getName());
        SecretResponse secret = secretService.create(payload);
        URI location =
                ServletUriComponentsBuilder.fromCurrentRequest()
                        .path("/{id}")
                        .buildAndExpand(secret.getId())
                        .toUri();
        log.info("Create secret request completed successfully");
        return ResponseEntity.created(location)
                .body(
                        ControllerUtils.buildSuccessResponse(
                                secret, "Secret created successfully", HttpStatus.CREATED, null));
    }

    @GetMapping
    @Operation(
            summary = "Find all secrets (paginated)",
            description = "Find all secrets paginated. Values are never returned. Use minimal=true for picker items.",
            operationId = "findSecretsPaginated")
    public ResponseEntity<ApiResponse> findAllSecrets(
            @Parameter(description = "If true, returns minimal secret DTOs.")
                    @RequestParam(value = "minimal", defaultValue = "false")
                    boolean minimal,
            @Parameter(description = "Optional case-insensitive secret name search")
                    @RequestParam(value = "search", required = false)
                    String search,
            @ParameterObject
                    @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
                    Pageable pageable) {
        log.info(
                "Fetching paginated secrets request received - minimal={}, search={}, pageable={}",
                minimal,
                search,
                pageable);
        Page<?> page =
                minimal
                        ? secretService.findAllMinimal(pageable, search)
                        : secretService.findAll(pageable, search);
        log.info("Fetching paginated secrets request completed successfully");
        return ResponseEntity.ok(
                ControllerUtils.buildSuccessResponse(
                        page.getContent(),
                        "Secrets fetched successfully",
                        HttpStatus.OK,
                        PaginatedResult.of(
                                page.getTotalElements(),
                                page.getNumber(),
                                page.getSize(),
                                page.getNumberOfElements())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Find secret by id", description = "Find secret metadata by id", operationId = "findSecretById")
    public ResponseEntity<ApiResponse> findSecretById(
            @Parameter(description = "Secret id") @PathVariable("id") UUID id) {
        log.info("Fetching secret by id request received - id={}", id);
        SecretResponse secret = secretService.findById(id);
        log.info("Fetching secret by id request completed successfully");
        return ResponseEntity.ok(
                ControllerUtils.buildSuccessResponse(
                        secret, "Secret fetched successfully", HttpStatus.OK, null));
    }

    @GetMapping("/{id}/usages")
    @Operation(summary = "Find secret usages", description = "List the connections that reference the secret", operationId = "findSecretUsages")
    public ResponseEntity<ApiResponse> findSecretUsages(
            @Parameter(description = "Secret id") @PathVariable("id") UUID id) {
        log.info("Fetching secret usages request received - id={}", id);
        List<SecretUsage> usages = secretService.findUsages(id);
        log.info("Fetching secret usages completed - usages={}", usages.size());
        return ResponseEntity.ok(
                ControllerUtils.buildSuccessResponse(
                        usages, "Secret usages fetched successfully", HttpStatus.OK, null));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update secret", description = "Update secret value and/or description", operationId = "updateSecret")
    public ResponseEntity<ApiResponse> updateSecret(
            @Parameter(description = "Secret id") @PathVariable("id") UUID id,
            @Valid @RequestBody SecretUpdateRequest payload) {
        log.info("Update secret request received - id={}", id);
        SecretResponse updated = secretService.update(id, payload);
        log.info("Update secret request completed successfully");
        return ResponseEntity.ok(
                ControllerUtils.buildSuccessResponse(
                        updated, "Secret updated successfully", HttpStatus.OK, null));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete secret", description = "Delete secret if not in use", operationId = "deleteSecret")
    public ResponseEntity<ApiResponse> deleteSecret(
            @Parameter(description = "Secret id") @PathVariable("id") UUID id) {
        log.info("Delete secret request received - id={}", id);
        secretService.delete(id);
        log.info("Delete secret request completed successfully");
        return ResponseEntity.ok(
                ControllerUtils.buildSuccessResponse(
                        null, "Secret deleted successfully", HttpStatus.OK, null));
    }
}
