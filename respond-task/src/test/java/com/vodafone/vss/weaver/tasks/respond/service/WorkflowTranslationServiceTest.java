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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;

import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.common.language.SupportedLanguageModel;
import com.vodafone.vss.weaver.common.respond.TranslationModel;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationDto;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.core.exception.ConflictException;
import com.vodafone.vss.weaver.dao.SupportedLanguageDAO;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WorkflowTranslationServiceTest {

    private static final UUID ACTOR = UUID.randomUUID();

    private WorkflowTranslationDAO translationDAO;
    private WorkflowTranslationCacheService cacheService;
    private WorkflowTranslationService service;

    @BeforeEach
    void setUp() {
        translationDAO = Mockito.mock(WorkflowTranslationDAO.class);
        cacheService = Mockito.mock(WorkflowTranslationCacheService.class);
        SupportedLanguageDAO languageDAO = Mockito.mock(SupportedLanguageDAO.class);
        when(languageDAO.findAll())
                .thenReturn(List.of(language("en-US"), language("ar-EG")));
        service = new WorkflowTranslationService(translationDAO, cacheService, languageDAO);
    }

    @Test
    void createSavesNormalizedLanguagesAndRefreshesCache() {
        when(translationDAO.messageExists("checkout", 1, "SUCCESS")).thenReturn(false);
        when(translationDAO.findByMessage("checkout", 1, "SUCCESS"))
                .thenReturn(List.of(row("en-US", "Order placed"), row("ar-EG", "تم الطلب")));

        Map<String, String> input = new LinkedHashMap<>();
        input.put("en-us", "Order placed"); // wrong case, mapped to the stored code
        input.put("ar-EG", "تم الطلب");
        input.put("en-US-blank", null); // blank values are dropped before validation
        ApiResponse response = service.createTranslation(dto(input), ACTOR);

        assertEquals(HttpStatus.CREATED, response.getStatus());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> saved = ArgumentCaptor.forClass(Map.class);
        verify(translationDAO).saveMessage(eq("checkout"), eq(1), eq("SUCCESS"), saved.capture(), eq(ACTOR));
        assertEquals(Map.of("en-US", "Order placed", "ar-EG", "تم الطلب"), saved.getValue());
        verify(cacheService).updateWorkflowCache("checkout", 1);
    }

    @Test
    void createRejectsUnknownLanguage() {
        BusinessException e =
                assertThrows(
                        BusinessException.class,
                        () -> service.createTranslation(dto(Map.of("english", "Hi")), ACTOR));
        assertTrue(e.getMessage().contains("english"));
        verify(translationDAO, never()).saveMessage(anyString(), anyInt(), anyString(), anyMap(), any());
    }

    @Test
    void createRejectsAllBlankTexts() {
        Map<String, String> input = new HashMap<>();
        input.put("en-US", "   ");
        assertThrows(BusinessException.class, () -> service.createTranslation(dto(input), ACTOR));
    }

    @Test
    void createRejectsSameLanguageTwice() {
        Map<String, String> input = new LinkedHashMap<>();
        input.put("en-US", "A");
        input.put("EN-us", "B");
        assertThrows(BusinessException.class, () -> service.createTranslation(dto(input), ACTOR));
    }

    @Test
    void createReturnsAlreadyExistsWhenMessageExists() {
        when(translationDAO.messageExists("checkout", 1, "SUCCESS")).thenReturn(true);
        assertThrows(
                BusinessException.class,
                () -> service.createTranslation(dto(Map.of("en-US", "Hi")), ACTOR));
    }

    @Test
    void createReturnsAlreadyExistsOnConcurrentInsert() {
        when(translationDAO.messageExists("checkout", 1, "SUCCESS")).thenReturn(false);
        doThrow(new ConflictException("duplicate"))
                .when(translationDAO)
                .saveMessage(anyString(), anyInt(), anyString(), anyMap(), any());

        assertThrows(
                BusinessException.class,
                () -> service.createTranslation(dto(Map.of("en-US", "Hi")), ACTOR));
    }

    @Test
    void updateByIdReplacesLanguagesOfThatMessage() {
        TranslationModel existing = row("en-US", "Old");
        when(translationDAO.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(translationDAO.findByMessage("checkout", 1, "SUCCESS")).thenReturn(List.of(existing));
        when(translationDAO.messageExists("checkout", 1, "SUCCESS")).thenReturn(true);

        service.updateTranslation(existing.getId(), dto(Map.of("en-US", "New")), ACTOR);

        verify(translationDAO).saveMessage("checkout", 1, "SUCCESS", Map.of("en-US", "New"), ACTOR);
        verify(cacheService).updateWorkflowCache("checkout", 1);
    }

    @Test
    void updateRejectsChangingIdentity() {
        TranslationModel existing = row("en-US", "Old");
        when(translationDAO.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(translationDAO.findByMessage("checkout", 1, "SUCCESS")).thenReturn(List.of(existing));

        WorkflowTranslationDto moved = dto(Map.of("en-US", "New"));
        moved.setMessageCode("OTHER");

        assertThrows(BusinessException.class, () -> service.updateTranslation(existing.getId(), moved, ACTOR));
        verify(translationDAO, never()).saveMessage(anyString(), anyInt(), anyString(), anyMap(), any());
    }

    @Test
    void deleteByIdDeletesWholeMessage() {
        TranslationModel existing = row("en-US", "Hi");
        when(translationDAO.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(translationDAO.findByMessage("checkout", 1, "SUCCESS")).thenReturn(List.of(existing));
        when(translationDAO.deleteMessage("checkout", 1, "SUCCESS")).thenReturn(2);

        ApiResponse response = service.deleteTranslation(existing.getId());

        assertEquals(HttpStatus.OK, response.getStatus());
        verify(cacheService).updateWorkflowCache("checkout", 1);
    }

    @Test
    void deleteMissingMessageIsNotFound() {
        when(translationDAO.deleteMessage("checkout", 1, "NOPE")).thenReturn(0);
        assertThrows(BusinessException.class, () -> service.deleteMessage("checkout", 1, "NOPE"));
    }

    @Test
    void groupedMessageUsesEarliestRowIdAndLatestUpdate() {
        TranslationModel first = row("en-US", "Hi");
        first.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        first.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        TranslationModel second = row("ar-EG", "مرحبا");
        second.setCreatedAt(Instant.parse("2026-02-01T00:00:00Z"));
        second.setUpdatedAt(Instant.parse("2026-03-01T00:00:00Z"));
        second.setUpdatedBy(ACTOR);

        var message = WorkflowTranslationService.toMessage(List.of(second, first));

        assertEquals(first.getId(), message.getId());
        assertEquals(Map.of("en-US", "Hi", "ar-EG", "مرحبا"), message.getTranslations());
        assertEquals(Instant.parse("2026-03-01T00:00:00Z"), message.getUpdatedAt());
        assertEquals(ACTOR, message.getUpdatedBy());
    }

    private static WorkflowTranslationDto dto(Map<String, String> translations) {
        return WorkflowTranslationDto.builder()
                .workflowName("checkout")
                .workflowVersion(1)
                .messageCode("SUCCESS")
                .translations(translations)
                .build();
    }

    private static TranslationModel row(String language, String message) {
        return TranslationModel.builder()
                .id(UUID.randomUUID())
                .workflowName("checkout")
                .workflowVersion(1)
                .messageCode("SUCCESS")
                .languageCode(language)
                .message(message)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private static SupportedLanguageModel language(String code) {
        return SupportedLanguageModel.builder().id(UUID.randomUUID()).code(code).name(code).build();
    }
}
