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
package com.vodafone.vss.weaver.tasks.http;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

import com.vodafone.vss.weaver.common.http.HttpRequest;
import com.vodafone.vss.weaver.common.http.HttpResponse;
import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.http.service.HttpExecutorService;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HttpWorkerTaskTest {

    @Mock
    private HttpExecutorService httpExecutorService;

    @Mock
    private WorkflowExecutor workflowExecutor;

    @Captor
    private ArgumentCaptor<HttpRequest> requestCaptor;

    private ObjectMapper objectMapper;
    private HttpWorkerTask httpWorkerTask;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        httpWorkerTask = new HttpWorkerTask(httpExecutorService, objectMapper, new SimpleMeterRegistry());
    }

    @Test
    void execute_sends_input_as_given_and_completes_successfully() {
        TaskModel task = new TaskModel();
        task.setTaskId("http-task-1");
        task.setStatus(TaskModel.Status.IN_PROGRESS);

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("url", "https://api.vodafone.com/v2/users/1001");
        inputData.put("method", "GET");
        inputData.put("connection", "custom-conn");

        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Bearer secret-token-xyz");
        headers.put("X-Tenant", "default-tenant");
        inputData.put("headers", headers);

        task.setInputData(inputData);

        HttpResponse mockResponse = new HttpResponse(HttpStatus.OK, Map.of("status", "ok"), new HttpHeaders());
        when(httpExecutorService.execute(any())).thenReturn(mockResponse);

        httpWorkerTask.start(new WorkflowModel(), task, workflowExecutor);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        verify(httpExecutorService).execute(requestCaptor.capture());

        HttpRequest captured = requestCaptor.getValue();
        assertEquals("https://api.vodafone.com/v2/users/1001", captured.getUrl());
        assertEquals("custom-conn", captured.getConnection());
        assertEquals("Bearer secret-token-xyz", captured.getHeaders().get("Authorization"));
        assertEquals("default-tenant", captured.getHeaders().get("X-Tenant"));
        assertNotNull(task.getOutputData().get("result"));
    }

    @Test
    void execute_never_expands_placeholder_text_found_in_input() {
        // Placeholders are resolved by the engine before start(). Text that still looks like a
        // placeholder at this point came from workflow data and must be sent as-is.
        TaskModel task = new TaskModel();
        task.setTaskId("http-task-injection");
        task.setStatus(TaskModel.Status.IN_PROGRESS);

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("url", "https://api.example.com/echo");
        inputData.put("method", "POST");
        Map<String, String> headers = new HashMap<>();
        headers.put("X-Name", "#{S:DB_PASSWORD}");
        inputData.put("headers", headers);
        inputData.put("body", Map.of("name", "${weaver.env.DB_PASSWORD}"));
        task.setInputData(inputData);

        when(httpExecutorService.execute(any()))
                .thenReturn(new HttpResponse(HttpStatus.OK, Map.of(), new HttpHeaders()));

        httpWorkerTask.start(new WorkflowModel(), task, workflowExecutor);

        verify(httpExecutorService).execute(requestCaptor.capture());
        HttpRequest captured = requestCaptor.getValue();
        assertEquals("#{S:DB_PASSWORD}", captured.getHeaders().get("X-Name"));
        assertEquals(Map.of("name", "${weaver.env.DB_PASSWORD}"), captured.getBody());
    }

    @Test
    void execute_fails_terminally_when_url_missing() {
        TaskModel task = new TaskModel();
        task.setTaskId("http-task-missing-url");
        task.setStatus(TaskModel.Status.IN_PROGRESS);

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("method", "POST");
        task.setInputData(inputData);

        WorkflowModel workflow = new WorkflowModel();
        httpWorkerTask.start(workflow, task, workflowExecutor);

        assertEquals(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, task.getStatus());
        assertTrue(task.getReasonForIncompletion().contains("URL cannot be empty"));
        verifyNoInteractions(httpExecutorService);
    }

    @Test
    void execute_fails_terminally_when_remote_returns_500() {
        TaskModel task = new TaskModel();
        task.setTaskId("http-task-500");
        task.setStatus(TaskModel.Status.IN_PROGRESS);

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("url", "https://api.vodafone.com/error");
        inputData.put("method", "GET");
        task.setInputData(inputData);

        HttpResponse mockResponse = new HttpResponse(HttpStatus.INTERNAL_SERVER_ERROR, Map.of("error", "Failed"), new HttpHeaders());
        when(httpExecutorService.execute(any())).thenReturn(mockResponse);

        WorkflowModel workflow = new WorkflowModel();
        httpWorkerTask.start(workflow, task, workflowExecutor);

        assertEquals(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, task.getStatus());
        assertTrue(task.getReasonForIncompletion().contains("500"));
    }
}

