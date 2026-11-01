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
package com.vodafone.vss.weaver.tasks.respond.service;

import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationDto;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationModel;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class WorkflowTranslationService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowTranslationService.class);

    private final WorkflowTranslationDAO translationDAO;
    private final WorkflowTranslationCacheService cacheService;

    public ApiResponse searchTranslations(
            String workflowName,
            Integer workflowVersion,
            String search,
            int page,
            int size,
            String sortBy,
            String sortOrder) {
        PageResult<WorkflowTranslationModel> pageResult =
                translationDAO.search(workflowName, workflowVersion, search, page, size, sortBy, sortOrder);

        PageResult<WorkflowTranslationDto> dtoPage =
                new PageResult<>(
                        pageResult.getContent().stream().map(WorkflowTranslationDto::fromModel).toList(),
                        pageResult.getPagination());

        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Workflow translations fetched successfully")
                .data(dtoPage)
                .build();
    }

    public ApiResponse getTranslationsMap(String workflowName, Integer version) {
        Map<String, Map<String, String>> translations = cacheService.getTranslations(workflowName, version);
        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Workflow translations map fetched successfully")
                .data(translations)
                .build();
    }

    public ApiResponse getById(UUID id) {
        WorkflowTranslationModel wt =
                translationDAO
                        .findById(id)
                        .orElseThrow(() -> ExceptionUtils.throwNotFound("Translation not found with id: " + id));

        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Translation fetched successfully")
                .data(WorkflowTranslationDto.fromModel(wt))
                .build();
    }

    public ApiResponse createTranslation(WorkflowTranslationDto dto) {
        validateTranslationPayload(dto);

        if (translationDAO.existsByWorkflowNameVersionAndMessageCode(
                dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode())) {
            throw ExceptionUtils.throwAlreadyExist(
                    String.format(
                            "Translation already exists for workflow '%s', version %d, and message code '%s'",
                            dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode()));
        }

        WorkflowTranslationModel model = dto.toModel();
        WorkflowTranslationModel saved = translationDAO.create(model);
        cacheService.updateWorkflowCache(saved.getWorkflowName(), saved.getWorkflowVersion());

        return ApiResponse.builder()
                .status(HttpStatus.CREATED)
                .message("Workflow translation created successfully")
                .data(WorkflowTranslationDto.fromModel(saved))
                .build();
    }

    public ApiResponse updateTranslation(UUID id, WorkflowTranslationDto dto) {
        validateTranslationPayload(dto);

        WorkflowTranslationModel existing =
                translationDAO
                        .findById(id)
                        .orElseThrow(() -> ExceptionUtils.throwNotFound("Translation not found with id: " + id));

        boolean conflict =
                translationDAO.existsByWorkflowNameVersionAndMessageCode(
                        dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode());
        if (conflict
                && (!existing.getWorkflowName().equalsIgnoreCase(dto.getWorkflowName())
                        || !existing.getWorkflowVersion().equals(dto.getWorkflowVersion())
                        || !existing.getMessageCode().equals(dto.getMessageCode()))) {
            throw ExceptionUtils.throwAlreadyExist(
                    String.format(
                            "Translation already exists for workflow '%s', version %d, and message code '%s'",
                            dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode()));
        }

        existing.setWorkflowName(dto.getWorkflowName());
        existing.setWorkflowVersion(dto.getWorkflowVersion());
        existing.setMessageCode(dto.getMessageCode());
        existing.setTranslations(dto.getTranslations());

        WorkflowTranslationModel updated = translationDAO.update(existing);
        cacheService.updateWorkflowCache(updated.getWorkflowName(), updated.getWorkflowVersion());

        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Workflow translation updated successfully")
                .data(WorkflowTranslationDto.fromModel(updated))
                .build();
    }

    public ApiResponse deleteTranslation(UUID id) {
        WorkflowTranslationModel wt =
                translationDAO
                        .findById(id)
                        .orElseThrow(() -> ExceptionUtils.throwNotFound("Translation not found with id: " + id));

        translationDAO.deleteById(id);
        cacheService.updateWorkflowCache(wt.getWorkflowName(), wt.getWorkflowVersion());

        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Workflow translation deleted successfully")
                .data(null)
                .build();
    }

    public ApiResponse reloadCache() {
        cacheService.loadAllTranslationsToCache();
        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Workflow translations cache reloaded successfully")
                .data(null)
                .build();
    }

    private void validateTranslationPayload(WorkflowTranslationDto dto) {
        if (dto.getTranslations() == null || dto.getTranslations().isEmpty()) {
            throw ExceptionUtils.throwBadInputs("Translations map cannot be empty", "Provide at least one language translation");
        }
        boolean hasValid = dto.getTranslations().values().stream().anyMatch(v -> v != null && !v.isBlank());
        if (!hasValid) {
            throw ExceptionUtils.throwBadInputs("Translations map must contain at least one non-blank message", "All translation values were blank");
        }
    }
}

