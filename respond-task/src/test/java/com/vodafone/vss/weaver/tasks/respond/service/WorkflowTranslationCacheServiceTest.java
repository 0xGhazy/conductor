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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.vodafone.vss.weaver.common.respond.TranslationModel;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WorkflowTranslationCacheServiceTest {

    private WorkflowTranslationDAO dao;
    private WorkflowTranslationCacheService cache;

    @BeforeEach
    void setUp() {
        dao = Mockito.mock(WorkflowTranslationDAO.class);
        cache = new WorkflowTranslationCacheService(dao);
    }

    @Test
    void groupsRowsByMessageAndLanguage() {
        when(dao.findByWorkflow("wf", 1))
                .thenReturn(List.of(row("wf", "OK", "en-US", "Done"), row("wf", "OK", "ar-EG", "تم")));

        assertEquals(Map.of("OK", Map.of("en-US", "Done", "ar-EG", "تم")), cache.getTranslations("wf", 1));
    }

    @Test
    void emptyResultIsCached() {
        when(dao.findByWorkflow("none", 1)).thenReturn(List.of());

        assertTrue(cache.getTranslations("none", 1).isEmpty());
        assertTrue(cache.getTranslations("none", 1).isEmpty());
        verify(dao, times(1)).findByWorkflow("none", 1);
    }

    @Test
    void reloadDropsEntriesNoLongerInTheTable() {
        when(dao.findAll())
                .thenReturn(List.of(row("a", "M", "en-US", "x"), row("b", "M", "en-US", "y")));
        cache.loadAllTranslationsToCache();
        assertEquals(1, cache.getTranslations("b", 1).size());

        when(dao.findAll()).thenReturn(List.of(row("a", "M", "en-US", "x")));
        when(dao.findByWorkflow("b", 1)).thenReturn(List.of());
        cache.loadAllTranslationsToCache();

        assertTrue(cache.getTranslations("b", 1).isEmpty());
    }

    private static TranslationModel row(String workflow, String code, String language, String text) {
        return TranslationModel.builder()
                .id(UUID.randomUUID())
                .workflowName(workflow)
                .workflowVersion(1)
                .messageCode(code)
                .languageCode(language)
                .message(text)
                .build();
    }
}
