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

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.VariableResolver;
import com.vodafone.vss.weaver.common.http.HttpRequest;
import com.vodafone.vss.weaver.common.http.HttpResponse;
import com.vodafone.vss.weaver.common.http.HttpWorkerTaskDto;
import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.core.execution.tasks.WorkflowSystemTask;
import com.vodafone.vss.weaver.core.utils.Utils;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.http.service.HttpExecutorService;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * High-performance, in-process WorkflowSystemTask implementing the HttpWorker action.
 */
@Component("HttpWorker")
public class HttpWorkerTask extends WorkflowSystemTask {

    private static final Logger log = LoggerFactory.getLogger(HttpWorkerTask.class);
    public static final String TASK_TYPE = "HttpWorker";

    private final HttpExecutorService httpExecutorService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private VariableResolver variableResolver;

    @Autowired(required = false)
    private MeterRegistry meterRegistry;

    @Value("${weaver.default.http.request.timeout:3000}")
    private Integer defaultHttpRequestTimeoutMs = 3000;

    @Autowired
    public HttpWorkerTask(HttpExecutorService httpExecutorService, ObjectMapper objectMapper) {
        super(TASK_TYPE);
        this.httpExecutorService = httpExecutorService;
        this.objectMapper = objectMapper;
    }

    public HttpWorkerTask(
            HttpExecutorService httpExecutorService,
            ObjectMapper objectMapper,
            VariableResolver variableResolver,
            MeterRegistry meterRegistry) {
        super(TASK_TYPE);
        this.httpExecutorService = httpExecutorService;
        this.objectMapper = objectMapper;
        this.variableResolver = variableResolver;
        this.meterRegistry = meterRegistry;
    }

    @Override
    public void start(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        task.setWorkerId(Utils.getServerId());
        Map<String, Object> inputData = task.getInputData();

        if (inputData == null || inputData.isEmpty()) {
            failTask(task, "Task input is missing, expected object but got null");
            return;
        }

        HttpWorkerTaskDto dto;
        try {
            dto = objectMapper.convertValue(inputData, HttpWorkerTaskDto.class);
        } catch (Exception e) {
            failTask(task, "Failed to parse task input parameters: " + e.getMessage());
            return;
        }

        if (dto.getUrl() == null || dto.getUrl().isBlank()) {
            failTask(task, "URL cannot be empty");
            return;
        }
        if (dto.getMethod() == null || dto.getMethod().isBlank()) {
            failTask(task, "HTTP method cannot be empty");
            return;
        }

        String resolvedUrl = resolveString(dto.getUrl());
        String resolvedConnection = resolveString(dto.getConnection());
        Map<String, String> resolvedHeaders = resolveStringMap(dto.getHeaders());
        Object resolvedBody = resolveBody(dto.getBody());
        int timeout = dto.getTimeout() != null && dto.getTimeout() > 0 ? dto.getTimeout() : defaultHttpRequestTimeoutMs;

        HttpRequest request =
                HttpRequest.builder()
                        .nodeName(dto.getNodeName())
                        .url(resolvedUrl)
                        .method(dto.getMethod().toUpperCase())
                        .headers(resolvedHeaders != null ? resolvedHeaders : Collections.emptyMap())
                        .body(resolvedBody != null ? resolvedBody : Collections.emptyMap())
                        .timeout(timeout)
                        .connection(resolvedConnection != null && !resolvedConnection.isBlank() ? resolvedConnection : "--NONE--")
                        .build();

        long startTime = System.currentTimeMillis();
        try {
            HttpResponse response = httpExecutorService.execute(request);
            recordMetric("success");

            Map<String, Object> output = new HashMap<>();
            output.put("result", response.response());
            output.put("statusCode", response.statusCode());
            output.put("headers", response.headers());
            task.getOutputData().putAll(output);

            if (response.status() != null && response.status().is2xxSuccessful()) {
                task.setStatus(TaskModel.Status.COMPLETED);
                log.info("HttpWorker task {} completed successfully with status {}", task.getTaskId(), response.statusCode());
            } else {
                String reason = "HTTP call returned non-2xx status code: " + response.statusCode();
                task.setReasonForIncompletion(reason);
                task.setStatus(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR);
                log.warn("HttpWorker task {} failed with status {}", task.getTaskId(), response.statusCode());
            }
        } catch (Exception e) {
            log.error("HttpWorker task {} execution failed: {}", task.getTaskId(), e.getMessage(), e);
            recordMetric("failed");
            failTask(task, "HTTP execution error: " + e.getMessage());
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.debug("HttpWorker task {} executed in {}ms", task.getTaskId(), duration);
        }
    }

    @Override
    public boolean execute(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        return false;
    }

    @Override
    public void cancel(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        task.setStatus(TaskModel.Status.CANCELED);
    }

    @Override
    public boolean isAsync() {
        return false;
    }

    private void failTask(TaskModel task, String reason) {
        task.setReasonForIncompletion(reason);
        task.setStatus(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR);
        task.getOutputData().put("error", reason);
    }

    private String resolveString(String value) {
        if (value == null || variableResolver == null) {
            return value;
        }
        return variableResolver.resolve(value);
    }

    private Map<String, String> resolveStringMap(Map<String, String> map) {
        if (map == null || variableResolver == null) {
            return map;
        }
        Map<String, String> resolved = new HashMap<>();
        map.forEach((k, v) -> resolved.put(resolveString(k), resolveString(v)));
        return resolved;
    }

    private Object resolveBody(Object body) {
        return variableResolver == null ? body : variableResolver.resolveDeep(body, true);
    }

    private void recordMetric(String status) {
        if (meterRegistry != null) {
            meterRegistry.counter("http_worker_requests", "status", status).increment();
        }
    }
}

