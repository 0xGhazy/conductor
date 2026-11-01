package com.vodafone.vss.weaver.tasks.rule;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.tasks.rule.service.RuleEvaluatorService;

@Component("RULE_ENGINE")
public class RuleSystemTask extends RuleEngineWorker {

    public static final String TASK_TYPE = "RULE_ENGINE";

    @Autowired
    public RuleSystemTask(RuleEvaluatorService ruleEvaluatorService) {
        super(TASK_TYPE, ruleEvaluatorService);
    }
}

