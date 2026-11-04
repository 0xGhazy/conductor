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
package com.vodafone.vss.weaver.core.execution.tasks;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.core.messages.MessageResolver;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import static com.vodafone.vss.weaver.common.metadata.tasks.TaskType.TASK_TYPE_TERMINATE;
import static com.vodafone.vss.weaver.common.run.Workflow.WorkflowStatus.*;

/**
 * Ends the workflow with a given status and output, like a "return" statement.
 *
 * <pre>
 * {
 *   "name": "terminate",
 *   "taskReferenceName": "terminate0",
 *   "type": "TERMINATE",
 *   "inputParameters": {
 *     "terminationStatus": "COMPLETED",
 *     "workflowOutput": "${task0.output}",
 *     "messageCode": "ORDER_CONFIRMED",
 *     "languageCode": "${workflow.input._language}",
 *     "variables": { "orderId": "${task0.output.id}" }
 *   }
 * }
 * </pre>
 *
 * <ul>
 *   <li>{@code terminationStatus} is required: {@code COMPLETED}, {@code FAILED} or {@code
 *       TERMINATED}. The task cannot be optional.
 *   <li>{@code workflowOutput} becomes the workflow output. A map is merged in as is; any other
 *       value is stored under {@code output}.
 *   <li>{@code terminationReason} is the workflow's reason for incompletion when it ends FAILED or
 *       TERMINATED.
 *   <li>{@code messageCode} (optional) resolves a translated message through {@link
 *       MessageResolver}: the language is {@code languageCode}, else the workflow input {@code
 *       _language}, else the workflow's default language. The result is added to the output as
 *       {@code responseCode}, {@code languageCode} and {@code message}, and is used as the reason
 *       for incompletion when no {@code terminationReason} is given. {@code variables} fill the
 *       message template.
 * </ul>
 */
@Component(TASK_TYPE_TERMINATE)
public class Terminate extends WorkflowSystemTask {

    private static final String TERMINATION_STATUS_PARAMETER = "terminationStatus";
    private static final String TERMINATION_REASON_PARAMETER = "terminationReason";
    private static final String TERMINATION_WORKFLOW_OUTPUT = "workflowOutput";

    public static final String MESSAGE_CODE_PARAMETER = "messageCode";
    public static final String LANGUAGE_CODE_PARAMETER = "languageCode";
    public static final String VARIABLES_PARAMETER = "variables";

    public static final String OUTPUT_RESPONSE_CODE = "responseCode";
    public static final String OUTPUT_LANGUAGE_CODE = "languageCode";
    public static final String OUTPUT_MESSAGE = "message";

    private MessageResolver messageResolver;

    public Terminate() {
        super(TASK_TYPE_TERMINATE);
    }

    /** Optional: without it, a {@code messageCode} resolves to the code itself. */
    @Autowired(required = false)
    public void setMessageResolver(MessageResolver messageResolver) {
        this.messageResolver = messageResolver;
    }

    @Override
    public boolean execute(
            WorkflowModel workflow, TaskModel task, WorkflowExecutor workflowExecutor) {
        String returnStatus = (String) task.getInputData().get(TERMINATION_STATUS_PARAMETER);

        if (validateInputStatus(returnStatus)) {
            Map<String, Object> output = getInputFromParam(task.getInputData());
            addResolvedMessage(workflow, task.getInputData(), output);
            task.setOutputData(output);
            task.setStatus(TaskModel.Status.COMPLETED);
            return true;
        }
        task.setReasonForIncompletion("given termination status is not valid");
        task.setStatus(TaskModel.Status.FAILED);
        return false;
    }

    public static String getTerminationStatusParameter() {
        return TERMINATION_STATUS_PARAMETER;
    }

    public static String getTerminationReasonParameter() {
        return TERMINATION_REASON_PARAMETER;
    }

    public static String getTerminationWorkflowOutputParameter() {
        return TERMINATION_WORKFLOW_OUTPUT;
    }

    public static Boolean validateInputStatus(String status) {
        return COMPLETED.name().equals(status)
                || FAILED.name().equals(status)
                || TERMINATED.name().equals(status);
    }

    /** True when the task's input asks for a translated message. */
    public static boolean hasMessageCode(Map<String, Object> taskInput) {
        Object code = taskInput != null ? taskInput.get(MESSAGE_CODE_PARAMETER) : null;
        return code != null && !String.valueOf(code).isBlank();
    }

    /**
     * Adds responseCode, languageCode and message to the output when a messageCode is given. These
     * keys win over same-named keys from workflowOutput.
     */
    @SuppressWarnings("unchecked")
    private void addResolvedMessage(
            WorkflowModel workflow, Map<String, Object> input, Map<String, Object> output) {
        if (!hasMessageCode(input)) {
            return;
        }
        String messageCode = String.valueOf(input.get(MESSAGE_CODE_PARAMETER)).trim();
        if (messageResolver == null || workflow == null) {
            output.put(OUTPUT_RESPONSE_CODE, messageCode);
            output.put(OUTPUT_MESSAGE, messageCode);
            return;
        }
        Object language = input.get(LANGUAGE_CODE_PARAMETER);
        Object variables = input.get(VARIABLES_PARAMETER);
        MessageResolver.ResolvedMessage resolved =
                messageResolver.resolve(
                        workflow,
                        messageCode,
                        language != null ? String.valueOf(language) : null,
                        variables instanceof Map ? (Map<String, Object>) variables : null);
        output.put(OUTPUT_RESPONSE_CODE, resolved.messageCode());
        output.put(OUTPUT_LANGUAGE_CODE, resolved.languageCode());
        output.put(OUTPUT_MESSAGE, resolved.message());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getInputFromParam(Map<String, Object> taskInput) {
        HashMap<String, Object> output = new HashMap<>();
        Object workflowOutput = taskInput.get(TERMINATION_WORKFLOW_OUTPUT);
        if (workflowOutput == null) {
            return output;
        }
        if (workflowOutput instanceof Map) {
            output.putAll((Map<String, Object>) workflowOutput);
            return output;
        }
        output.put("output", workflowOutput);
        return output;
    }
}
