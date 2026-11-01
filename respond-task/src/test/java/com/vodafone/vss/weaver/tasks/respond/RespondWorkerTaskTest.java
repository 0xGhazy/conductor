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
package com.vodafone.vss.weaver.tasks.respond;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.respond.service.WorkflowTranslationCacheService;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

class RespondWorkerTaskTest {

    private WorkflowTranslationCacheService cacheService;
    private ObjectMapper objectMapper;
    private RespondWorkerTask respondWorkerTask;

    @BeforeEach
    void setUp() {
        cacheService = Mockito.mock(WorkflowTranslationCacheService.class);
        objectMapper = new ObjectMapper();
        respondWorkerTask = new RespondWorkerTask(cacheService, objectMapper);
    }

    @Test
    void testSuccessfulTranslationResolutionWithVariables() {
        WorkflowModel workflow = new WorkflowModel();
        WorkflowDef def = new WorkflowDef();
        def.setName("order_flow");
        def.setVersion(1);
        workflow.setWorkflowDefinition(def);
        workflow.setInput(Map.of("_language", "ar", "customerName", "Ahmed"));

        TaskModel task = new TaskModel();
        task.setTaskId("t1");
        Map<String, Object> inputData = new HashMap<>();
        inputData.put("messageCode", "ORDER_SUCCESS");
        inputData.put("languageCode", "ar");
        inputData.put("variables", Map.of("orderId", "12345"));
        task.setInputData(inputData);

        Map<String, Map<String, String>> translations =
                Map.of("ORDER_SUCCESS", Map.of("ar", "تم إنشاء طلبك رقم ${variables.orderId} بنجاح يا ${input.customerName}", "en", "Your order ${variables.orderId} created successfully"));
        when(cacheService.getTranslations("order_flow", 1)).thenReturn(translations);

        respondWorkerTask.start(workflow, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertEquals("ORDER_SUCCESS", task.getOutputData().get("responseCode"));
        assertEquals("ar", task.getOutputData().get("languageCode"));
        assertEquals("تم إنشاء طلبك رقم 12345 بنجاح يا Ahmed", task.getOutputData().get("message"));
    }

    @Test
    void testFallbackToDefaultLanguageWhenRequestedLanguageNotFound() {
        WorkflowModel workflow = new WorkflowModel();
        WorkflowDef def = new WorkflowDef();
        def.setName("order_flow");
        def.setVersion(1);
        workflow.setWorkflowDefinition(def);

        TaskModel task = new TaskModel();
        task.setTaskId("t2");
        Map<String, Object> inputData = new HashMap<>();
        inputData.put("messageCode", "WELCOME");
        inputData.put("languageCode", "fr"); // fr not in translations
        task.setInputData(inputData);

        Map<String, Map<String, String>> translations =
                Map.of("WELCOME", Map.of("default", "Welcome to Weaver!", "ar", "أهلاً بك"));
        when(cacheService.getTranslations("order_flow", 1)).thenReturn(translations);

        respondWorkerTask.start(workflow, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertEquals("WELCOME", task.getOutputData().get("responseCode"));
        assertEquals("default", task.getOutputData().get("languageCode"));
        assertEquals("Welcome to Weaver!", task.getOutputData().get("message"));
    }

    @Test
    void testFallbackToMessageCodeWhenNoTranslationFound() {
        WorkflowModel workflow = new WorkflowModel();
        WorkflowDef def = new WorkflowDef();
        def.setName("order_flow");
        def.setVersion(1);
        workflow.setWorkflowDefinition(def);

        TaskModel task = new TaskModel();
        task.setTaskId("t3");
        Map<String, Object> inputData = new HashMap<>();
        inputData.put("messageCode", "NOT_FOUND_CODE");
        task.setInputData(inputData);

        when(cacheService.getTranslations("order_flow", 1)).thenReturn(Map.of());

        respondWorkerTask.start(workflow, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertEquals("NOT_FOUND_CODE", task.getOutputData().get("responseCode"));
        assertEquals("NOT_FOUND_CODE", task.getOutputData().get("message"));
    }
}
