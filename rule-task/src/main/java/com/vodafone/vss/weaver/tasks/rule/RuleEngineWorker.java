package com.vodafone.vss.weaver.tasks.rule;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.core.execution.WorkflowExecutor;
import com.vodafone.vss.weaver.core.execution.tasks.WorkflowSystemTask;
import com.vodafone.vss.weaver.model.TaskModel;
import com.vodafone.vss.weaver.model.WorkflowModel;
import com.vodafone.vss.weaver.tasks.rule.service.RuleEvaluatorService;

@Component("RuleEngineWorker")
public class RuleEngineWorker extends WorkflowSystemTask {

    private static final Logger log = LoggerFactory.getLogger(RuleEngineWorker.class);
    public static final String TASK_TYPE = "RuleEngineWorker";

    private final RuleEvaluatorService ruleEvaluatorService;

    @Autowired
    public RuleEngineWorker(RuleEvaluatorService ruleEvaluatorService) {
        this(TASK_TYPE, ruleEvaluatorService);
    }

    protected RuleEngineWorker(String name, RuleEvaluatorService ruleEvaluatorService) {
        super(name);
        this.ruleEvaluatorService = ruleEvaluatorService;
        log.info("{} system task initialized", name);
    }

    @Override
    public boolean isAsync() {
        return false;
    }

    @Override
    public void start(WorkflowModel workflow, TaskModel task, WorkflowExecutor executor) {
        String taskId = task.getTaskId();
        String workflowId = workflow != null ? workflow.getWorkflowId() : task.getWorkflowInstanceId();
        log.info("Starting RuleEngineWorker: taskId={}, workflowId={}", taskId, workflowId);

        Map<String, Object> inputData = task.getInputData();
        if (inputData == null || inputData.isEmpty()) {
            task.setStatus(TaskModel.Status.FAILED);
            task.setReasonForIncompletion("Inputs are missing");
            return;
        }

        Object rules = inputData.get("rules");
        Object rawVars = inputData.get("variables");
        Map<String, Object> variables = new HashMap<>();

        if (rawVars instanceof Map<?, ?> map) {
            map.forEach((k, v) -> variables.put(String.valueOf(k), v));
        }

        // Also merge flat inputData variables except 'rules'
        inputData.forEach(
                (k, v) -> {
                    if (!"rules".equals(k) && !"variables".equals(k)) {
                        variables.putIfAbsent(k, v);
                    }
                });

        try {
            long startMs = System.currentTimeMillis();
            Object evaluationResult = ruleEvaluatorService.evaluateRules(rules, variables);
            long durationMs = System.currentTimeMillis() - startMs;

            boolean result = Boolean.TRUE.equals(evaluationResult);

            Map<String, Object> output = new HashMap<>();
            output.put("result", result);
            output.put("evaluationResult", evaluationResult);
            output.put("executionTimeMs", durationMs);

            task.setOutputData(output);
            task.setStatus(TaskModel.Status.COMPLETED);
            log.info(
                    "RuleEngineWorker completed: taskId={}, result={}, durationMs={}",
                    taskId,
                    result,
                    durationMs);
        } catch (Exception ex) {
            log.error("RuleEngineWorker failed: taskId={}, error={}", taskId, ex.getMessage(), ex);
            task.setStatus(TaskModel.Status.FAILED);
            task.setReasonForIncompletion("Rule evaluation failed: " + ex.getMessage());
        }
    }
}

