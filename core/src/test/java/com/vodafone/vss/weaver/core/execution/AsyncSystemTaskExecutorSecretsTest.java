/*
 * Copyright 2026 Weaver Contributors.
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
package com.vodafone.vss.weaver.core.execution;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.conductoross.conductor.dao.SecretsDAO;
import org.junit.Before;
import org.junit.Test;

import com.vodafone.vss.weaver.core.config.ConductorProperties;
import com.vodafone.vss.weaver.core.dal.ExecutionDAOFacade;
import com.vodafone.vss.weaver.core.execution.tasks.WorkflowSystemTask;
import com.vodafone.vss.weaver.core.utils.ParametersUtils;
import com.vodafone.vss.weaver.dao.EnvironmentDAO;
import com.vodafone.vss.weaver.dao.MetadataDAO;
import com.vodafone.vss.weaver.dao.QueueDAO;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies that resolved {@code ${weaver.secrets.*}} values never reach the execution store when
 * an async system task runs: every write carries the literal reference, and a resolved value the
 * task copies into its output is masked before the final write.
 */
public class AsyncSystemTaskExecutorSecretsTest {

    private static final String TASK_ID = "taskid";
    private static final String WORKFLOW_ID = "wfid";
    private static final String SECRET = "s3cr3t-value";

    private ExecutionDAOFacade executionDAOFacade;
    private AsyncSystemTaskExecutor executor;
    private WorkflowSystemTask systemTask;
    private TaskModel task;
    private Map<String, Object> literal;
    private final List<Map<String, Object>> persistedInputs = new ArrayList<>();
    private final List<Map<String, Object>> persistedOutputs = new ArrayList<>();
    private final List<Map<String, Object>> seenDuringStart = new ArrayList<>();

    @Before
    public void setUp() {
        executionDAOFacade = mock(ExecutionDAOFacade.class);
        SecretsDAO secretsDAO = mock(SecretsDAO.class);
        when(secretsDAO.getSecret("DB_PASSWORD")).thenReturn(SECRET);
        // Real resolution and masking, backed by a mocked secrets store.
        ParametersUtils parametersUtils =
                new ParametersUtils(new ObjectMapper(), mock(EnvironmentDAO.class), secretsDAO);

        ConductorProperties properties = new ConductorProperties();
        properties.setTaskExecutionPostponeDuration(Duration.ofSeconds(1));
        properties.setSystemTaskWorkerCallbackDuration(Duration.ofSeconds(1));
        executor =
                new AsyncSystemTaskExecutor(
                        executionDAOFacade,
                        mock(QueueDAO.class),
                        mock(MetadataDAO.class),
                        properties,
                        mock(WorkflowExecutor.class),
                        parametersUtils);

        literal = new HashMap<>();
        literal.put("pwd", "${weaver.secrets.DB_PASSWORD}");

        task = new TaskModel();
        task.setTaskId(TASK_ID);
        task.setTaskType("HTTP");
        task.setStatus(TaskModel.Status.SCHEDULED);
        task.setWorkflowInstanceId(WORKFLOW_ID);
        task.setInputData(literal);

        WorkflowModel workflow = new WorkflowModel();
        workflow.setStatus(WorkflowModel.Status.RUNNING);

        systemTask = mock(WorkflowSystemTask.class);
        when(systemTask.getTaskType()).thenReturn("HTTP");
        when(systemTask.isTaskRetrievalRequired()).thenReturn(true);
        when(systemTask.resolvesSecrets()).thenReturn(true);

        when(executionDAOFacade.getTaskModel(TASK_ID)).thenReturn(task);
        when(executionDAOFacade.getWorkflowModel(any(), anyBoolean())).thenReturn(workflow);

        // Snapshot the input and output at every write.
        doAnswer(
                        invocation -> {
                            TaskModel written = invocation.getArgument(0);
                            persistedInputs.add(new HashMap<>(written.getInputData()));
                            persistedOutputs.add(new HashMap<>(written.getOutputData()));
                            return null;
                        })
                .when(executionDAOFacade)
                .updateTask(any(TaskModel.class));
    }

    @Test
    public void scheduledTaskPersistsOnlyLiteralSecretReferences() {
        doAnswer(
                        invocation -> {
                            TaskModel started = invocation.getArgument(1);
                            seenDuringStart.add(new HashMap<>(started.getInputData()));
                            return null;
                        })
                .when(systemTask)
                .start(any(), any(), any());

        executor.execute(systemTask, TASK_ID);

        verify(systemTask).start(any(), any(), any());
        assertEquals("start() must see resolved secrets", List.of(Map.of("pwd", SECRET)), seenDuringStart);
        // Two writes: startTime before start(), and the final write in finally.
        assertEquals(2, persistedInputs.size());
        for (Map<String, Object> written : persistedInputs) {
            assertEquals("resolved secret was persisted", literal, written);
        }
        assertEquals(literal, task.getInputData());
        assertTrue(task.getStartTime() > 0);
    }

    @Test
    public void resolvedSecretCopiedIntoOutputIsMaskedBeforeItIsPersisted() {
        doAnswer(
                        invocation -> {
                            TaskModel started = invocation.getArgument(1);
                            // A task that echoes its input, e.g. an HTTP call to an echo endpoint.
                            started.getOutputData().put("echo", "pwd=" + started.getInputData().get("pwd"));
                            started.setReasonForIncompletion("failed with " + started.getInputData().get("pwd"));
                            return null;
                        })
                .when(systemTask)
                .start(any(), any(), any());

        executor.execute(systemTask, TASK_ID);

        Map<String, Object> lastWrite = persistedOutputs.get(persistedOutputs.size() - 1);
        assertEquals("pwd=******", lastWrite.get("echo"));
        assertEquals("failed with ******", task.getReasonForIncompletion());
    }
}
