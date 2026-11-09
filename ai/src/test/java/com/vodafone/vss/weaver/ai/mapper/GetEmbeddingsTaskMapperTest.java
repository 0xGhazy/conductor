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
package com.vodafone.vss.weaver.ai.mapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.vodafone.vss.weaver.ai.tasks.mapper.GetEmbeddingsTaskMapper;
import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.common.metadata.tasks.TaskDef;
import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef;
import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowTask;
import com.vodafone.vss.weaver.core.exception.TerminateWorkflowException;
import com.vodafone.vss.weaver.core.execution.mapper.TaskMapperContext;
import com.vodafone.vss.weaver.core.utils.IDGenerator;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import static com.vodafone.vss.weaver.ai.tasks.mapper.AIModelTaskMapper.EMBEDDINGS;
import static com.vodafone.vss.weaver.ai.tasks.mapper.AIModelTaskMapper.INDEX;
import static com.vodafone.vss.weaver.ai.tasks.mapper.AIModelTaskMapper.VECTOR_DB;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class GetEmbeddingsTaskMapperTest {

    @Test
    public void testTaskMapperValidations() {
        // Given
        String taskType = "LLM_GET_EMBEDDINGS";
        WorkflowTask workflowTask = new WorkflowTask();
        workflowTask.setName("get_embeddings_task");
        workflowTask.setType(taskType);
        String vectorDb = "pineconedb";
        String index = "some-index";
        String taskId = new IDGenerator().generate();

        WorkflowModel workflow = new WorkflowModel();
        WorkflowDef workflowDef = new WorkflowDef();
        workflow.setWorkflowDefinition(workflowDef);

        TaskMapperContext taskMapperContext =
                getTaskMapperContext(workflow, workflowTask, taskId, null);

        GetEmbeddingsTaskMapper getEmbeddingsTaskMapper = new GetEmbeddingsTaskMapper();
        // Without any input parameters
        try {
            getEmbeddingsTaskMapper.getMappedTasks(taskMapperContext);
        } catch (TerminateWorkflowException e) {
            assertEquals(
                    "No Vector database provided. Please provide it using 'vectorDB' input parameter",
                    e.getMessage());
        }
        // We add 'vectorDB' input parameter
        Map<String, Object> taskInputs = new HashMap<>();
        taskInputs.put(VECTOR_DB, vectorDb);
        taskMapperContext = getTaskMapperContext(workflow, workflowTask, taskId, taskInputs);
        try {
            getEmbeddingsTaskMapper.getMappedTasks(taskMapperContext);
        } catch (TerminateWorkflowException e) {
            assertEquals(
                    "No index provided. Please provide it using 'index' input parameter",
                    e.getMessage());
        }

        // We add 'index' input parameter
        taskInputs.put(INDEX, index);
        taskMapperContext = getTaskMapperContext(workflow, workflowTask, taskId, taskInputs);
        try {
            getEmbeddingsTaskMapper.getMappedTasks(taskMapperContext);
        } catch (TerminateWorkflowException e) {
            assertEquals(
                    "No embeddings provided. Please provide them using 'embeddings' input parameter",
                    e.getMessage());
        }

        // We add 'embeddings' input parameter
        taskInputs.put(EMBEDDINGS, List.of(1.0F));
        taskMapperContext = getTaskMapperContext(workflow, workflowTask, taskId, taskInputs);
        try {
            getEmbeddingsTaskMapper.getMappedTasks(taskMapperContext);
        } catch (TerminateWorkflowException e) {
            assertEquals(
                    "User anonymous does not have access to the index "
                            + index
                            + " from database "
                            + vectorDb,
                    e.getMessage());
        }

        // Now we use the mocked OrkesPermissionEvaluator
        getEmbeddingsTaskMapper = new GetEmbeddingsTaskMapper();

        List<TaskModel> mappedTasks = getEmbeddingsTaskMapper.getMappedTasks(taskMapperContext);
        assertEquals(1, mappedTasks.size());
        assertEquals(taskType, mappedTasks.get(0).getTaskType());
        assertEquals(TaskModel.Status.SCHEDULED, mappedTasks.get(0).getStatus());
    }

    protected TaskMapperContext getTaskMapperContext(
            WorkflowModel workflowModel,
            WorkflowTask workflowTask,
            String taskId,
            Map<String, Object> inputs) {
        return TaskMapperContext.newBuilder()
                .withWorkflowModel(workflowModel)
                .withTaskDefinition(new TaskDef())
                .withWorkflowTask(workflowTask)
                .withTaskInput(inputs != null ? inputs : new HashMap<>())
                .withRetryCount(0)
                .withTaskId(taskId)
                .build();
    }
}
