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

import java.util.Arrays;
import java.util.List;

import org.junit.Test;

import com.vodafone.vss.weaver.common.metadata.tasks.TaskDef;
import com.vodafone.vss.weaver.common.metadata.tasks.TaskType;
import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowDef;
import com.vodafone.vss.weaver.common.metadata.workflow.WorkflowTask;
import com.vodafone.vss.weaver.core.utils.IDGenerator;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;

import static com.vodafone.vss.weaver.common.metadata.tasks.TaskType.TASK_TYPE_JOIN;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

public class JoinTaskMapperTest {

    @Test
    public void getMappedTasks() {

        WorkflowTask workflowTask = new WorkflowTask();
        workflowTask.setType(TaskType.JOIN.name());
        workflowTask.setJoinOn(Arrays.asList("task1", "task2"));

        String taskId = new IDGenerator().generate();

        WorkflowDef wd = new WorkflowDef();
        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowDefinition(wd);

        TaskMapperContext taskMapperContext =
                TaskMapperContext.newBuilder()
                        .withWorkflowModel(workflow)
                        .withTaskDefinition(new TaskDef())
                        .withWorkflowTask(workflowTask)
                        .withRetryCount(0)
                        .withTaskId(taskId)
                        .build();

        List<TaskModel> mappedTasks = new JoinTaskMapper().getMappedTasks(taskMapperContext);

        assertNotNull(mappedTasks);
        assertEquals(TASK_TYPE_JOIN, mappedTasks.get(0).getTaskType());
    }

    @Test
    public void getMappedTasksWithJoinMode() {

        WorkflowTask workflowTask = new WorkflowTask();
        workflowTask.setType(TaskType.JOIN.name());
        workflowTask.setJoinOn(Arrays.asList("task1", "task2"));
        workflowTask.setJoinMode(WorkflowTask.JoinMode.SYNC);

        String taskId = new IDGenerator().generate();

        WorkflowDef wd = new WorkflowDef();
        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowDefinition(wd);

        TaskMapperContext taskMapperContext =
                TaskMapperContext.newBuilder()
                        .withWorkflowModel(workflow)
                        .withTaskDefinition(new TaskDef())
                        .withWorkflowTask(workflowTask)
                        .withRetryCount(0)
                        .withTaskId(taskId)
                        .build();

        List<TaskModel> mappedTasks = new JoinTaskMapper().getMappedTasks(taskMapperContext);

        assertNotNull(mappedTasks);
        assertEquals(TASK_TYPE_JOIN, mappedTasks.get(0).getTaskType());
        // joinMode is read directly from workflowTask, not injected into input data
        assertNull(mappedTasks.get(0).getInputData().get("joinMode"));
        assertEquals(
                WorkflowTask.JoinMode.SYNC, mappedTasks.get(0).getWorkflowTask().getJoinMode());
    }
}
