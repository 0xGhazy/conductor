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
package com.vodafone.vss.weaver.core.execution.mapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.Before;
import org.junit.Test;

import com.vodafone.vss.weaver.common.metadata.tasks.TaskDef;
import com.vodafone.vss.weaver.common.metadata.tasks.TaskType;
import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef;
import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowTask;
import com.vodafone.vss.weaver.core.utils.IDGenerator;
import com.vodafone.vss.weaver.core.utils.ParametersUtils;
import com.vodafone.vss.weaver.dao.MetadataDAO;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.mockito.Mockito.mock;

public class JsonJQTransformTaskMapperTest {

    private IDGenerator idGenerator;
    private ParametersUtils parametersUtils;
    private MetadataDAO metadataDAO;

    @Before
    public void setUp() {
        parametersUtils = mock(ParametersUtils.class);
        metadataDAO = mock(MetadataDAO.class);
        idGenerator = new IDGenerator();
    }

    @Test
    public void getMappedTasks() {

        WorkflowTask workflowTask = new WorkflowTask();
        workflowTask.setName("json_jq_transform_task");
        workflowTask.setType(TaskType.JSON_JQ_TRANSFORM.name());
        workflowTask.setTaskDefinition(new TaskDef("json_jq_transform_task"));

        Map<String, Object> taskInput = new HashMap<>();
        taskInput.put("in1", new String[] {"a", "b"});
        taskInput.put("in2", new String[] {"c", "d"});
        taskInput.put("queryExpression", "{ out: (.in1 + .in2) }");
        workflowTask.setInputParameters(taskInput);

        String taskId = idGenerator.generate();

        WorkflowDef workflowDef = new WorkflowDef();
        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowDefinition(workflowDef);

        TaskMapperContext taskMapperContext =
                TaskMapperContext.newBuilder()
                        .withWorkflowModel(workflow)
                        .withTaskDefinition(new TaskDef())
                        .withWorkflowTask(workflowTask)
                        .withTaskInput(taskInput)
                        .withRetryCount(0)
                        .withTaskId(taskId)
                        .build();

        List<TaskModel> mappedTasks =
                new JsonJQTransformTaskMapper(parametersUtils, metadataDAO)
                        .getMappedTasks(taskMapperContext);

        assertEquals(1, mappedTasks.size());
        assertNotNull(mappedTasks);
        assertEquals(TaskType.JSON_JQ_TRANSFORM.name(), mappedTasks.get(0).getTaskType());
    }

    @Test
    public void getMappedTasks_WithoutTaskDef() {
        WorkflowTask workflowTask = new WorkflowTask();
        workflowTask.setName("json_jq_transform_task");
        workflowTask.setType(TaskType.JSON_JQ_TRANSFORM.name());

        Map<String, Object> taskInput = new HashMap<>();
        taskInput.put("in1", new String[] {"a", "b"});
        taskInput.put("in2", new String[] {"c", "d"});
        taskInput.put("queryExpression", "{ out: (.in1 + .in2) }");
        workflowTask.setInputParameters(taskInput);

        String taskId = idGenerator.generate();

        WorkflowDef workflowDef = new WorkflowDef();
        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowDefinition(workflowDef);

        TaskMapperContext taskMapperContext =
                TaskMapperContext.newBuilder()
                        .withWorkflowModel(workflow)
                        .withTaskDefinition(null)
                        .withWorkflowTask(workflowTask)
                        .withTaskInput(taskInput)
                        .withRetryCount(0)
                        .withTaskId(taskId)
                        .build();

        List<TaskModel> mappedTasks =
                new JsonJQTransformTaskMapper(parametersUtils, metadataDAO)
                        .getMappedTasks(taskMapperContext);

        assertEquals(1, mappedTasks.size());
        assertNotNull(mappedTasks);
        assertEquals(TaskType.JSON_JQ_TRANSFORM.name(), mappedTasks.get(0).getTaskType());
    }
}
