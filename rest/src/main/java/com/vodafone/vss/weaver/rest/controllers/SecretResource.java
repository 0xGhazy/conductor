/*
 * Copyright 2026 Conductor Authors.
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
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.vodafone.vss.weaver.dao.SecretsDAO;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
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

@Validated
@RestController
@Tag(name = "Secrets Resource", description = "Managing secrets referenced as ${weaver.secrets.<name>} in connections")
@RequestMapping(value = "/api/secrets", produces = MediaType.APPLICATION_JSON_VALUE)
public class SecretResource {

        private static final Logger log = LoggerFactory.getLogger(SecretResource.class);

        private final SecretService secretService;
        private final SecretsDAO secretsDAO;

        @Autowired
        public SecretResource(
                        @Autowired(required = false) SecretService secretService,
                        @Autowired(required = false) SecretsDAO secretsDAO) {
                this.secretService = secretService;
                this.secretsDAO = secretsDAO;
        }

        public SecretResource(SecretsDAO secretsDAO) {
                this(null, secretsDAO);
        }

        public SecretResource(SecretService secretService) {
                this(secretService, null);
        }

        @GetMapping("/names")
        @Operation(summary = "List secret names (values are never returned)")
        public List<String> listSecretNames() {
                return secretsDAO != null ? secretsDAO.listSecretNames() : Collections.emptyList();
        }

        @PostMapping
        @Operation(summary = "Create secret", description = "Create a new encrypted secret", operationId = "createSecret")
        public ResponseEntity<ApiResponse> createSecret(@Valid @RequestBody SecretRequest payload) {
                log.info("Create secret {} request received", payload.getName());
                SecretResponse secret = secretService.create(payload);
                URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                                .path("/{id}")
                                .buildAndExpand(secret.getId())
                                .toUri();
                log.info("Create secret request completed successfully");
                return ResponseEntity.created(location)
                                .body(
                                                ControllerUtils.buildSuccessResponse(
                                                                secret, "Secret created successfully",
                                                                HttpStatus.CREATED, null));
        }

        @GetMapping
        @Operation(summary = "Find all secrets (paginated)", description = "Find all secrets paginated. Values are never returned. Use minimal=true for picker items.", operationId = "findSecretsPaginated")
        public ResponseEntity<ApiResponse> findAllSecrets(
                        @Parameter(description = "If true, returns minimal secret DTOs.") @RequestParam(value = "minimal", defaultValue = "false") boolean minimal,
                        @Parameter(description = "Optional case-insensitive secret name search") @RequestParam(value = "search", required = false) String search,
                        @ParameterObject @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
                log.info(
                                "Fetching paginated secrets request received - minimal={}, search={}, pageable={}",
                                minimal,
                                search,
                                pageable);
                Page<?> page = minimal
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
