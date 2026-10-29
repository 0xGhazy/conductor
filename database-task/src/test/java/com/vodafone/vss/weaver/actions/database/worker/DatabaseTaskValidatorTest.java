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
package com.vodafone.vss.weaver.actions.database.worker;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.actions.database.worker.validation.DatabaseTaskValidator;
import com.vodafone.vss.weaver.actions.database.worker.validation.DatabaseTaskValidator.ValidationResult;
import com.vodafone.vss.weaver.model.TaskModel;

import static org.junit.jupiter.api.Assertions.*;

class DatabaseTaskValidatorTest {

    private static TaskModel task(Map<String, Object> input) {
        TaskModel task = new TaskModel();
        if (input != null) {
            task.setInputData(input);
        }
        return task;
    }

    @Test
    void acceptsSavedQuery() {
        UUID queryId = UUID.randomUUID();
        ValidationResult result =
                DatabaseTaskValidator.validate(
                        task(
                                new HashMap<>(
                                        Map.of(
                                                "queryId", queryId.toString(),
                                                "params", Map.of("id", 1),
                                                "_taskReferenceName", "load_user"))));

        assertTrue(result.isValid());
        assertEquals(queryId, result.inputs().getQueryId());
        assertEquals(Map.of("id", 1), result.inputs().getParams());
        assertEquals("load_user", result.inputs().getTaskReferenceName());
    }

    @Test
    void acceptsInlineSqlWithDatasource() {
        UUID datasourceId = UUID.randomUUID();
        ValidationResult result =
                DatabaseTaskValidator.validate(
                        task(
                                new HashMap<>(
                                        Map.of(
                                                "sqlQuery", "SELECT 1",
                                                "datasourceId", datasourceId.toString()))));

        assertTrue(result.isValid());
        assertTrue(result.inputs().hasSqlQuery());
        assertEquals(datasourceId, result.inputs().getDatasourceId());
    }

    @Test
    void readsInputNestedUnderDatabaseConfigs() {
        UUID queryId = UUID.randomUUID();
        Map<String, Object> input = new HashMap<>();
        input.put("DatabaseConfigs", Map.of("queryId", queryId.toString()));
        input.put("_taskReferenceName", "outer_ref");

        ValidationResult result = DatabaseTaskValidator.validate(task(input));

        assertTrue(result.isValid());
        assertEquals(queryId, result.inputs().getQueryId());
        assertEquals("outer_ref", result.inputs().getTaskReferenceName());
    }

    @Test
    void requiresQueryIdOrSqlQuery() {
        ValidationResult result =
                DatabaseTaskValidator.validate(task(new HashMap<>(Map.of("params", Map.of()))));

        assertFalse(result.isValid());
        assertEquals(List.of("Either queryId or sqlQuery is required"), result.errors());
    }

    @Test
    void requiresDatasourceIdWithSqlQuery() {
        ValidationResult result =
                DatabaseTaskValidator.validate(task(new HashMap<>(Map.of("sqlQuery", "SELECT 1"))));

        assertFalse(result.isValid());
        assertEquals(List.of("datasourceId is required when sqlQuery is provided"), result.errors());
    }

    @Test
    void blankSqlQueryCountsAsMissing() {
        ValidationResult result =
                DatabaseTaskValidator.validate(task(new HashMap<>(Map.of("sqlQuery", "   "))));

        assertFalse(result.isValid());
        assertEquals(List.of("Either queryId or sqlQuery is required"), result.errors());
    }

    @Test
    void rejectsMalformedIds() {
        ValidationResult result =
                DatabaseTaskValidator.validate(task(new HashMap<>(Map.of("queryId", "not-a-uuid"))));

        assertFalse(result.isValid());
        assertTrue(result.reason().startsWith("Malformed task input"), result.reason());
    }

    @Test
    void rejectsEmptyOrMissingInput() {
        assertEquals(
                "Task input data cannot be empty",
                DatabaseTaskValidator.validate(task(new HashMap<>())).reason());
        assertEquals(
                "Task input data cannot be empty",
                DatabaseTaskValidator.validate(task(null)).reason());
        assertEquals("Task cannot be null", DatabaseTaskValidator.validate(null).reason());
    }
}
