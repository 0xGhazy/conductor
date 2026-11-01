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
package com.vodafone.vss.weaver.tasks.scripting.service;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionRequest;
import com.vodafone.vss.weaver.common.scripting.ScriptDefinitionResponse;
import com.vodafone.vss.weaver.common.scripting.ScriptModel;
import com.vodafone.vss.weaver.dao.ScriptDAO;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptServiceTest {

    @Mock
    private ScriptDAO scriptDAO;

    private ScriptService scriptService;

    private final UUID scriptId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        scriptService = new ScriptService(scriptDAO);
    }

    @Test
    void findById_returnsScriptWhenFound() {
        ScriptModel model = ScriptModel.builder()
                .id(scriptId)
                .name("test-script")
                .script("x + 1")
                .language(Languages.JEXL)
                .build();

        when(scriptDAO.findById(scriptId)).thenReturn(Optional.of(model));

        ScriptDefinitionResponse response = scriptService.findById(scriptId);
        assertNotNull(response);
        assertEquals("test-script", response.name());
    }

    @Test
    void findById_throwsNotFoundWhenMissing() {
        when(scriptDAO.findById(scriptId)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> scriptService.findById(scriptId));
    }

    @Test
    void create_createsScriptSuccessfully() {
        ScriptDefinitionRequest request = ScriptDefinitionRequest.builder()
                .name("my-script")
                .script("x * 2")
                .language(Languages.JEXL)
                .build();

        when(scriptDAO.existsByName("my-script")).thenReturn(false);

        ScriptModel saved = ScriptModel.builder()
                .id(scriptId)
                .name("my-script")
                .script("x * 2")
                .language(Languages.JEXL)
                .build();
        when(scriptDAO.create(any())).thenReturn(saved);

        ScriptDefinitionResponse created = scriptService.create(request);
        assertNotNull(created);
        assertEquals("my-script", created.name());
    }

    @Test
    void delete_removesScript() {
        ScriptModel model = ScriptModel.builder().id(scriptId).name("to-delete").build();
        when(scriptDAO.findById(scriptId)).thenReturn(Optional.of(model));

        scriptService.delete(scriptId);

        verify(scriptDAO).deleteById(scriptId);
    }
}

