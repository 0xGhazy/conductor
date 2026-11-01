package com.vodafone.vss.weaver.tasks.rule.service;

import java.util.*;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

@Log4j2
@Service
@RequiredArgsConstructor
public class RuleEvaluatorService {

    private final ObjectMapper objectMapper;

    public Object evaluateRules(Object rules, Map<String, Object> variables) {
        log.info("Evaluating rules: {}, variables: {}", rules, variables);
        if (rules == null) {
            return true;
        }

        try {
            Map<String, Object> variablesMap = variables != null ? variables : new HashMap<>();

            if (rules instanceof String str) {
                if (str.trim().isEmpty()) return true;
                if (str.trim().startsWith("[")) {
                    List<Object> rulesList =
                            objectMapper.readValue(str, new TypeReference<>() {});
                    return evaluateRulesList(rulesList, "AND", variablesMap);
                } else {
                    Map<String, Object> ruleNode =
                            objectMapper.readValue(str, new TypeReference<>() {});
                    return evaluateRule(ruleNode, variablesMap);
                }
            } else if (rules instanceof List<?> rulesList) {
                return evaluateRulesList(rulesList, "AND", variablesMap);
            } else if (rules instanceof Map<?, ?> ruleMap) {
                @SuppressWarnings("unchecked")
                Map<String, Object> typedMap = (Map<String, Object>) ruleMap;
                return evaluateRule(typedMap, variablesMap);
            } else {
                throw new IllegalArgumentException(
                        "Unsupported rules format: " + rules.getClass());
            }
        } catch (Exception e) {
            log.error("Failed to parse or evaluate rules: {}", e.getMessage(), e);
            throw new IllegalArgumentException(
                    "Invalid rule configuration: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private boolean evaluateRulesList(
            List<?> list, String defaultOperator, Map<String, Object> variables) {
        if (list == null || list.isEmpty()) return true;

        boolean runningResult = true;
        String activeOperator = defaultOperator != null ? defaultOperator.toUpperCase() : "AND";
        boolean isFirst = true;

        for (Object item : list) {
            if (item == null) continue;

            if (item instanceof String str) {
                String token = str.trim().toUpperCase();
                if ("AND".equals(token) || "OR".equals(token)) {
                    activeOperator = token;
                }
                continue;
            }

            if (item instanceof Map) {
                boolean itemResult = evaluateRule((Map<String, Object>) item, variables);
                if (isFirst) {
                    runningResult = itemResult;
                    isFirst = false;
                } else {
                    if ("AND".equals(activeOperator)) {
                        runningResult = runningResult && itemResult;
                    } else if ("OR".equals(activeOperator)) {
                        runningResult = runningResult || itemResult;
                    }
                }
            }
        }

        return runningResult;
    }

    @SuppressWarnings("unchecked")
    private boolean evaluateRule(
            Map<String, Object> ruleNode, Map<String, Object> variables) {
        if (ruleNode == null) return false;

        if (ruleNode.containsKey("logicalOperator") || ruleNode.containsKey("operator")) {
            Object rulesObj = ruleNode.get("rules");
            if (rulesObj instanceof List<?> || ruleNode.containsKey("rule")) {
                String op =
                        String.valueOf(
                                        ruleNode.getOrDefault(
                                                "logicalOperator", ruleNode.get("operator")))
                                .toUpperCase();

                if ("AND".equals(op)) {
                    if (rulesObj instanceof List<?> list) {
                        return evaluateRulesList(list, "AND", variables);
                    }
                    return false;
                } else if ("OR".equals(op)) {
                    if (rulesObj instanceof List<?> list) {
                        return evaluateRulesList(list, "OR", variables);
                    }
                    return false;
                } else if ("NOT".equals(op)) {
                    Object subRule = ruleNode.get("rule");
                    if (subRule instanceof Map) {
                        return !evaluateRule((Map<String, Object>) subRule, variables);
                    }
                    return false;
                }
            }
        }

        Object rawField = ruleNode.get("field");
        String operator = getString(ruleNode, "operator");
        Object rawExpectedValue = ruleNode.get("value");

        if (rawField == null || operator == null) {
            return false;
        }

        Object actualValue = resolveOperand(rawField, variables);
        Object expectedValue = resolveOperand(rawExpectedValue, variables);
        return compareValues(actualValue, operator, expectedValue);
    }

    private boolean compareValues(Object actual, String operator, Object expected) {
        String op = operator.toUpperCase();
        switch (op) {
            case "EQUALS":
            case "EQ":
            case "==":
                return checkEquality(actual, expected);

            case "NOT_EQUALS":
            case "NE":
            case "!=":
                return !checkEquality(actual, expected);

            case "IN":
                return isValueInCollection(actual, expected);

            case "NOT_IN":
                return !isValueInCollection(actual, expected);

            case "MATCH":
            case "REGEX":
                if (actual == null || expected == null) return false;
                String regex = String.valueOf(expected);
                String valStr = String.valueOf(actual);
                return valStr.matches(regex);

            case "GREATER_THAN":
            case "GT":
            case ">":
                return compareNumbers(actual, expected) > 0;

            case "GREATER_THAN_OR_EQUAL":
            case "GREATER_THAN_OR_EQUALS":
            case "GTE":
            case "GE":
            case ">=":
                return compareNumbers(actual, expected) >= 0;

            case "LESS_THAN":
            case "LT":
            case "<":
                return compareNumbers(actual, expected) < 0;

            case "LESS_THAN_OR_EQUAL":
            case "LESS_THAN_OR_EQUALS":
            case "LTE":
            case "LE":
            case "<=":
                return compareNumbers(actual, expected) <= 0;

            case "NULL":
                return actual == null;

            case "NOT_NULL":
                return actual != null;

            case "EMPTY":
                return isValueEmpty(actual);

            case "NOT_EMPTY":
                return !isValueEmpty(actual);

            case "NUMERIC":
                return isValueNumeric(actual);

            case "ALPHANUMERIC":
                return isValueAlphanumeric(actual);

            case "EMAIL":
                return isValueEmail(actual);

            case "IS_MAP":
                return actual instanceof Map;

            case "IS_ARRAY":
                if (actual == null) return false;
                return actual instanceof Collection || actual.getClass().isArray();

            case "UNIQUE":
                return isCollectionUnique(actual);

            case "POSITIVE":
                return isNumberPositive(actual);

            case "NEGATIVE":
                return isNumberNegative(actual);

            default:
                log.warn("Unknown operator in rule evaluation: {}", operator);
                return false;
        }
    }

    private boolean isCollectionUnique(Object value) {
        if (value == null) return true;
        if (value instanceof Collection<?> coll) {
            Set<Object> set = new HashSet<>();
            for (Object item : coll) {
                if (!set.add(item)) return false;
            }
            return true;
        }
        if (value.getClass().isArray()) {
            int length = java.lang.reflect.Array.getLength(value);
            Set<Object> set = new HashSet<>();
            for (int i = 0; i < length; i++) {
                Object item = java.lang.reflect.Array.get(value, i);
                if (!set.add(item)) return false;
            }
            return true;
        }
        return true;
    }

    private boolean isNumberPositive(Object value) {
        if (value == null) return false;
        try {
            double d = Double.parseDouble(String.valueOf(value));
            return d > 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean isNumberNegative(Object value) {
        if (value == null) return false;
        try {
            double d = Double.parseDouble(String.valueOf(value));
            return d < 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean isValueEmpty(Object value) {
        if (value == null) return true;
        if (value instanceof String str) {
            return str.trim().isEmpty();
        }
        if (value instanceof Collection<?> coll) {
            return coll.isEmpty();
        }
        if (value instanceof Map<?, ?> map) {
            return map.isEmpty();
        }
        if (value.getClass().isArray()) {
            return java.lang.reflect.Array.getLength(value) == 0;
        }
        return false;
    }

    private boolean isValueNumeric(Object value) {
        if (value == null) return false;
        if (value instanceof Number) return true;
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return false;
        try {
            Double.parseDouble(s);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean isValueAlphanumeric(Object value) {
        if (value == null) return false;
        String s = String.valueOf(value);
        if (s.isEmpty()) return false;
        return s.matches("^[a-zA-Z0-9]+$");
    }

    private boolean isValueEmail(Object value) {
        if (value == null) return false;
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return false;
        return s.matches(
                "^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^-]+(?:\\.[a-zA-Z0-9_!#$%&'*+/=?`{|}~^-]+)*@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*$");
    }

    private boolean isValueInCollection(Object value, Object collection) {
        if (collection == null || value == null) return false;

        if (collection instanceof Collection<?> coll) {
            for (Object item : coll) {
                if (checkEquality(value, item)) {
                    return true;
                }
            }
            return false;
        }

        if (collection instanceof Map<?, ?> map) {
            return map.containsKey(value) || map.containsValue(value);
        }

        if (collection.getClass().isArray()) {
            int length = java.lang.reflect.Array.getLength(collection);
            for (int i = 0; i < length; i++) {
                Object item = java.lang.reflect.Array.get(collection, i);
                if (checkEquality(value, item)) {
                    return true;
                }
            }
            return false;
        }

        if (collection instanceof String str) {
            String[] parts = str.split(",");
            for (String part : parts) {
                if (checkEquality(value, part.trim())) {
                    return true;
                }
            }
        }

        return checkEquality(value, collection);
    }

    private boolean checkEquality(Object actual, Object expected) {
        if (actual == null && expected == null) return true;
        if (actual == null || expected == null) return false;

        if (actual instanceof Number || expected instanceof Number) {
            try {
                double d1 = ((Number) actual).doubleValue();
                double d2 = Double.parseDouble(String.valueOf(expected));
                return Double.compare(d1, d2) == 0;
            } catch (Exception ignored) {
            }
            try {
                double d1 = Double.parseDouble(String.valueOf(actual));
                double d2 = ((Number) expected).doubleValue();
                return Double.compare(d1, d2) == 0;
            } catch (Exception ignored) {
            }
        }

        return String.valueOf(actual).trim().equalsIgnoreCase(String.valueOf(expected).trim());
    }

    private int compareNumbers(Object actual, Object expected) {
        if (actual == null && expected == null) return 0;
        if (actual == null) return -1;
        if (expected == null) return 1;
        try {
            double d1 = Double.parseDouble(String.valueOf(actual));
            double d2 = Double.parseDouble(String.valueOf(expected));
            return Double.compare(d1, d2);
        } catch (NumberFormatException e) {
            return String.valueOf(actual).compareTo(String.valueOf(expected));
        }
    }

    private Object getNestedProperty(Map<String, Object> map, String path) {
        if (map == null || path == null) return null;
        String[] parts = path.split("\\.");
        Object current = map;
        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<?, ?>) current).get(part);
            } else {
                return null;
            }
        }
        return current;
    }

    private Object resolveOperand(Object operand, Map<String, Object> variables) {
        if (operand == null) return null;

        if (operand instanceof String str) {
            String trimmed = str.trim();
            if (trimmed.startsWith("${") && trimmed.endsWith("}") && trimmed.length() > 3) {
                String path = trimmed.substring(2, trimmed.length() - 1).trim();
                if (variables != null) {
                    if (hasNestedProperty(variables, path)) {
                        return getNestedProperty(variables, path);
                    }
                    String cleanPath = stripWorkflowPrefix(path);
                    if (hasNestedProperty(variables, cleanPath)) {
                        return getNestedProperty(variables, cleanPath);
                    }
                }
                return null;
            }

            if (variables != null) {
                if (hasNestedProperty(variables, trimmed)) {
                    return getNestedProperty(variables, trimmed);
                }
                String cleanPath = stripWorkflowPrefix(trimmed);
                if (hasNestedProperty(variables, cleanPath)) {
                    return getNestedProperty(variables, cleanPath);
                }
            }

            return str;
        }

        return operand;
    }

    private String stripWorkflowPrefix(String path) {
        if (path == null) return null;
        if (path.startsWith("workflow.inputs.")) {
            return path.substring("workflow.inputs.".length());
        }
        if (path.startsWith("workflow.input.")) {
            return path.substring("workflow.input.".length());
        }
        if (path.startsWith("workflow.")) {
            return path.substring("workflow.".length());
        }
        if (path.startsWith("input.")) {
            return path.substring("input.".length());
        }
        return path;
    }

    private boolean hasNestedProperty(Map<String, Object> map, String path) {
        if (map == null || path == null) return false;
        String[] parts = path.split("\\.");
        Object current = map;
        for (int i = 0; i < parts.length; i++) {
            if (current instanceof Map<?, ?> currentMap) {
                if (!currentMap.containsKey(parts[i])) {
                    return false;
                }
                current = currentMap.get(parts[i]);
            } else {
                return false;
            }
        }
        return true;
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? String.valueOf(val) : null;
    }
}

