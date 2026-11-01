package com.vodafone.vss.weaver.tasks.rule;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.rule.service.RuleEvaluatorService;

import com.fasterxml.jackson.databind.ObjectMapper;

class RuleEngineWorkerTest {

    private RuleEngineWorker worker;

    @BeforeEach
    void setUp() {
        RuleEvaluatorService service = new RuleEvaluatorService(new ObjectMapper());
        worker = new RuleEngineWorker(service);
    }

    @Test
    void testStartRuleEngineWorkerSuccess() {
        TaskModel task = new TaskModel();
        task.setTaskId("task-rule-1");

        Map<String, Object> inputData = new HashMap<>();
        inputData.put("rules", Map.of("field", "status", "operator", "EQ", "value", "OK"));
        inputData.put("variables", Map.of("status", "OK"));
        task.setInputData(inputData);

        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowId("wf-1");

        worker.start(workflow, task, null);

        assertEquals(TaskModel.Status.COMPLETED, task.getStatus());
        assertNotNull(task.getOutputData());
        assertEquals(true, task.getOutputData().get("result"));
    }

    @Test
    void testStartRuleEngineWorkerMissingInput() {
        TaskModel task = new TaskModel();
        task.setTaskId("task-rule-2");
        task.setInputData(null);

        WorkflowModel workflow = new WorkflowModel();
        workflow.setWorkflowId("wf-2");

        worker.start(workflow, task, null);

        assertEquals(TaskModel.Status.FAILED, task.getStatus());
        assertEquals("Inputs are missing", task.getReasonForIncompletion());
    }
}

