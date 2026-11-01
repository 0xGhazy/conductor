package com.vodafone.vss.weaver.tasks.rule.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

class RuleEvaluatorServiceTest {

    private RuleEvaluatorService service;

    @BeforeEach
    void setUp() {
        service = new RuleEvaluatorService(new ObjectMapper());
    }

    @Test
    void testSimpleEqualRule() {
        Map<String, Object> rule =
                Map.of("field", "status", "operator", "EQ", "value", "ACTIVE");
        Map<String, Object> vars = Map.of("status", "ACTIVE");

        Object result = service.evaluateRules(rule, vars);
        assertEquals(true, result);
    }

    @Test
    void testNumericComparisonRule() {
        Map<String, Object> rule = Map.of("field", "age", "operator", "GT", "value", 18);
        Map<String, Object> vars = Map.of("age", 25);

        Object result = service.evaluateRules(rule, vars);
        assertEquals(true, result);

        Map<String, Object> varsYoung = Map.of("age", 15);
        Object resultYoung = service.evaluateRules(rule, varsYoung);
        assertEquals(false, resultYoung);
    }

    @Test
    void testInOperatorRule() {
        Map<String, Object> rule =
                Map.of("field", "role", "operator", "IN", "value", List.of("ADMIN", "MANAGER"));
        Map<String, Object> vars = Map.of("role", "ADMIN");

        Object result = service.evaluateRules(rule, vars);
        assertEquals(true, result);

        Map<String, Object> varsUser = Map.of("role", "USER");
        Object resultUser = service.evaluateRules(rule, varsUser);
        assertEquals(false, resultUser);
    }

    @Test
    void testLogicalAndRules() {
        Map<String, Object> rule1 =
                Map.of("field", "status", "operator", "EQ", "value", "ACTIVE");
        Map<String, Object> rule2 = Map.of("field", "age", "operator", "GTE", "value", 21);

        Map<String, Object> composite =
                Map.of("logicalOperator", "AND", "rules", List.of(rule1, rule2));

        Map<String, Object> varsPass = Map.of("status", "ACTIVE", "age", 25);
        assertEquals(true, service.evaluateRules(composite, varsPass));

        Map<String, Object> varsFail = Map.of("status", "ACTIVE", "age", 19);
        assertEquals(false, service.evaluateRules(composite, varsFail));
    }

    @Test
    void testPlaceholderResolution() {
        Map<String, Object> rule =
                Map.of("field", "${user.name}", "operator", "EQ", "value", "Ahmed");
        Map<String, Object> vars = Map.of("user", Map.of("name", "Ahmed"));

        Object result = service.evaluateRules(rule, vars);
        assertEquals(true, result);
    }
}

