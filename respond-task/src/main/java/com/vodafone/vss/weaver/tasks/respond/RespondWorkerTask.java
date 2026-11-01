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
package com.vodafone.vss.weaver.tasks.respond;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.VariableResolver;
import com.vodafone.vss.weaver.common.respond.RespondWorkerTaskDto;
import com.vodafone.vss.weaver.common.utils.WorkerUtils;
import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.core.execution.tasks.WorkflowSystemTask;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.respond.contract.WorkflowMetadataProvider;
import com.vodafone.vss.weaver.tasks.respond.service.WorkflowTranslationCacheService;

import com.fasterxml.jackson.databind.ObjectMapper;

@Component("RespondWorker")
public class RespondWorkerTask extends WorkflowSystemTask {

    private static final Logger log = LoggerFactory.getLogger(RespondWorkerTask.class);
    public static final String TASK_TYPE = "RespondWorker";
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\$\\{([^}]+)\\}");

    private final WorkflowTranslationCacheService translationCacheService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private WorkflowMetadataProvider workflowMetadataProvider;

    @Autowired(required = false)
    private VariableResolver variableResolver;

    @Autowired
    public RespondWorkerTask(
            WorkflowTranslationCacheService translationCacheService, ObjectMapper objectMapper) {
        this(TASK_TYPE, translationCacheService, objectMapper);
    }

    public RespondWorkerTask(
            String taskType,
            WorkflowTranslationCacheService translationCacheService,
            ObjectMapper objectMapper) {
        super(taskType);
        this.translationCacheService = translationCacheService;
        this.objectMapper = objectMapper;
        log.info("{} system task initialized...", getTaskType());
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
        String workflowName = workflow != null ? workflow.getWorkflowName() : task.getWorkflowType();
        int version = workflow != null ? workflow.getWorkflowVersion() : 1;

        log.info("Starting RespondWorker: taskId={}, workflowId={}, workflowName={}, version={}",
                taskId, workflowId, workflowName, version);

        try {
            RespondWorkerTaskDto dto = parseInput(task);
            if (dto.getMessageCode() == null || dto.getMessageCode().isBlank()) {
                fail(task, "Message code is required");
                return;
            }

            String messageCode = resolveString(dto.getMessageCode());
            String rawLanguageCode = resolveString(dto.getLanguageCode());
            String languageCode = (rawLanguageCode != null && !rawLanguageCode.isBlank())
                    ? rawLanguageCode.trim()
                    : null;

            // Fallback to workflow input '_language' if languageCode is missing or placeholder
            if (languageCode == null || "default".equalsIgnoreCase(languageCode) || languageCode.startsWith("${")) {
                if (workflow != null && workflow.getInput() != null && workflow.getInput().containsKey("_language")) {
                    Object l = workflow.getInput().get("_language");
                    if (l != null && !String.valueOf(l).isBlank()) {
                        languageCode = String.valueOf(l).trim();
                    }
                } else if (task.getInputData() != null && task.getInputData().containsKey("_language")) {
                    Object l = task.getInputData().get("_language");
                    if (l != null && !String.valueOf(l).isBlank()) {
                        languageCode = String.valueOf(l).trim();
                    }
                }
            }

            String defaultWorkflowLanguage = (workflowMetadataProvider != null && workflowName != null)
                    ? workflowMetadataProvider.findDefaultLanguage(workflowName, version).orElse(null)
                    : null;

            if (languageCode == null || "default".equalsIgnoreCase(languageCode) || languageCode.startsWith("${")) {
                languageCode = (defaultWorkflowLanguage != null && !defaultWorkflowLanguage.isBlank())
                        ? defaultWorkflowLanguage
                        : "en";
            }

            Map<String, Map<String, String>> translations =
                    translationCacheService.getTranslations(workflowName, version);
            Map<String, String> langMap = translations.get(messageCode);

            String template = null;
            String resolvedLanguage = languageCode;

            if (langMap != null && !langMap.isEmpty()) {
                if (langMap.containsKey(languageCode) && langMap.get(languageCode) != null && !langMap.get(languageCode).isBlank()) {
                    template = langMap.get(languageCode);
                    resolvedLanguage = languageCode;
                } else if (defaultWorkflowLanguage != null && langMap.containsKey(defaultWorkflowLanguage) && langMap.get(defaultWorkflowLanguage) != null && !langMap.get(defaultWorkflowLanguage).isBlank()) {
                    template = langMap.get(defaultWorkflowLanguage);
                    resolvedLanguage = defaultWorkflowLanguage;
                } else if (langMap.containsKey("default") && langMap.get("default") != null && !langMap.get("default").isBlank()) {
                    template = langMap.get("default");
                    resolvedLanguage = "default";
                } else {
                    Map.Entry<String, String> firstEntry = langMap.entrySet().iterator().next();
                    template = firstEntry.getValue();
                    resolvedLanguage = firstEntry.getKey();
                }
            }

            if (template == null) {
                template = messageCode;
            }

            Map<String, Object> resolvedVariables = resolveVariablesMap(dto.getVariables());
            Map<String, Object> context = buildContext(workflow, task, resolvedVariables);

            String resolvedMessage = interpolatePlaceholders(template, context);
            resolvedMessage = resolveString(resolvedMessage);

            task.getOutputData().put("responseCode", messageCode);
            task.getOutputData().put("languageCode", resolvedLanguage);
            task.getOutputData().put("message", resolvedMessage);
            task.setStatus(TaskModel.Status.COMPLETED);

            log.info("RespondWorker completed: taskId={}, responseCode={}, languageCode={}, message={}",
                    taskId, messageCode, resolvedLanguage, resolvedMessage);
        } catch (Exception ex) {
            log.error("RespondWorker failed: taskId={}", taskId, ex);
            fail(task, "RespondWorker execution failed: " + ex.getMessage());
        }
    }

    private RespondWorkerTaskDto parseInput(TaskModel task) {
        Map<String, Object> inputData = task.getInputData();
        if (inputData == null || inputData.isEmpty()) {
            throw new IllegalArgumentException("Task inputData is missing");
        }

        Object rawInput = inputData.get("inputParameters");
        if (rawInput == null) {
            rawInput = inputData.get("RespondConfigs");
        }
        if (rawInput == null) {
            rawInput = inputData;
        }

        return objectMapper.convertValue(rawInput, RespondWorkerTaskDto.class);
    }

    private Map<String, Object> buildContext(
            WorkflowModel workflow, TaskModel task, Map<String, Object> variables) {
        Map<String, Object> context = new HashMap<>();

        if (workflow != null && workflow.getInput() != null) {
            context.put("workflow", Map.of("input", workflow.getInput()));
            context.put("input", workflow.getInput());
        }
        if (task.getInputData() != null) {
            context.putAll(task.getInputData());
        }
        if (variables != null) {
            context.putAll(variables);
            context.put("variables", variables);
        }

        return context;
    }

    private String interpolatePlaceholders(String template, Map<String, Object> context) {
        if (template == null || !template.contains("${")) {
            return template;
        }

        Matcher matcher = PLACEHOLDER_PATTERN.matcher(template);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String path = matcher.group(1).trim();
            Object value = resolvePath(path, context);
            String replacement = value != null ? String.valueOf(value) : matcher.group(0);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private Object resolvePath(String path, Map<String, Object> context) {
        if (context == null || path == null || path.isBlank()) {
            return null;
        }
        if (context.containsKey(path)) {
            return context.get(path);
        }

        String[] parts = path.split("\\.");
        Object current = context;
        for (String part : parts) {
            if (current instanceof Map<?, ?> map) {
                current = map.get(part);
            } else {
                return null;
            }
        }
        return current;
    }

    private String resolveString(String value) {
        if (value == null || variableResolver == null) {
            return value;
        }
        return variableResolver.resolve(value);
    }

    private Map<String, Object> resolveVariablesMap(Map<String, Object> variables) {
        if (variables == null || variableResolver == null) {
            return variables != null ? variables : Collections.emptyMap();
        }
        return variableResolver.resolveMap(variables);
    }

    private void fail(TaskModel task, String reason) {
        task.setStatus(TaskModel.Status.FAILED_WITH_TERMINAL_ERROR);
        task.setReasonForIncompletion(reason);
        task.getOutputData().put("error", reason);
    }
}

