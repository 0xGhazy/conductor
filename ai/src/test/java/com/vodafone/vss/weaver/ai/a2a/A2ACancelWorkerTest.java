/*
 * Copyright 2026 Conductor Authors.
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
package com.vodafone.vss.weaver.ai.a2a;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.vodafone.vss.weaver.ai.a2a.model.A2ATask;
import com.vodafone.vss.weaver.ai.a2a.model.TaskState;
import com.vodafone.vss.weaver.ai.a2a.model.TaskStatus;
import com.vodafone.vss.weaver.ai.agent.WeaverAgentCancelRequest;
import com.vodafone.vss.weaver.ai.agent.WeaverAgentClient;
import com.vodafone.vss.weaver.ai.model.A2ACancelResult;
import com.vodafone.vss.weaver.ai.tasks.worker.A2AWorkers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.common.metadata.tasks.Task;
import com.vodafone.vss.weaver.common.metadata.tasks.TaskResult;

import static com.vodafone.vss.weaver.ai.a2a.A2AWorkerTestSupport.invokeCancel;
import static com.vodafone.vss.weaver.ai.a2a.A2AWorkerTestSupport.invokeCancelOutput;
import static com.vodafone.vss.weaver.ai.a2a.A2AWorkerTestSupport.task;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class A2ACancelWorkerTest {

    private A2AService a2aService;
    private WeaverAgentClient WeaverAgentClient;
    private A2AWorkers workers;

    @BeforeEach
    void setUp() {
        a2aService = mock(A2AService.class);
        WeaverAgentClient = mock(WeaverAgentClient.class);
        when(WeaverAgentClient.agentType()).thenReturn("conductor");
        workers = new A2AWorkers(a2aService, List.of(WeaverAgentClient));
    }

    @Test
    void a2aCallsService() {
        A2ATask canceled = new A2ATask();
        TaskStatus status = new TaskStatus();
        status.setState(TaskState.CANCELED);
        canceled.setStatus(status);
        when(a2aService.cancelTask(eq("http://agent"), eq("t1"), any())).thenReturn(canceled);

        Map<String, Object> input = new HashMap<>();
        input.put("agentUrl", "http://agent");
        input.put("taskId", "t1");

        Task task = task(input);
        A2ACancelResult result = invokeCancelOutput(workers, task);

        assertEquals(Task.Status.COMPLETED, task.getStatus());
        assertEquals(TaskState.CANCELED, result.getTask().getStatus().getState());
        verify(a2aService).cancelTask(eq("http://agent"), eq("t1"), any());
    }

    @Test
    void a2aMissingTaskIdIsNonRetryable() {
        TaskResult result = invokeCancel(workers, task(Map.of("agentUrl", "http://agent")));

        assertEquals(TaskResult.Status.FAILED_WITH_TERMINAL_ERROR, result.getStatus());
    }

    @Test
    void conductorTerminatesExecution() {
        Task task =
                task(
                        Map.of(
                                "agentType",
                                "conductor",
                                "executionId",
                                "exec-1",
                                "reason",
                                "user requested"));

        A2ACancelResult result = invokeCancelOutput(workers, task);

        assertEquals(Task.Status.COMPLETED, task.getStatus());
        assertEquals("exec-1", result.getExecutionId());
        assertEquals(Boolean.TRUE, result.getCanceled());
        verify(WeaverAgentClient)
                .cancelAgent(
                        WeaverAgentCancelRequest.builder()
                                .executionId("exec-1")
                                .reason("user requested")
                                .build());
    }

    @Test
    void conductorDefaultsReasonWhenBlank() {
        invokeCancel(workers, task(Map.of("agentType", "conductor", "executionId", "exec-1")));

        verify(WeaverAgentClient)
                .cancelAgent(
                        WeaverAgentCancelRequest.builder()
                                .executionId("exec-1")
                                .reason("Cancelled by CANCEL_AGENT task")
                                .build());
    }

    @Test
    void conductorMissingExecutionIdIsNonRetryable() {
        TaskResult result = invokeCancel(workers, task(Map.of("agentType", "conductor")));

        assertEquals(TaskResult.Status.FAILED_WITH_TERMINAL_ERROR, result.getStatus());
    }

    @Test
    void unsupportedAgentTypeIsNonRetryable() {
        TaskResult result = invokeCancel(workers, task(Map.of("agentType", "langgraph")));

        assertEquals(TaskResult.Status.FAILED_WITH_TERMINAL_ERROR, result.getStatus());
    }
}
