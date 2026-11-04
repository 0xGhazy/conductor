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

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.language.SupportedLanguageModel;
import com.vodafone.vss.weaver.common.respond.TranslationModel;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationDto;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationModel;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.common.response.PageResult;
import com.vodafone.vss.weaver.core.exception.ConflictException;
import com.vodafone.vss.weaver.dao.SupportedLanguageDAO;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;

import lombok.RequiredArgsConstructor;

/**
 * Manages workflow message translations.
 *
 * <p>The API works with <em>messages</em>: all languages of one message code for one workflow
 * version, as a {@code {language: text}} map. The table stores one row per language; this service
 * converts between the two. A message is identified by (workflow name, version, message code);
 * the API's {@code id} is the id of the message's earliest row, kept for existing clients.
 */
@Service
@RequiredArgsConstructor
public class WorkflowTranslationService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowTranslationService.class);

    private final WorkflowTranslationDAO translationDAO;
    private final WorkflowTranslationCacheService cacheService;
    private final SupportedLanguageDAO languageDAO;

    public ApiResponse searchTranslations(
            String workflowName,
            Integer workflowVersion,
            String search,
            int page,
            int size,
            String sortBy,
            String sortOrder) {
        PageResult<WorkflowTranslationModel> pageResult =
                translationDAO.searchMessages(
                        workflowName, workflowVersion, search, page, size, sortBy, sortOrder);

        PageResult<WorkflowTranslationDto> dtoPage =
                new PageResult<>(
                        pageResult.getContent().stream().map(WorkflowTranslationDto::fromModel).toList(),
                        pageResult.getPagination());

        return ok("Workflow translations fetched successfully", dtoPage);
    }

    public ApiResponse getTranslationsMap(String workflowName, Integer version) {
        return ok(
                "Workflow translations map fetched successfully",
                cacheService.getTranslations(workflowName, version));
    }

    public ApiResponse getById(UUID id) {
        return ok("Translation fetched successfully", WorkflowTranslationDto.fromModel(findMessageByRowId(id)));
    }

    public ApiResponse createTranslation(WorkflowTranslationDto dto, UUID actorId) {
        requireIdentity(dto);
        Map<String, String> messages = normalizeMessages(dto.getTranslations());

        if (translationDAO.messageExists(dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode())) {
            throw alreadyExists(dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode());
        }
        save(dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode(), messages, actorId);
        log.info(
                "Created translation workflow={} v{} code={} languages={}",
                dto.getWorkflowName(),
                dto.getWorkflowVersion(),
                dto.getMessageCode(),
                messages.keySet());

        return ApiResponse.builder()
                .status(HttpStatus.CREATED)
                .message("Workflow translation created successfully")
                .data(WorkflowTranslationDto.fromModel(
                        loadMessage(dto.getWorkflowName(), dto.getWorkflowVersion(), dto.getMessageCode())))
                .build();
    }

    /**
     * Replaces the languages of the message that row {@code id} belongs to. Workflow name,
     * version and message code identify the message and cannot be changed; to move a message,
     * delete it and create it again.
     */
    public ApiResponse updateTranslation(UUID id, WorkflowTranslationDto dto, UUID actorId) {
        WorkflowTranslationModel existing = findMessageByRowId(id);
        rejectIdentityChange(existing, dto);
        return updateMessage(
                existing.getWorkflowName(),
                existing.getWorkflowVersion(),
                existing.getMessageCode(),
                dto,
                actorId);
    }

    /** Replaces the languages of the message identified by its natural key. */
    public ApiResponse updateMessage(
            String workflowName, int workflowVersion, String messageCode, WorkflowTranslationDto dto, UUID actorId) {
        if (!translationDAO.messageExists(workflowName, workflowVersion, messageCode)) {
            throw notFound(workflowName, workflowVersion, messageCode);
        }
        Map<String, String> messages = normalizeMessages(dto.getTranslations());
        save(workflowName, workflowVersion, messageCode, messages, actorId);
        log.info(
                "Updated translation workflow={} v{} code={} languages={}",
                workflowName,
                workflowVersion,
                messageCode,
                messages.keySet());

        return ok(
                "Workflow translation updated successfully",
                WorkflowTranslationDto.fromModel(loadMessage(workflowName, workflowVersion, messageCode)));
    }

    /** Deletes every language of the message that row {@code id} belongs to. */
    public ApiResponse deleteTranslation(UUID id) {
        WorkflowTranslationModel existing = findMessageByRowId(id);
        return deleteMessage(existing.getWorkflowName(), existing.getWorkflowVersion(), existing.getMessageCode());
    }

    public ApiResponse deleteMessage(String workflowName, int workflowVersion, String messageCode) {
        int deleted = translationDAO.deleteMessage(workflowName, workflowVersion, messageCode);
        if (deleted == 0) {
            throw notFound(workflowName, workflowVersion, messageCode);
        }
        cacheService.updateWorkflowCache(workflowName, workflowVersion);
        log.info("Deleted translation workflow={} v{} code={} ({} languages)", workflowName, workflowVersion, messageCode, deleted);
        return ok("Workflow translation deleted successfully", null);
    }

    public ApiResponse reloadCache() {
        cacheService.loadAllTranslationsToCache();
        return ok("Workflow translations cache reloaded successfully on this node", null);
    }

    // ---------------------------------------------------------------------------------------

    private void save(String workflowName, int workflowVersion, String messageCode, Map<String, String> messages, UUID actorId) {
        try {
            translationDAO.saveMessage(workflowName, workflowVersion, messageCode, messages, actorId);
        } catch (ConflictException e) {
            // Another request created the same message between our check and the insert.
            throw alreadyExists(workflowName, workflowVersion, messageCode);
        }
        cacheService.updateWorkflowCache(workflowName, workflowVersion);
    }

    private WorkflowTranslationModel findMessageByRowId(UUID id) {
        TranslationModel row =
                translationDAO
                        .findById(id)
                        .orElseThrow(() -> ExceptionUtils.throwNotFound("Translation not found with id: " + id));
        return loadMessage(row.getWorkflowName(), row.getWorkflowVersion(), row.getMessageCode());
    }

    /** Groups the rows of one message into the API shape. */
    private WorkflowTranslationModel loadMessage(String workflowName, int workflowVersion, String messageCode) {
        List<TranslationModel> rows = translationDAO.findByMessage(workflowName, workflowVersion, messageCode);
        if (rows.isEmpty()) {
            throw notFound(workflowName, workflowVersion, messageCode);
        }
        return toMessage(rows);
    }

    static WorkflowTranslationModel toMessage(List<TranslationModel> rows) {
        Comparator<TranslationModel> byCreated =
                Comparator.comparing(TranslationModel::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(r -> r.getId().toString());
        Comparator<TranslationModel> byUpdated =
                Comparator.comparing(TranslationModel::getUpdatedAt, Comparator.nullsFirst(Comparator.naturalOrder()));

        TranslationModel first = rows.stream().min(byCreated).orElseThrow();
        TranslationModel lastUpdated = rows.stream().max(byUpdated).orElseThrow();

        Map<String, String> translations = new LinkedHashMap<>();
        rows.forEach(r -> translations.put(r.getLanguageCode(), r.getMessage()));

        Instant updatedAt = lastUpdated.getUpdatedAt();
        return WorkflowTranslationModel.builder()
                .id(first.getId())
                .workflowName(first.getWorkflowName())
                .workflowVersion(first.getWorkflowVersion())
                .messageCode(first.getMessageCode())
                .translations(translations)
                .createdAt(first.getCreatedAt())
                .updatedAt(updatedAt)
                .createdBy(first.getCreatedBy())
                .updatedBy(lastUpdated.getUpdatedBy())
                .build();
    }

    /**
     * Drops blank texts and maps every language key to the code stored in {@code
     * supported_languages}, matched case-insensitively (e.g. {@code en-us} becomes {@code en-US}).
     * Unknown or duplicate languages are rejected with the list of offending keys.
     */
    Map<String, String> normalizeMessages(Map<String, String> input) {
        if (input == null || input.isEmpty()) {
            throw ExceptionUtils.throwBadInputs(
                    "Translations map cannot be empty", "Provide at least one language translation");
        }
        Map<String, String> knownCodes = new HashMap<>();
        for (SupportedLanguageModel language : languageDAO.findAll()) {
            knownCodes.put(language.getCode().toLowerCase(), language.getCode());
        }

        Map<String, String> result = new LinkedHashMap<>();
        List<String> unknown = new ArrayList<>();
        List<String> duplicates = new ArrayList<>();
        for (Map.Entry<String, String> entry : input.entrySet()) {
            String text = entry.getValue();
            if (text == null || text.isBlank()) {
                continue;
            }
            String key = entry.getKey() == null ? "" : entry.getKey().trim();
            String code = knownCodes.get(key.toLowerCase());
            if (code == null) {
                unknown.add(entry.getKey());
            } else if (result.containsKey(code)) {
                duplicates.add(entry.getKey());
            } else {
                result.put(code, text);
            }
        }
        if (!unknown.isEmpty()) {
            throw ExceptionUtils.throwBadInputs(
                    "Unsupported language code(s): " + String.join(", ", unknown),
                    "Add the language under Settings > Supported Languages first");
        }
        if (!duplicates.isEmpty()) {
            throw ExceptionUtils.throwBadInputs(
                    "Language given more than once: " + String.join(", ", duplicates),
                    "Each language may appear only once");
        }
        if (result.isEmpty()) {
            throw ExceptionUtils.throwBadInputs(
                    "Translations map must contain at least one non-blank message",
                    "All translation values were blank");
        }
        return result;
    }

    private static void requireIdentity(WorkflowTranslationDto dto) {
        if (dto.getWorkflowName() == null || dto.getWorkflowName().isBlank()
                || dto.getWorkflowVersion() == null || dto.getWorkflowVersion() < 1
                || dto.getMessageCode() == null || dto.getMessageCode().isBlank()) {
            throw ExceptionUtils.throwBadInputs(
                    "workflowName, workflowVersion (>= 1) and messageCode are required", "Invalid translation payload");
        }
    }

    private static void rejectIdentityChange(WorkflowTranslationModel existing, WorkflowTranslationDto dto) {
        boolean changed =
                (dto.getWorkflowName() != null && !dto.getWorkflowName().equals(existing.getWorkflowName()))
                        || (dto.getWorkflowVersion() != null
                                && !Objects.equals(dto.getWorkflowVersion(), existing.getWorkflowVersion()))
                        || (dto.getMessageCode() != null && !dto.getMessageCode().equals(existing.getMessageCode()));
        if (changed) {
            throw ExceptionUtils.throwBadInputs(
                    "workflowName, workflowVersion and messageCode cannot be changed",
                    "Delete the translation and create it again under the new name");
        }
    }

    private static RuntimeException alreadyExists(String workflowName, int workflowVersion, String messageCode) {
        return ExceptionUtils.throwAlreadyExist(String.format(
                "Translation already exists for workflow '%s', version %d, and message code '%s'",
                workflowName, workflowVersion, messageCode));
    }

    private static RuntimeException notFound(String workflowName, int workflowVersion, String messageCode) {
        return ExceptionUtils.throwNotFound(String.format(
                "Translation not found for workflow '%s', version %d, message code '%s'",
                workflowName, workflowVersion, messageCode));
    }

    private static ApiResponse ok(String message, Object data) {
        return ApiResponse.builder().status(HttpStatus.OK).message(message).data(data).build();
    }
}
