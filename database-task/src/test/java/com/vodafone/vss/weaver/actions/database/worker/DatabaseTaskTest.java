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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.model.TaskModel;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DatabaseTaskTest {

    private QueryService queryService;
    private DatabaseTask workerTask;
    private DatabaseSystemTask systemTask;

    @BeforeEach
    void setUp() {
        queryService = Mockito.mock(QueryService.class);
        workerTask = new DatabaseTask(queryService);
        systemTask = new DatabaseSystemTask(queryService);
    }

    @Test
    @DisplayName("Task types are properly registered")
    void taskTypesAreCorrect() {
        assertEquals("DatabaseWorker", workerTask.getTaskType());
        assertEquals("DATABASE", systemTask.getTaskType());
    }

    @Test
    @DisplayName("Invalid task inputs result in terminal failure")
    void invalidInputFailsTerminally() {
        TaskModel task = new TaskModel();
        task.setInputData(Map.of("params", Map.of()));

        workerTask.start(null, task, null);

        assertEquals(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, task.getStatus());
        assertTrue(task.getReasonForIncompletion().contains("Either queryId or sqlQuery is required"));
    }

    @Test
    @DisplayName("Successful inline SQL execution completes task and populates output")
    void successfulExecutionCompletesTask() {
        UUID datasourceId = UUID.randomUUID();
        TaskModel task = new TaskModel();
        task.setInputData(
                new HashMap<>(
                        Map.of(
                                "datasourceId", datasourceId.toString(),
                                "sqlQuery", "SELECT * FROM users WHERE active = :active",
                                "params", Map.of("active", true),
                                "_taskReferenceName", "select_users")));

        QueryExecutionResult successResult =
                QueryExecutionResult.success(List.of(Map.of("id", 1, "name", "Alice")), 15L);
        when(queryService.executeTaskSql(eq(datasourceId), anyString(), anyMap(), anyString()))
                .thenReturn(successResult);

        workerTask.start(null, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertNotNull(task.getOutputData().get("result"));
        assertEquals(successResult, task.getOutputData().get("result"));
    }

    @Test
    @DisplayName("Non-retryable query error results in terminal failure")
    void nonRetryableErrorFailsTerminally() {
        UUID datasourceId = UUID.randomUUID();
        TaskModel task = new TaskModel();
        task.setInputData(
                new HashMap<>(
                        Map.of(
                                "datasourceId", datasourceId.toString(),
                                "sqlQuery", "SELECT * FROM non_existent_table")));

        QueryExecutionResult failResult =
                QueryExecutionResult.failed(DatabaseErrorCode.SYNTAX_ERROR.name(), "Table does not exist", 5L);
        when(queryService.executeTaskSql(eq(datasourceId), anyString(), any(), anyString()))
                .thenReturn(failResult);

        workerTask.start(null, task, null);

        assertEquals(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, task.getStatus());
        assertEquals("Table does not exist", task.getReasonForIncompletion());
    }

    @Test
    @DisplayName("Retryable query error results in retryable failure")
    void retryableErrorFailsRetryably() {
        UUID datasourceId = UUID.randomUUID();
        TaskModel task = new TaskModel();
        task.setInputData(
                new HashMap<>(
                        Map.of(
                                "datasourceId", datasourceId.toString(),
                                "sqlQuery", "SELECT * FROM users")));

        QueryExecutionResult failResult =
                QueryExecutionResult.failed(DatabaseErrorCode.HOST_UNREACHABLE.name(), "Connection refused", 5L);
        when(queryService.executeTaskSql(eq(datasourceId), anyString(), any(), anyString()))
                .thenReturn(failResult);

        workerTask.start(null, task, null);

        assertEquals(TaskModel.Status.FAILED, task.getStatus());
        assertEquals("Connection refused", task.getReasonForIncompletion());
    }

    @Test
    @DisplayName("DatabaseSystemTask delegates start and execute appropriately")
    void databaseSystemTaskExecution() {
        UUID datasourceId = UUID.randomUUID();
        TaskModel task = new TaskModel();
        task.setStatus(TaskModel.Status.SCHEDULED);
        task.setInputData(
                new HashMap<>(
                        Map.of(
                                "datasourceId", datasourceId.toString(),
                                "sqlQuery", "SELECT 1")));

        QueryExecutionResult successResult =
                QueryExecutionResult.success(List.of(Map.of("val", 1)), 2L);
        when(queryService.executeTaskSql(eq(datasourceId), anyString(), any(), anyString()))
                .thenReturn(successResult);

        boolean executed = systemTask.execute(null, task, null);

        assertTrue(executed);
        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
    }
}
