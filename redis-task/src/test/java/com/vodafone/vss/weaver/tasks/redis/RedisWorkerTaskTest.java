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
package com.vodafone.vss.weaver.tasks.redis;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.env.MockEnvironment;

import com.vodafone.vss.weaver.common.VariableResolver;
import com.vodafone.vss.weaver.common.redis.RedisCommandRequestDto;
import com.vodafone.vss.weaver.common.redis.RedisCommandResponseDto;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.tasks.redis.service.RedisService;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisWorkerTaskTest {

    @Mock
    private RedisService redisService;

    @Captor
    private ArgumentCaptor<RedisCommandRequestDto> requestCaptor;

    private ObjectMapper objectMapper;
    private MockEnvironment environment;
    private VariableResolver variableResolver;
    private RedisWorkerTask redisWorkerTask;

    private final UUID datasourceId = UUID.fromString("11111111-2222-3333-4444-555555555555");

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        environment = new MockEnvironment();
        variableResolver = new VariableResolver(environment);
        redisWorkerTask = new RedisWorkerTask(redisService, objectMapper);
        redisWorkerTask.setVariableResolver(variableResolver);
    }

    @Test
    void isAsync_returnsFalse() {
        assertFalse(redisWorkerTask.isAsync());
    }

    @Test
    void start_resolves_key_value_field_and_hash_values() {
        environment.setProperty("app.user.id", "42");
        environment.setProperty("app.token", "bearer-token-123");

        TaskModel task = new TaskModel();
        task.setStatus(TaskModel.Status.IN_PROGRESS);
        task.setTaskId("redis-task-1");

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("action", "HSET");
        inputData.put("datasourceId", datasourceId.toString());
        inputData.put("key", "user:#{P:app.user.id}:session");
        inputData.put("field", "auth:#{ENV:prod}");
        inputData.put("value", "#{P:app.token}");

        Map<String, String> hashValues = new HashMap<>();
        hashValues.put("role", "#{ROLE:admin}");
        inputData.put("hashValues", hashValues);

        task.setInputData(inputData);

        RedisCommandResponseDto mockResponse = RedisCommandResponseDto.builder()
                .action("HSET")
                .success(true)
                .result("OK")
                .build();
        when(redisService.executeCommand(eq(datasourceId), any())).thenReturn(mockResponse);

        redisWorkerTask.start(null, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        verify(redisService).executeCommand(eq(datasourceId), requestCaptor.capture());

        RedisCommandRequestDto captured = requestCaptor.getValue();
        assertEquals("HSET", captured.getAction());
        assertEquals("user:42:session", captured.getKey());
        assertEquals("auth:prod", captured.getField());
        assertEquals("bearer-token-123", captured.getValue());
        assertEquals("admin", captured.getHashValues().get("role"));
    }

    @Test
    void start_resolves_keys_list() {
        environment.setProperty("prefix", "orders");

        TaskModel task = new TaskModel();
        task.setStatus(TaskModel.Status.IN_PROGRESS);
        task.setTaskId("redis-task-keys");

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("action", "DEL");
        inputData.put("datasourceId", datasourceId.toString());
        inputData.put("key", "dummyKey");
        inputData.put("keys", List.of("#{P:prefix}:101", "#{P:prefix}:#{ID2:102}"));
        task.setInputData(inputData);

        RedisCommandResponseDto mockResponse = RedisCommandResponseDto.builder()
                .action("DEL")
                .success(true)
                .result(2L)
                .build();
        when(redisService.executeCommand(eq(datasourceId), any())).thenReturn(mockResponse);

        redisWorkerTask.start(null, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        verify(redisService).executeCommand(eq(datasourceId), requestCaptor.capture());

        RedisCommandRequestDto captured = requestCaptor.getValue();
        assertEquals(List.of("orders:101", "orders:102"), captured.getKeys());
    }

    @Test
    void start_fails_when_action_is_missing() {
        TaskModel task = new TaskModel();
        task.setTaskId("task-missing-action");

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("datasourceId", datasourceId.toString());
        task.setInputData(inputData);

        redisWorkerTask.start(null, task, null);

        assertEquals(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, task.getStatus());
        assertNotNull(task.getReasonForIncompletion());
    }

    @Test
    void start_fails_when_datasource_is_missing() {
        TaskModel task = new TaskModel();
        task.setTaskId("task-missing-ds");

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("action", "GET");
        inputData.put("key", "myKey");
        task.setInputData(inputData);

        redisWorkerTask.start(null, task, null);

        assertEquals(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, task.getStatus());
        assertEquals("'datasourceId' or 'datasourceName' is required", task.getReasonForIncompletion());
    }
}

