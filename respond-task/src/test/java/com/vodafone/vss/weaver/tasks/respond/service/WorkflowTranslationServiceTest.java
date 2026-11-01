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
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;

import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationDto;
import com.vodafone.vss.weaver.common.respond.WorkflowTranslationModel;
import com.vodafone.vss.weaver.common.response.ApiResponse;
import com.vodafone.vss.weaver.dao.WorkflowTranslationDAO;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WorkflowTranslationServiceTest {

    private WorkflowTranslationDAO translationDAO;
    private WorkflowTranslationCacheService cacheService;
    private WorkflowTranslationService service;

    @BeforeEach
    void setUp() {
        translationDAO = Mockito.mock(WorkflowTranslationDAO.class);
        cacheService = Mockito.mock(WorkflowTranslationCacheService.class);
        service = new WorkflowTranslationService(translationDAO, cacheService);
    }

    @Test
    void testCreateTranslationSuccess() {
        WorkflowTranslationDto dto =
                WorkflowTranslationDto.builder()
                        .workflowName("checkout")
                        .workflowVersion(1)
                        .messageCode("SUCCESS")
                        .translations(Map.of("en", "Order placed"))
                        .build();

        when(translationDAO.existsByWorkflowNameVersionAndMessageCode("checkout", 1, "SUCCESS"))
                .thenReturn(false);

        WorkflowTranslationModel savedModel = dto.toModel();
        savedModel.setId(UUID.randomUUID());
        when(translationDAO.create(any(WorkflowTranslationModel.class))).thenReturn(savedModel);

        ApiResponse response = service.createTranslation(dto);

        assertEquals(HttpStatus.CREATED, response.getStatus());
        assertNotNull(response.getData());
        verify(cacheService).updateWorkflowCache("checkout", 1);
    }

    @Test
    void testGetByIdNotFoundThrows() {
        UUID id = UUID.randomUUID();
        when(translationDAO.findById(id)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> service.getById(id));
    }
}
