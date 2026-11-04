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

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import static com.vodafone.vss.weaver.core.execution.tasks.Terminate.getTerminationStatusParameter;
import static com.vodafone.vss.weaver.core.execution.tasks.Terminate.getTerminationWorkflowOutputParameter;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;

public class TestTerminate {

    private final WorkflowExecutor executor = mock(WorkflowExecutor.class);

    @Test
    public void should_fail_if_input_status_is_not_valid() {
        WorkflowModel workflow = new WorkflowModel();
        Terminate terminateTask = new Terminate();

        Map<String, Object> input = new HashMap<>();
        input.put(getTerminationStatusParameter(), "PAUSED");

        TaskModel task = new TaskModel();
        task.getInputData().putAll(input);
        terminateTask.execute(workflow, task, executor);
        assertEquals(TaskModel.Status.FAILED, task.getStatus());
    }

    @Test
    public void should_fail_if_input_status_is_empty() {
        WorkflowModel workflow = new WorkflowModel();
        Terminate terminateTask = new Terminate();

        Map<String, Object> input = new HashMap<>();
        input.put(getTerminationStatusParameter(), "");

        TaskModel task = new TaskModel();
        task.getInputData().putAll(input);
        terminateTask.execute(workflow, task, executor);
        assertEquals(TaskModel.Status.FAILED, task.getStatus());
    }

    @Test
    public void should_fail_if_input_status_is_null() {
        WorkflowModel workflow = new WorkflowModel();
        Terminate terminateTask = new Terminate();

        Map<String, Object> input = new HashMap<>();
        input.put(getTerminationStatusParameter(), null);

        TaskModel task = new TaskModel();
        task.getInputData().putAll(input);
        terminateTask.execute(workflow, task, executor);
        assertEquals(TaskModel.Status.FAILED, task.getStatus());
    }

    @Test
    public void should_complete_workflow_on_terminate_task_success() {
        WorkflowModel workflow = new WorkflowModel();
        Terminate terminateTask = new Terminate();
        workflow.setOutput(Collections.singletonMap("output", "${task1.output.value}"));

        HashMap<String, Object> expectedOutput =
                new HashMap<>() {
                    {
                        put("output", "${task0.output.value}");
                    }
                };

        Map<String, Object> input = new HashMap<>();
        input.put(getTerminationStatusParameter(), "COMPLETED");
        input.put(getTerminationWorkflowOutputParameter(), "${task0.output.value}");

        TaskModel task = new TaskModel();
        task.getInputData().putAll(input);
        terminateTask.execute(workflow, task, executor);
        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertEquals(expectedOutput, task.getOutputData());
    }

    @Test
    public void should_fail_workflow_on_terminate_task_success() {
        WorkflowModel workflow = new WorkflowModel();
        Terminate terminateTask = new Terminate();
        workflow.setOutput(Collections.singletonMap("output", "${task1.output.value}"));

        HashMap<String, Object> expectedOutput =
                new HashMap<>() {
                    {
                        put("output", "${task0.output.value}");
                    }
                };

        Map<String, Object> input = new HashMap<>();
        input.put(getTerminationStatusParameter(), "FAILED");
        input.put(getTerminationWorkflowOutputParameter(), "${task0.output.value}");

        TaskModel task = new TaskModel();
        task.getInputData().putAll(input);
        terminateTask.execute(workflow, task, executor);
        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertEquals(expectedOutput, task.getOutputData());
    }

    @Test
    public void should_fail_workflow_on_terminate_task_success_with_empty_output() {
        WorkflowModel workflow = new WorkflowModel();
        Terminate terminateTask = new Terminate();

        Map<String, Object> input = new HashMap<>();
        input.put(getTerminationStatusParameter(), "FAILED");

        TaskModel task = new TaskModel();
        task.getInputData().putAll(input);
        terminateTask.execute(workflow, task, executor);
        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertTrue(task.getOutputData().isEmpty());
    }

    @Test
    public void should_fail_workflow_on_terminate_task_success_with_resolved_output() {
        WorkflowModel workflow = new WorkflowModel();
        Terminate terminateTask = new Terminate();

        HashMap<String, Object> expectedOutput =
                new HashMap<>() {
                    {
                        put("result", 1);
                    }
                };

        Map<String, Object> input = new HashMap<>();
        input.put(getTerminationStatusParameter(), "FAILED");
        input.put(getTerminationWorkflowOutputParameter(), expectedOutput);

        TaskModel task = new TaskModel();
        task.getInputData().putAll(input);
        terminateTask.execute(workflow, task, executor);
        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
    }

    @Test
    public void resolves_translated_message_into_output() {
        com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef def =
                new com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef();
        def.setName("shop");
        def.setVersion(1);
        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowDefinition(def);
        workflow.setInput(new HashMap<>(Map.of("_language", "ar-EG")));

        Terminate terminateTask = new Terminate();
        terminateTask.setMessageResolver(
                new com.vodafone.vss.weaver.core.messages.MessageResolver(
                        (name, version, code) ->
                                Map.of("en-US", "Order ${orderId} placed", "ar-EG", "تم الطلب ${orderId}"),
                        null,
                        "en-US"));

        TaskModel task = new TaskModel();
        task.getInputData().put(getTerminationStatusParameter(), "COMPLETED");
        task.getInputData().put(getTerminationWorkflowOutputParameter(), Map.of("orderId", "1001"));
        task.getInputData().put(Terminate.MESSAGE_CODE_PARAMETER, "ORDER_PLACED");
        task.getInputData().put(Terminate.VARIABLES_PARAMETER, Map.of("orderId", "1001"));

        assertTrue(terminateTask.execute(workflow, task, executor));
        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertEquals("1001", task.getOutputData().get("orderId"));
        assertEquals("ORDER_PLACED", task.getOutputData().get(Terminate.OUTPUT_RESPONSE_CODE));
        assertEquals("ar-EG", task.getOutputData().get(Terminate.OUTPUT_LANGUAGE_CODE));
        assertEquals("تم الطلب 1001", task.getOutputData().get(Terminate.OUTPUT_MESSAGE));
    }

    @Test
    public void message_code_without_resolver_returns_the_code() {
        Terminate terminateTask = new Terminate();
        TaskModel task = new TaskModel();
        task.getInputData().put(getTerminationStatusParameter(), "FAILED");
        task.getInputData().put(Terminate.MESSAGE_CODE_PARAMETER, "PAYMENT_DECLINED");

        terminateTask.execute(new WorkflowModel(), task, executor);

        assertEquals("PAYMENT_DECLINED", task.getOutputData().get(Terminate.OUTPUT_MESSAGE));
    }

    @Test
    public void without_message_code_output_is_unchanged() {
        Terminate terminateTask = new Terminate();
        TaskModel task = new TaskModel();
        task.getInputData().put(getTerminationStatusParameter(), "COMPLETED");
        task.getInputData().put(getTerminationWorkflowOutputParameter(), Map.of("a", "b"));

        terminateTask.execute(new WorkflowModel(), task, executor);

        assertEquals(Map.of("a", "b"), task.getOutputData());
    }
}
