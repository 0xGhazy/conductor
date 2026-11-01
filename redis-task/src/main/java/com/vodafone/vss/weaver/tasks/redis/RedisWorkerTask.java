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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.VariableResolver;
import com.vodafone.vss.weaver.common.redis.RedisCommandRequestDto;
import com.vodafone.vss.weaver.common.redis.RedisCommandResponseDto;
import com.vodafone.vss.weaver.common.redis.RedisDatasourceModel;
import com.vodafone.vss.weaver.common.redis.RedisWorkerTaskDto;
import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.core.execution.tasks.WorkflowSystemTask;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.redis.service.RedisService;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component("RedisWorker")
public class RedisWorkerTask extends WorkflowSystemTask {

    private static final Logger log = LoggerFactory.getLogger(RedisWorkerTask.class);
    public static final String TASK_TYPE = "RedisWorker";

    private static final String K_REDIS_CONFIGS = "RedisConfigs";
    private static final String K_INPUT_PARAMETERS = "inputParameters";

    private final RedisService redisService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private VariableResolver variableResolver;

    @Autowired
    public RedisWorkerTask(RedisService redisService, ObjectMapper objectMapper) {
        this(TASK_TYPE, redisService, objectMapper);
    }

    public RedisWorkerTask(
            String taskType,
            RedisService redisService,
            ObjectMapper objectMapper) {
        super(taskType);
        this.redisService = redisService;
        this.objectMapper = objectMapper;
        log.info("{} system task initialized...", getTaskType());
    }

    public void setVariableResolver(VariableResolver variableResolver) {
        this.variableResolver = variableResolver;
    }

    @Override
    public boolean isAsync() {
        return false;
    }

    @Override
    public void start(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        task.setStatus(TaskModel.Status.IN_PROGRESS);

        String taskId = task.getTaskId();
        String workflowId = workflow != null ? workflow.getWorkflowId() : task.getWorkflowInstanceId();
        log.info("Starting RedisWorker execution: taskId={}, workflowId={}", taskId, workflowId);

        RedisWorkerTaskDto inputs;
        try {
            inputs = parseInput(task);
        } catch (Exception ex) {
            fail(task, "Failed to parse Redis worker input: " + ex.getMessage(), ex);
            return;
        }

        String validationError = validate(inputs);
        if (validationError != null) {
            fail(task, validationError, null);
            return;
        }

        try {
            UUID datasourceId = inputs.getDatasourceId();
            if (datasourceId == null && inputs.getDatasourceName() != null) {
                RedisDatasourceModel ds = redisService.findByName(resolveString(inputs.getDatasourceName()));
                datasourceId = ds.getId();
            }

            RedisCommandRequestDto request = RedisCommandRequestDto.builder()
                    .action(resolveString(inputs.getAction()))
                    .key(resolveString(inputs.getKey()))
                    .value(resolveString(inputs.getValue()))
                    .field(resolveString(inputs.getField()))
                    .ttlSeconds(inputs.getTtlSeconds())
                    .delta(inputs.getDelta())
                    .keys(resolveStringList(inputs.getKeys()))
                    .hashValues(resolveStringMap(inputs.getHashValues()))
                    .build();

            RedisCommandResponseDto response = redisService.executeCommand(datasourceId, request);
            task.getOutputData().put("result", response);
            task.setStatus(TaskModel.Status.COMPLETED);

            log.info("RedisWorker completed successfully: taskId={}, workflowId={}, action={}",
                    taskId, workflowId, inputs.getAction());
        } catch (Exception ex) {
            fail(task, "Redis worker execution failed: " + ex.getMessage(), ex);
        }
    }

    private RedisWorkerTaskDto parseInput(TaskModel task) throws JsonProcessingException {
        if (task == null) {
            throw new IllegalArgumentException("Task is null");
        }

        Map<String, Object> inputData = task.getInputData();
        if (inputData == null || inputData.isEmpty()) {
            throw new IllegalArgumentException("Task inputData is missing");
        }

        Object rawInput = inputData.get(K_REDIS_CONFIGS);
        if (rawInput == null) {
            rawInput = inputData.get(K_INPUT_PARAMETERS);
        }
        if (rawInput == null) {
            rawInput = inputData;
        }

        Object resolvedInput = resolveRawInput(rawInput);
        Object normalizedInput = normalizeInput(resolvedInput);
        return objectMapper.convertValue(normalizedInput, RedisWorkerTaskDto.class);
    }

    private Object normalizeInput(Object rawInput) throws JsonProcessingException {
        if (rawInput instanceof String rawString) {
            String trimmed = rawString.trim();
            if (trimmed.isEmpty()) {
                return Map.of();
            }
            return objectMapper.readValue(trimmed, Object.class);
        }
        return rawInput;
    }

    private String validate(RedisWorkerTaskDto inputs) {
        if (inputs == null) {
            return "Redis worker input is missing";
        }
        if (inputs.getFailureReason() != null) {
            return inputs.getFailureReason();
        }
        if (inputs.getDatasourceId() == null && (inputs.getDatasourceName() == null || inputs.getDatasourceName().isBlank())) {
            return "'datasourceId' or 'datasourceName' is required";
        }

        String action = normalizeAction(inputs.getAction());
        if (action.isEmpty()) {
            return "'action' is required";
        }
        inputs.setAction(action);

        if (requiresKey(action) && isBlank(inputs.getKey())) {
            return "'key' is required for Redis action " + action;
        }
        if (requiresField(action) && isBlank(inputs.getField())) {
            return "'field' is required for Redis action " + action;
        }
        if (requiresTtl(action) && (inputs.getTtlSeconds() == null || inputs.getTtlSeconds() <= 0)) {
            return "'ttlSeconds' must be greater than 0 for Redis action " + action;
        }
        if ("SET".equals(action) && inputs.getValue() == null) {
            return "'value' is required for Redis action SET";
        }

        return null;
    }

    private boolean requiresKey(String action) {
        return switch (action) {
            case "GET", "SET", "DEL", "DELETE", "EXISTS", "EXPIRE", "KEYS",
                 "INCR", "INCRBY", "DECR", "DECRBY", "HSET", "HGET", "HDEL", "HGETALL", "HINCRBY" -> true;
            default -> false;
        };
    }

    private boolean requiresField(String action) {
        return switch (action) {
            case "HSET", "HGET", "HDEL", "HINCRBY" -> true;
            default -> false;
        };
    }

    private boolean requiresTtl(String action) {
        return "EXPIRE".equals(action);
    }

    private String normalizeAction(String action) {
        return action == null ? "" : action.trim().toUpperCase();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private void fail(TaskModel task, String reason, Exception ex) {
        if (ex != null) {
            log.error("RedisWorker failed: reason={}", reason, ex);
        } else {
            log.warn("RedisWorker failed: reason={}", reason);
        }

        task.setStatus(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR);
        task.setReasonForIncompletion(reason);
        task.getOutputData().put("result", reason);
        task.getOutputData().put("error", reason);
    }

    private String resolveString(String value) {
        if (value == null || variableResolver == null) {
            return value;
        }
        return variableResolver.resolve(value);
    }

    private List<String> resolveStringList(List<String> list) {
        if (list == null || variableResolver == null) {
            return list;
        }
        List<String> resolved = new ArrayList<>(list.size());
        for (String item : list) {
            resolved.add(resolveString(item));
        }
        return resolved;
    }

    private Map<String, String> resolveStringMap(Map<String, String> map) {
        if (map == null || variableResolver == null) {
            return map;
        }
        Map<String, String> resolved = new LinkedHashMap<>();
        map.forEach((k, v) -> resolved.put(
                resolveString(k),
                resolveString(v)
        ));
        return resolved;
    }

    private Object resolveRawInput(Object input) {
        return variableResolver == null ? input : variableResolver.resolveDeep(input, true);
    }
}

