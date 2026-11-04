/*
 * Copyright 2022 Conductor Authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.core.utils;

import java.io.IOException;
import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.commons.lang3.StringUtils;
import org.conductoross.conductor.dao.SecretsDAO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.metadata.tasks.TaskDef;
import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef;
import com.vodafone.vss.weaver.common.utils.EnvUtils;
import com.vodafone.vss.weaver.common.utils.TaskUtils;
import com.vodafone.vss.weaver.core.placeholders.WeaverPlaceholderResolver;
import com.vodafone.vss.weaver.dao.EnvironmentDAO;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.Configuration;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.Option;

/** Used to parse and resolve the JSONPath bindings in the workflow and task definitions. */
@Component
public class ParametersUtils {

    private static final Logger LOGGER = LoggerFactory.getLogger(ParametersUtils.class);
    private static final Pattern PATTERN =
            Pattern.compile(
                    "(?=(?<!\\$)\\$\\{)(?:(?=.*?\\{(?!.*?\\1)(.*\\}(?!.*\\2).*))(?=.*?\\}(?!.*?\\2)(.*)).)+?.*?(?=\\1)[^{]*(?=\\2$)",
                    Pattern.DOTALL);
    /**
     * Unescapes {@code $${} in text written in the workflow definition, except for escaped secret
     * references: those stay escaped so the execution-time secret pass keeps them literal and
     * unescapes them itself (see {@link WeaverPlaceholderResolver#resolveSecrets}).
     */
    private static final Pattern TEMPLATE_ESCAPE =
            Pattern.compile("\\$\\$\\{(?!" + Pattern.quote(WeaverPlaceholderResolver.SECRETS_PREFIX) + ")");

    private final ObjectMapper objectMapper;
    private final TypeReference<Map<String, Object>> map = new TypeReference<>() {};
    @Nullable private final WeaverPlaceholderResolver placeholders;

    public ParametersUtils(ObjectMapper objectMapper) {
        this(objectMapper, (WeaverPlaceholderResolver) null);
    }

    /** Convenience for tests and callers without Spring: no secret cache. */
    public ParametersUtils(
            ObjectMapper objectMapper,
            @Nullable EnvironmentDAO environmentDAO,
            @Nullable SecretsDAO secretsDAO) {
        this(objectMapper, new WeaverPlaceholderResolver(environmentDAO, secretsDAO, Duration.ZERO));
    }

    @Autowired
    public ParametersUtils(
            ObjectMapper objectMapper, @Nullable WeaverPlaceholderResolver placeholders) {
        this.objectMapper = objectMapper;
        this.placeholders = placeholders;
    }

    public Map<String, Object> getTaskInput(
            Map<String, Object> inputParams,
            WorkflowModel workflow,
            TaskDef taskDefinition,
            String taskId) {
        if (workflow.getWorkflowDefinition().getSchemaVersion() > 1) {
            return getTaskInputV2(inputParams, workflow, taskId, taskDefinition);
        }
        return getTaskInputV1(workflow, inputParams);
    }

    public Map<String, Object> getTaskInputV2(
            Map<String, Object> input,
            WorkflowModel workflow,
            String taskId,
            TaskDef taskDefinition) {
        Map<String, Object> inputParams;

        if (input != null) {
            inputParams = clone(input);
        } else {
            inputParams = new HashMap<>();
        }
        if (taskDefinition != null && taskDefinition.getInputTemplate() != null) {
            clone(taskDefinition.getInputTemplate()).forEach(inputParams::putIfAbsent);
        }

        Map<String, Map<String, Object>> inputMap = new HashMap<>();

        Map<String, Object> workflowParams = new HashMap<>();
        workflowParams.put("input", workflow.getInput());
        workflowParams.put("output", workflow.getOutput());
        workflowParams.put("status", workflow.getStatus());
        workflowParams.put("workflowId", workflow.getWorkflowId());
        workflowParams.put("parentWorkflowId", workflow.getParentWorkflowId());
        workflowParams.put("parentWorkflowTaskId", workflow.getParentWorkflowTaskId());
        workflowParams.put("workflowType", workflow.getWorkflowName());
        workflowParams.put("version", workflow.getWorkflowVersion());
        workflowParams.put("correlationId", workflow.getCorrelationId());
        workflowParams.put("reasonForIncompletion", workflow.getReasonForIncompletion());
        workflowParams.put("schemaVersion", workflow.getWorkflowDefinition().getSchemaVersion());
        workflowParams.put("variables", workflow.getVariables());

        inputMap.put("workflow", workflowParams);

        // For new workflow being started the list of tasks will be empty
        workflow.getTasks().stream()
                .map(TaskModel::getReferenceTaskName)
                .map(workflow::getTaskByRefName)
                .forEach(
                        task -> {
                            Map<String, Object> taskParams = new HashMap<>();
                            taskParams.put("input", task.getInputData());
                            taskParams.put("output", task.getOutputData());
                            taskParams.put("taskType", task.getTaskType());
                            if (task.getStatus() != null) {
                                taskParams.put("status", task.getStatus().toString());
                            }
                            taskParams.put("referenceTaskName", task.getReferenceTaskName());
                            taskParams.put("retryCount", task.getRetryCount());
                            taskParams.put("correlationId", task.getCorrelationId());
                            taskParams.put("pollCount", task.getPollCount());
                            taskParams.put("taskDefName", task.getTaskDefName());
                            taskParams.put("scheduledTime", task.getScheduledTime());
                            taskParams.put("startTime", task.getStartTime());
                            taskParams.put("endTime", task.getEndTime());
                            taskParams.put("workflowInstanceId", task.getWorkflowInstanceId());
                            taskParams.put("taskId", task.getTaskId());
                            taskParams.put(
                                    "reasonForIncompletion", task.getReasonForIncompletion());
                            taskParams.put("callbackAfterSeconds", task.getCallbackAfterSeconds());
                            taskParams.put("workerId", task.getWorkerId());
                            taskParams.put("iteration", task.getIteration());
                            inputMap.put(
                                    task.isLoopOverTask()
                                            ? TaskUtils.removeIterationFromTaskRefName(
                                                    task.getReferenceTaskName())
                                            : task.getReferenceTaskName(),
                                    taskParams);
                        });

        Configuration option =
                Configuration.defaultConfiguration().addOptions(Option.SUPPRESS_EXCEPTIONS);
        DocumentContext documentContext = JsonPath.parse(inputMap, option);
        Map<String, Object> replacedTaskInput = replace(inputParams, documentContext, taskId);
        if (taskDefinition != null && taskDefinition.getInputTemplate() != null) {
            // If input for a given key resolves to null, try replacing it with one from
            // inputTemplate, if it exists.
            replacedTaskInput.replaceAll(
                    (key, value) ->
                            (value == null) ? taskDefinition.getInputTemplate().get(key) : value);
        }
        return replacedTaskInput;
    }

    // deep clone using json - POJO
    private Map<String, Object> clone(Map<String, Object> inputTemplate) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(inputTemplate);
            return objectMapper.readValue(bytes, map);
        } catch (IOException e) {
            throw new RuntimeException("Unable to clone input params", e);
        }
    }

    public Map<String, Object> replace(Map<String, Object> input, Object json) {
        Object doc;
        if (json instanceof String) {
            doc = JsonPath.parse(json.toString());
        } else {
            doc = json;
        }
        Configuration option =
                Configuration.defaultConfiguration().addOptions(Option.SUPPRESS_EXCEPTIONS);
        DocumentContext documentContext = JsonPath.parse(doc, option);
        return replace(input, documentContext, null);
    }

    public Object replace(String paramString) {
        Configuration option =
                Configuration.defaultConfiguration().addOptions(Option.SUPPRESS_EXCEPTIONS);
        DocumentContext documentContext = JsonPath.parse(Collections.emptyMap(), option);
        return replaceVariables(paramString, documentContext, null);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> replace(
            Map<String, Object> input, DocumentContext documentContext, String taskId) {
        Map<String, Object> result = new HashMap<>();
        for (Entry<String, Object> e : input.entrySet()) {
            Object newValue;
            Object value = e.getValue();
            if (value instanceof String) {
                newValue = replaceVariables(value.toString(), documentContext, taskId);
            } else if (value instanceof Map) {
                // recursive call
                newValue = replace((Map<String, Object>) value, documentContext, taskId);
            } else if (value instanceof List) {
                newValue = replaceList((List<?>) value, taskId, documentContext);
            } else {
                newValue = value;
            }
            result.put(e.getKey(), newValue);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private Object replaceList(List<?> values, String taskId, DocumentContext io) {
        List<Object> replacedList = new LinkedList<>();
        for (Object listVal : values) {
            if (listVal instanceof String) {
                Object replaced = replaceVariables(listVal.toString(), io, taskId);
                replacedList.add(replaced);
            } else if (listVal instanceof Map) {
                Object replaced = replace((Map<String, Object>) listVal, io, taskId);
                replacedList.add(replaced);
            } else if (listVal instanceof List) {
                Object replaced = replaceList((List<?>) listVal, taskId, io);
                replacedList.add(replaced);
            } else {
                replacedList.add(listVal);
            }
        }
        return replacedList;
    }

    private Object replaceVariables(
            String paramString, DocumentContext documentContext, String taskId) {
        return replaceVariables(paramString, documentContext, taskId, 0);
    }

    private Object replaceVariables(
            String paramString, DocumentContext documentContext, String taskId, int depth) {
        var matcher = PATTERN.matcher(paramString);
        var replacements = new LinkedList<Replacement>();
        while (matcher.find()) {
            var start = matcher.start();
            var end = matcher.end();
            var match = paramString.substring(start, end);
            String rawPath = match.substring(2, match.length() - 1);
            String trimmedRaw = rawPath.trim();
            boolean weaverEnv = trimmedRaw.startsWith(WeaverPlaceholderResolver.ENV_PREFIX);
            boolean weaverSecret = trimmedRaw.startsWith(WeaverPlaceholderResolver.SECRETS_PREFIX);
            if ((weaverEnv || weaverSecret) && rawPath.contains("${")) {
                // A nested name would let workflow data choose which variable or secret is read.
                LOGGER.warn("Nested placeholders are not allowed in '{}'; resolving to null", match);
                replacements.add(new Replacement(null, start, end));
                continue;
            }
            if (weaverSecret) {
                // Deferred: keep the literal reference. It is resolved on an in-memory copy right
                // before the task runs and is never written to the store resolved.
                replacements.add(new Replacement(match, start, end));
                continue;
            }
            if (weaverEnv) {
                Object envValue =
                        placeholders == null
                                ? null
                                : placeholders.resolveEnv(
                                        trimmedRaw.substring(
                                                WeaverPlaceholderResolver.ENV_PREFIX.length()));
                replacements.add(
                        new Replacement(
                                WeaverPlaceholderResolver.escapeSecretReferences(envValue),
                                start,
                                end));
                continue;
            }
            String paramPath =
                    replaceVariables(rawPath, documentContext, taskId, depth + 1).toString();
            // if the paramPath is blank, meaning no value in between ${ and }
            // like ${}, ${  } etc, set the value to empty string
            if (StringUtils.isBlank(paramPath)) {
                replacements.add(new Replacement("", start, end));
                continue;
            }
            if (EnvUtils.isEnvironmentVariable(paramPath)) {
                String sysValue = EnvUtils.getSystemParametersValue(paramPath, taskId);
                if (sysValue != null) {
                    replacements.add(new Replacement(sysValue, start, end));
                }
            } else {
                try {
                    // Values taken from workflow data are inserted as data: any secret reference
                    // text inside them is escaped so it is never resolved later.
                    replacements.add(
                            new Replacement(
                                    WeaverPlaceholderResolver.escapeSecretReferences(
                                            documentContext.read(paramPath)),
                                    start,
                                    end));
                } catch (Exception e) {
                    LOGGER.warn(
                            "Error reading documentContext for paramPath: {}. Exception: {}",
                            paramPath,
                            e);
                    replacements.add(new Replacement(null, start, end));
                }
            }
        }
        if (replacements.size() == 1
                && replacements.getFirst().getStartIndex() == 0
                && replacements.getFirst().getEndIndex() == paramString.length()
                && depth == 0) {
            return replacements.get(0).getReplacement();
        }
        Collections.sort(replacements);
        // Rebuild the string segment by segment. Escapes ($${) are removed from the definition's
        // own text only; inserted values are kept exactly as they are.
        var builder = new StringBuilder();
        int cursor = 0;
        for (var replacement : replacements) {
            builder.append(unescapeTemplate(paramString.substring(cursor, replacement.getStartIndex())));
            builder.append(Objects.toString(replacement.getReplacement()));
            cursor = replacement.getEndIndex();
        }
        builder.append(unescapeTemplate(paramString.substring(cursor)));
        return builder.toString();
    }

    private static String unescapeTemplate(String text) {
        return text.indexOf("$${") < 0
                ? text
                : TEMPLATE_ESCAPE.matcher(text).replaceAll(Matcher.quoteReplacement("${"));
    }

    @Deprecated
    // Workflow schema version 1 is deprecated and new workflows should be using version 2
    private Map<String, Object> getTaskInputV1(
            WorkflowModel workflow, Map<String, Object> inputParams) {
        Map<String, Object> input = new HashMap<>();
        if (inputParams == null) {
            return input;
        }
        Map<String, Object> workflowInput = workflow.getInput();
        inputParams.forEach(
                (paramName, value) -> {
                    String paramPath = "" + value;
                    String[] paramPathComponents = paramPath.split("\\.");
                    Utils.checkArgument(
                            paramPathComponents.length == 3,
                            "Invalid input expression for "
                                    + paramName
                                    + ", paramPathComponents.size="
                                    + paramPathComponents.length
                                    + ", expression="
                                    + paramPath);

                    String source = paramPathComponents[0]; // workflow, or task reference name
                    String type = paramPathComponents[1]; // input/output
                    String name = paramPathComponents[2]; // name of the parameter
                    if ("workflow".equals(source)) {
                        input.put(paramName, workflowInput.get(name));
                    } else {
                        TaskModel task = workflow.getTaskByRefName(source);
                        if (task != null) {
                            if ("input".equals(type)) {
                                input.put(paramName, task.getInputData().get(name));
                            } else {
                                input.put(paramName, task.getOutputData().get(name));
                            }
                        }
                    }
                });
        return input;
    }

    public Map<String, Object> getWorkflowInput(
            WorkflowDef workflowDef, Map<String, Object> inputParams) {
        if (workflowDef != null && workflowDef.getInputTemplate() != null) {
            clone(workflowDef.getInputTemplate()).forEach(inputParams::putIfAbsent);
        }
        return inputParams;
    }

    /**
     * Resolves {@code ${weaver.secrets.NAME}} references in the given input for execution,
     * returning a new structure. The input map is not mutated. Returns the input unchanged when no
     * secrets provider is configured or no reference is present.
     */
    public Map<String, Object> substituteSecrets(Map<String, Object> input) {
        return resolveSecretsForExecution(input).input();
    }

    /**
     * Like {@link #substituteSecrets} but also returns the secret values that were used, so the
     * caller can mask them in task output before anything is persisted.
     */
    public WeaverPlaceholderResolver.SecretResolution resolveSecretsForExecution(
            Map<String, Object> input) {
        if (placeholders == null) {
            return WeaverPlaceholderResolver.SecretResolution.unchanged(input);
        }
        return placeholders.resolveSecrets(input);
    }

    /** The shared placeholder resolver, or {@code null} when none is configured. */
    @Nullable
    public WeaverPlaceholderResolver getPlaceholders() {
        return placeholders;
    }

    private static class Replacement implements Comparable<Replacement> {
        private final int startIndex;
        private final int endIndex;
        private final Object replacement;

        public Replacement(Object replacement, int startIndex, int endIndex) {
            this.replacement = replacement;
            this.startIndex = startIndex;
            this.endIndex = endIndex;
        }

        public Object getReplacement() {
            return replacement;
        }

        public int getStartIndex() {
            return startIndex;
        }

        public int getEndIndex() {
            return endIndex;
        }

        @Override
        public int compareTo(Replacement o) {
            return Long.compare(startIndex, o.startIndex);
        }
    }
}
