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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskDto;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.common.scripting.ScriptErrorCode;
import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.core.execution.tasks.WorkflowSystemTask;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;
import com.vodafone.vss.weaver.tasks.scripting.service.ScriptExecutorService;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultSize;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultType;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.safeLogReason;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.sortedKeys;

@Component("ScriptWorker")
public class ScriptWorkerTask extends WorkflowSystemTask {

    private static final Logger log = LoggerFactory.getLogger(ScriptWorkerTask.class);
    public static final String TASK_TYPE = "ScriptWorker";

    private final ObjectMapper objectMapper;
    private final ScriptExecutorService scriptExecutorService;
    private final ScriptMetricsService scriptMetricsService;

    @Autowired
    public ScriptWorkerTask(
            ScriptExecutorService scriptExecutorService,
            ObjectMapper objectMapper,
            @Autowired(required = false) ScriptMetricsService scriptMetricsService) {
        this(TASK_TYPE, scriptExecutorService, objectMapper, scriptMetricsService);
    }

    public ScriptWorkerTask(
            String taskType,
            ScriptExecutorService scriptExecutorService,
            ObjectMapper objectMapper,
            ScriptMetricsService scriptMetricsService) {
        super(taskType);
        this.scriptExecutorService = scriptExecutorService;
        this.objectMapper = objectMapper;
        this.scriptMetricsService = scriptMetricsService;
        log.info("{} system task initialized...", getTaskType());
    }

    @Override
    public boolean isAsync() {
        return false;
    }

    @Override
    public void start(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        task.setStatus(TaskModel.Status.IN_PROGRESS);
        long startNs = System.nanoTime();
        String worker = getTaskType();
        String taskId = task.getTaskId();
        String taskRef = task.getReferenceTaskName();
        Languages language = null;

        log.debug("worker_started worker={} taskId={} taskRef={} workflowId={} workflowType={}",
                worker, taskId, taskRef, task.getWorkflowInstanceId(), task.getWorkflowType());

        try {
            ScriptEngineTaskDto cfg;
            try {
                cfg = parseInput(task);
            } catch (Exception ex) {
                if (scriptMetricsService != null) {
                    scriptMetricsService.recordExecutionFailure("worker", null, "validation", elapsedMs(startNs));
                }
                fail(task, worker, taskId, taskRef, "VALIDATION", "Failed to parse script worker input: " + ex.getMessage(), ex);
                return;
            }

            String validationError = validate(cfg);
            if (validationError != null) {
                if (scriptMetricsService != null) {
                    scriptMetricsService.recordExecutionFailure("worker", null, "validation", elapsedMs(startNs));
                }
                fail(task, worker, taskId, taskRef, "VALIDATION", validationError, null);
                return;
            }

            language = cfg.getLanguage();

            log.debug("worker_input_parsed worker={} taskId={} taskRef={} language={} timeoutMs={} scriptLength={} inputKeys={}",
                    worker, taskId, taskRef, language, cfg.getTimeout(), cfg.getScript().length(), sortedKeys(cfg.getVariables()));

            ScriptEngineTaskResult evaluation = scriptExecutorService.executeScript(cfg);
            long durationMs = elapsedMs(startNs);
            if (scriptMetricsService != null) {
                scriptMetricsService.recordExecution("worker", language, evaluation, durationMs);
            }
            task.getOutputData().put("result", evaluation);

            if ("FAILED".equalsIgnoreCase(evaluation.getStatus())) {
                boolean retryable = errorCodeOf(evaluation).isRetryable();
                task.setReasonForIncompletion(evaluation.getReason());
                task.setStatus(retryable ? TaskModel.Status.FAILED : TaskModel.Status.FAILED_WITH_TERMINAL_ERROR);
                log.warn("worker_failed worker={} taskId={} taskRef={} language={} code={} retryable={} durationMs={} reason={}",
                        worker, taskId, taskRef, language, evaluation.getCode(), retryable, durationMs,
                        safeLogReason(evaluation.getReason()));
                return;
            }

            task.setStatus(TaskModel.Status.COMPLETED);
            log.info("worker_completed worker={} taskId={} taskRef={} language={} durationMs={} resultType={} resultSize={}",
                    worker, taskId, taskRef, language, durationMs,
                    resultType(evaluation.getOutput()), resultSize(evaluation.getOutput()));
        } catch (Exception ex) {
            if (scriptMetricsService != null) {
                scriptMetricsService.recordExecutionFailure("worker", language, "exception", elapsedMs(startNs));
            }
            log.error("worker_error worker={} taskId={} taskRef={} language={} exceptionClass={}",
                    worker, taskId, taskRef, language, ex.getClass().getSimpleName(), ex);
            fail(task, worker, taskId, taskRef, "EXECUTION", "Script execution error: " + ex.getMessage(), ex);
        }
    }

    private ScriptEngineTaskDto parseInput(TaskModel task) throws JsonProcessingException {
        if (task == null) {
            throw new IllegalArgumentException("Task is null");
        }

        Map<String, Object> inputData = task.getInputData();
        if (inputData == null || inputData.isEmpty()) {
            throw new IllegalArgumentException("Task inputData is missing");
        }

        Object rawInput = inputData.get("ScriptConfigs");
        if (rawInput == null) {
            rawInput = inputData.get("inputParameters");
        }
        if (rawInput == null) {
            rawInput = inputData;
        }

        // Placeholders were resolved before start(); the task does not resolve them itself.
        Object normalizedInput = normalizeInput(rawInput);
        return objectMapper.convertValue(normalizedInput, ScriptEngineTaskDto.class);
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

    private String validate(ScriptEngineTaskDto cfg) {
        if (cfg == null) {
            return "Script worker input is missing";
        }
        if (cfg.getScript() == null || cfg.getScript().isBlank()) {
            return "script is required";
        }
        if (cfg.getLanguage() == null) {
            cfg.setLanguage(Languages.JEXL);
        }
        return null;
    }

    private static ScriptErrorCode errorCodeOf(ScriptEngineTaskResult evaluation) {
        try {
            return evaluation.getCode() != null
                    ? ScriptErrorCode.valueOf(evaluation.getCode())
                    : ScriptErrorCode.SCRIPT_EXECUTION_ERROR;
        } catch (IllegalArgumentException e) {
            return ScriptErrorCode.SCRIPT_EXECUTION_ERROR;
        }
    }

    private static long elapsedMs(long startNs) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNs);
    }

    private void fail(
            TaskModel task,
            String worker,
            String taskId,
            String taskRef,
            String failureType,
            String reason,
            Exception ex) {
        String safeReason = safeLogReason(reason);

        Map<String, Object> errorResult = new LinkedHashMap<>();
        errorResult.put("worker", worker);
        errorResult.put("taskId", taskId);
        errorResult.put("taskRef", taskRef);
        errorResult.put("failureType", failureType);
        errorResult.put("reason", safeReason);
        if (ex != null) {
            errorResult.put("exceptionMessage", safeLogReason(ex.getMessage()));
        }

        task.setOutputData(errorResult);
        task.setReasonForIncompletion(safeReason);
        task.setStatus(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR);
    }
}

