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
package com.vodafone.vss.weaver.actions.database.worker.validation;

import java.util.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.core.JacksonException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.actions.database.worker.DatabaseTaskInputs;
import com.vodafone.vss.weaver.model.TaskModel;

public final class DatabaseTaskValidator {

    private static final Logger log = LoggerFactory.getLogger(DatabaseTaskValidator.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public record ValidationResult(boolean isValid, DatabaseTaskInputs inputs, String reason, List<String> errors) {
        public static ValidationResult valid(DatabaseTaskInputs inputs) {
            return new ValidationResult(true, inputs, null, Collections.emptyList());
        }

        public static ValidationResult invalid(String reason) {
            return new ValidationResult(false, null, reason, List.of(reason));
        }

        public static ValidationResult invalid(String reason, List<String> errors) {
            return new ValidationResult(false, null, reason, errors);
        }
    }

    private DatabaseTaskValidator() {}

    public static ValidationResult validate(TaskModel task) {
        if (task == null) {
            return ValidationResult.invalid("Task cannot be null");
        }

        Map<String, Object> inputs = resolveInputParameters(task.getInputData());
        if (inputs.isEmpty()) {
            return ValidationResult.invalid("Task input data cannot be empty");
        }

        DatabaseTaskInputs taskInputs;
        try {
            taskInputs = MAPPER.convertValue(inputs, DatabaseTaskInputs.class);
        } catch (IllegalArgumentException e) {
            String reason = e.getCause() instanceof JacksonException cause ? cause.getOriginalMessage() : e.getMessage();
            return ValidationResult.invalid("Malformed task input: " + reason);
        }

        List<String> errors = new ArrayList<>();
        if (taskInputs.getQueryId() == null && !taskInputs.hasSqlQuery()) {
            errors.add("Either queryId or sqlQuery is required");
        }
        if (taskInputs.hasSqlQuery() && taskInputs.getDatasourceId() == null) {
            errors.add("datasourceId is required when sqlQuery is provided");
        }
        if (!errors.isEmpty()) {
            return ValidationResult.invalid("Task input validation failed", errors);
        }

        log.debug("Database task inputs are valid - queryId={}, inlineSql={}",
                taskInputs.getQueryId(), taskInputs.hasSqlQuery());
        return ValidationResult.valid(taskInputs);
    }

    public static Map<String, Object> resolveInputParameters(Map<String, Object> inputData) {
        if (inputData == null || inputData.isEmpty()) {
            return Collections.emptyMap();
        }

        for (String configKey : List.of("inputParameters", "DatabaseConfigs", "HttpConfigs")) {
            Object nested = inputData.get(configKey);
            if (nested instanceof Map<?, ?> map) {
                Map<String, Object> resolved = toStringObjectMap(map);
                inputData.forEach((k, v) -> {
                    if (k.startsWith("_") && !resolved.containsKey(k)) {
                        resolved.put(k, v);
                    }
                });
                return resolved;
            }
        }

        return toStringObjectMap(inputData);
    }

    private static Map<String, Object> toStringObjectMap(Map<?, ?> values) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Object> resolved = new LinkedHashMap<>();
        values.forEach((key, value) -> resolved.put(String.valueOf(key), value));
        return resolved;
    }
}

