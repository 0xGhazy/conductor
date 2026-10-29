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

import java.util.NoSuchElementException;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.actions.database.exception.DatasourceUnavailableException;
import com.vodafone.vss.weaver.actions.database.service.QueryService;
import com.vodafone.vss.weaver.actions.database.util.DatabaseErrorClassifier;
import com.vodafone.vss.weaver.actions.database.worker.validation.DatabaseTaskValidator;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.core.execution.tasks.WorkflowSystemTask;
import com.vodafone.vss.weaver.core.utils.Utils;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

/**
 * Conductor System Task executing database queries against configured datasources.
 * Registered as "DatabaseWorker" for backward compatibility with existing workflows.
 */
@Component("DatabaseWorker")
public class DatabaseTask extends WorkflowSystemTask {

    private static final Logger log = LoggerFactory.getLogger(DatabaseTask.class);

    public static final String TASK_TYPE_DATABASE_WORKER = "DatabaseWorker";

    private final QueryService queryService;

    @Autowired
    public DatabaseTask(QueryService queryService) {
        this(TASK_TYPE_DATABASE_WORKER, queryService);
    }

    public DatabaseTask(String name, QueryService queryService) {
        super(name);
        this.queryService = queryService;
        log.info("{} system task initialized...", getTaskType());
    }

    @Override
    public void start(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        executeTask(task);
    }

    @Override
    public boolean execute(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        if (task.getStatus() == TaskModel.Status.SCHEDULED || task.getStatus() == TaskModel.Status.IN_PROGRESS) {
            executeTask(task);
            return true;
        }
        return false;
    }

    private void executeTask(TaskModel task) {
        String taskId = task.getTaskId();
        task.setWorkerId(Utils.getServerId());

        DatabaseTaskValidator.ValidationResult validation = DatabaseTaskValidator.validate(task);
        if (!validation.isValid()) {
            String reason = validation.errors() != null && !validation.errors().isEmpty()
                    ? String.join(", ", validation.errors())
                    : validation.reason();
            log.warn("Task {}: invalid input: {}", taskId, reason);
            fail(task, TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, reason, null);
            return;
        }

        DatabaseTaskInputs inputs = validation.inputs();
        String target = inputs.hasSqlQuery()
                ? "inline SQL on datasource " + inputs.getDatasourceId()
                : "saved query " + inputs.getQueryId();
        log.debug("Task {}: running {}", taskId, target);

        long start = System.nanoTime();
        try {
            QueryExecutionResult qr = inputs.hasSqlQuery()
                    ? queryService.executeTaskSql(inputs.getDatasourceId(), inputs.getSqlQuery(), inputs.getParams(), inlineQueryName(inputs))
                    : queryService.executeSavedQuery(inputs.getQueryId(), inputs.getParams());
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);

            if (!"SUCCESS".equals(qr.getStatus())) {
                DatabaseErrorCode code = errorCodeOf(qr);
                if (code.isRetryable()) {
                    log.warn("Task {}: {} failed in {} ms with errorCode={}, will retry", taskId, target, elapsedMs, code);
                } else {
                    log.error("Task {}: {} failed in {} ms with errorCode={}", taskId, target, elapsedMs, code);
                }
                String message = qr.getReason() != null ? String.valueOf(qr.getReason()) : code.getDefaultMessage();
                fail(task, statusFor(code.isRetryable()), message, code.name());
                return;
            }

            log.info("Task {}: {} succeeded in {} ms ({})", taskId, target, elapsedMs, rowSummary(qr));
            task.getOutputData().put("result", qr);
            task.setStatus(TaskModel.Status.COMPLETED);
        } catch (NoSuchElementException e) {
            log.warn("Task {}: saved query {} not found", taskId, inputs.getQueryId());
            fail(task, TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, "Query not found with id " + inputs.getQueryId(), null);
        } catch (DatasourceUnavailableException e) {
            if (e.isRetryable()) {
                log.warn("Task {}: datasource for {} unavailable, will retry: code={}, {}", taskId, target, e.getErrorCode(), e.getMessage());
            } else {
                log.error("Task {}: datasource for {} unavailable: code={}, {}", taskId, target, e.getErrorCode(), e.getMessage());
            }
            fail(task, statusFor(e.isRetryable()), e.getMessage(), e.getErrorCode().name());
        } catch (IllegalArgumentException e) {
            log.warn("Task {}: invalid parameters for {}: {}", taskId, target, e.getMessage());
            fail(task, TaskModel.Status.FAILED_WITH_TERMINAL_ERROR, "Failed to parse query parameters: " + e.getMessage(), null);
        } catch (Exception e) {
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            log.error("Task {}: {} failed unexpectedly after {} ms", taskId, target, elapsedMs, e);
            DatabaseErrorClassifier.Result classified = DatabaseErrorClassifier.classify(e);
            fail(task, statusFor(classified.retryable()), classified.safeMessage(), classified.code().name());
        }
    }

    private static void fail(TaskModel task, TaskModel.Status status, String message, String errorCode) {
        task.getOutputData().put("result", message);
        if (errorCode != null) {
            task.getOutputData().put("errorCode", errorCode);
        }
        task.setReasonForIncompletion(message);
        task.setStatus(status);
    }

    private static TaskModel.Status statusFor(boolean retryable) {
        return retryable ? TaskModel.Status.FAILED : TaskModel.Status.FAILED_WITH_TERMINAL_ERROR;
    }

    private static DatabaseErrorCode errorCodeOf(QueryExecutionResult qr) {
        try {
            return qr.getErrorCode() != null ? DatabaseErrorCode.valueOf(qr.getErrorCode()) : DatabaseErrorCode.DATA_ACCESS_ERROR;
        } catch (IllegalArgumentException e) {
            return DatabaseErrorCode.DATA_ACCESS_ERROR;
        }
    }

    private static String rowSummary(QueryExecutionResult qr) {
        return qr.getSize() != null
                ? qr.getSize() + " rows returned"
                : (qr.getAffectedRows() != null ? qr.getAffectedRows() : 0) + " rows affected";
    }

    private static String inlineQueryName(DatabaseTaskInputs inputs) {
        String reference = inputs.getTaskReferenceName();
        return reference != null && !reference.isBlank() ? reference : "inline-query";
    }
}

