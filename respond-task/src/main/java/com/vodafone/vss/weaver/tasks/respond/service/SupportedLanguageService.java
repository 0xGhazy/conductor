package com.vodafone.vss.weaver.tasks.respond.service;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.language.SupportedLanguageDto;
import com.vodafone.vss.weaver.common.language.SupportedLanguageModel;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.dao.SupportedLanguageDAO;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
@RequiredArgsConstructor
public class SupportedLanguageService {

    private final SupportedLanguageDAO dao;

    @PostConstruct
    public void initDefaults() {
        try {
            if (dao.count() == 0) {
                log.info("No supported languages found in database. Initializing defaults ('en' and 'ar')...");
                dao.create(
                        SupportedLanguageModel.builder()
                                .code("en")
                                .name("English")
                                .nativeName("English")
                                .rtl(false)
                                .isDefault(true)
                                .build());
                dao.create(
                        SupportedLanguageModel.builder()
                                .code("ar")
                                .name("Arabic")
                                .nativeName("العربية")
                                .rtl(true)
                                .isDefault(false)
                                .build());
                log.info("Default supported languages initialized successfully.");
            }
        } catch (Exception e) {
            log.warn("Could not seed default supported languages: {}", e.getMessage());
        }
    }

    public ApiResponse getAllLanguages() {
        List<SupportedLanguageDto> list =
                dao.findAll().stream().map(SupportedLanguageDto::fromModel).toList();
        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Supported languages fetched successfully")
                .data(list)
                .build();
    }

    public ApiResponse getLanguageById(UUID id) {
        SupportedLanguageModel language =
                dao.findById(id)
                        .orElseThrow(
                                () ->
                                        ExceptionUtils.throwNotFound(
                                                "Supported language not found with id: " + id));
        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Supported language fetched successfully")
                .data(SupportedLanguageDto.fromModel(language))
                .build();
    }

    public ApiResponse createLanguage(SupportedLanguageDto dto) {
        if (dto == null || dto.getCode() == null || dto.getCode().isBlank()) {
            throw ExceptionUtils.throwBadInputs(
                    "Language code cannot be empty", "Invalid language payload");
        }
        String normalizedCode = dto.getCode().trim().toLowerCase();

        if (dao.findByCode(normalizedCode).isPresent()) {
            throw ExceptionUtils.throwAlreadyExist(
                    "Supported language already exists with code: " + normalizedCode);
        }

        if (dto.isDefault()) {
            dao.clearDefaultFlagExcept(null);
        }

        SupportedLanguageModel model =
                SupportedLanguageModel.builder()
                        .code(normalizedCode)
                        .name(
                                dto.getName() != null
                                        ? dto.getName().trim()
                                        : normalizedCode.toUpperCase())
                        .nativeName(dto.getNativeName() != null ? dto.getNativeName().trim() : null)
                        .rtl(dto.isRtl())
                        .isDefault(dto.isDefault())
                        .build();

        SupportedLanguageModel saved = dao.create(model);
        log.info("Created supported language: code={}, name={}", saved.getCode(), saved.getName());

        return ApiResponse.builder()
                .status(HttpStatus.CREATED)
                .message("Supported language created successfully")
                .data(SupportedLanguageDto.fromModel(saved))
                .build();
    }

    public ApiResponse updateLanguage(UUID id, SupportedLanguageDto dto) {
        SupportedLanguageModel model =
                dao.findById(id)
                        .orElseThrow(
                                () ->
                                        ExceptionUtils.throwNotFound(
                                                "Supported language not found with id: " + id));

        if (dto.getName() != null && !dto.getName().isBlank()) {
            model.setName(dto.getName().trim());
        }
        if (dto.getNativeName() != null) {
            model.setNativeName(dto.getNativeName().trim());
        }
        model.setRtl(dto.isRtl());

        if (dto.isDefault() && !model.isDefault()) {
            dao.clearDefaultFlagExcept(model.getId());
            model.setDefault(true);
        } else if (!dto.isDefault() && model.isDefault()) {
            model.setDefault(false);
        }

        SupportedLanguageModel saved = dao.update(model);
        log.info("Updated supported language: id={}, code={}", saved.getId(), saved.getCode());

        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Supported language updated successfully")
                .data(SupportedLanguageDto.fromModel(saved))
                .build();
    }

    public ApiResponse deleteLanguage(UUID id) {
        SupportedLanguageModel model =
                dao.findById(id)
                        .orElseThrow(
                                () ->
                                        ExceptionUtils.throwNotFound(
                                                "Supported language not found with id: " + id));

        if (model.isDefault()) {
            throw ExceptionUtils.throwBadInputs(
                    "Cannot delete the default supported language. Please set another language as default first.",
                    "Operation not allowed");
        }

        dao.deleteById(id);
        log.info("Deleted supported language: id={}, code={}", id, model.getCode());

        return ApiResponse.builder()
                .status(HttpStatus.OK)
                .message("Supported language deleted successfully")
                .data(SupportedLanguageDto.fromModel(model))
                .build();
    }
}

