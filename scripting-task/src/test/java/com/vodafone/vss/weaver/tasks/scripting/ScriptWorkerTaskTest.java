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
package com.vodafone.vss.weaver.tasks.scripting;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskDto;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;
import com.vodafone.vss.weaver.tasks.scripting.service.ScriptExecutorService;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptWorkerTaskTest {

    @Mock
    private ScriptExecutorService scriptExecutorService;

    @Mock
    private ScriptMetricsService scriptMetricsService;

    @Captor
    private ArgumentCaptor<ScriptEngineTaskDto> taskDtoCaptor;

    private ObjectMapper objectMapper;
    private ScriptWorkerTask scriptWorkerTask;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        scriptWorkerTask = new ScriptWorkerTask(scriptExecutorService, objectMapper, scriptMetricsService);
    }

    @Test
    void isAsync_returnsFalse() {
        assertFalse(scriptWorkerTask.isAsync());
    }

    @Test
    void start_passes_variables_through_and_executes_successfully() {
        // Input arrives already resolved by the engine; placeholder-looking text from workflow
        // data (the "name" variable) must reach the script unchanged.

        TaskModel task = new TaskModel();
        task.setStatus(TaskModel.Status.IN_PROGRESS);
        task.setTaskId("script-task-1");

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("language", "JEXL");
        inputData.put("script", "x * mult");

        Map<String, Object> variables = new HashMap<>();
        variables.put("x", 10);
        variables.put("mult", "5");
        variables.put("name", "#{S:DB_PASSWORD}");
        inputData.put("variables", variables);

        task.setInputData(inputData);

        ScriptEngineTaskResult mockResult = ScriptEngineTaskResult.builder()
                .status("SUCCESS")
                .code("SCRIPT_EXECUTED")
                .output(50)
                .executionTime(10L)
                .build();
        when(scriptExecutorService.executeScript(any())).thenReturn(mockResult);

        scriptWorkerTask.start(null, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        verify(scriptExecutorService).executeScript(taskDtoCaptor.capture());

        ScriptEngineTaskDto captured = taskDtoCaptor.getValue();
        assertEquals(Languages.JEXL, captured.getLanguage());
        assertEquals("5", captured.getVariables().get("mult"));
        assertEquals("#{S:DB_PASSWORD}", captured.getVariables().get("name"));
    }

    @Test
    void start_fails_when_script_is_missing() {
        TaskModel task = new TaskModel();
        task.setTaskId("script-task-empty");

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("language", "JEXL");
        task.setInputData(inputData);

        scriptWorkerTask.start(null, task, null);

        assertEquals(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, task.getStatus());
        assertEquals("script is required", task.getReasonForIncompletion());
    }
}

