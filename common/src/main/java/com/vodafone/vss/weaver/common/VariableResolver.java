/*
 * Copyright 2026 Weaver Contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.vodafone.vss.weaver.common;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * Resolves variables from system environment variables and application properties. Supported formats:
 * <ul>
 *   <li>{@code ${weaver.env.NAME}} / {@code ${weaver.env.NAME:default}}: system env first, then property</li>
 *   <li>{@code #{NAME}} / {@code #{NAME:default}} (legacy): system env first, then property</li>
 *   <li>{@code #{S:NAME}} / {@code #{P:NAME}} (legacy): system env only / property only</li>
 * </ul>
 * Unresolved variables without a default are left as-is. Resolution is a single pass, so resolved values
 * are never expanded again.
 */
@Component
@RequiredArgsConstructor
public class VariableResolver {

    private final Environment environment;

    private static final String NAME = "([A-Za-z_][A-Za-z0-9_.-]*)";
    private static final String DEFAULT = "(?::([^}]*))?";
    // Groups: 1-2 = ${weaver.env.NAME:default}; 3-5 = #{S|P:NAME:default}
    private static final Pattern VARIABLE_PATTERN =
            Pattern.compile(
                    "\\$\\{weaver\\.env\\." + NAME + DEFAULT + "}"
                            + "|#\\{(?:(S|P):)?" + NAME + DEFAULT + "}");

    public String resolve(String input) {
        if (input == null || input.isBlank()) {
            return input;
        }

        Matcher matcher = VARIABLE_PATTERN.matcher(input);
        StringBuffer result = new StringBuffer();

        while (matcher.find()) {
            boolean envFormat = matcher.group(1) != null;
            String source = envFormat ? null : matcher.group(3);
            String variableName = envFormat ? matcher.group(1) : matcher.group(4);
            String defaultValue = envFormat ? matcher.group(2) : matcher.group(5);

            String resolvedValue = resolveVariable(source, variableName, defaultValue);

            if (resolvedValue == null) {
                resolvedValue = matcher.group(0);
            }

            matcher.appendReplacement(result, Matcher.quoteReplacement(resolvedValue));
        }

        matcher.appendTail(result);

        return result.toString();
    }

    private String resolveVariable(
            String source,
            String variableName,
            String defaultValue) {
        String value;

        if ("S".equals(source)) {
            value = getSystemEnv(variableName);
        } else if ("P".equals(source)) {
            value = environment != null ? environment.getProperty(variableName) : null;
        } else {
            // Default resolution order: System -> Property
            value = getSystemEnv(variableName);

            if (isBlank(value)) {
                value = environment != null ? environment.getProperty(variableName) : null;
            }
        }

        return isBlank(value) ? defaultValue : value;
    }

    /**
     * Resolves variables in every string value of a map, walking nested maps and lists. Keys are kept as-is.
     * Returns a new map (insertion order preserved); the input is not modified.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> resolveMap(Map<String, Object> values) {
        return values == null ? null : (Map<String, Object>) resolveDeep(values, false);
    }

    /**
     * Resolves variables in a string, or in every string inside nested maps and lists. Other values are returned
     * unchanged. Maps and lists are copied (map order preserved), never modified in place.
     *
     * @param resolveKeys whether map keys are resolved as well as values
     */
    public Object resolveDeep(Object value, boolean resolveKeys) {
        if (value instanceof String str) {
            return resolve(str);
        }
        if (value instanceof Map<?, ?> map) {
            Map<Object, Object> resolved = new LinkedHashMap<>();
            map.forEach(
                    (k, v) ->
                            resolved.put(
                                    resolveKeys && k != null ? resolve(k.toString()) : k,
                                    resolveDeep(v, resolveKeys)));
            return resolved;
        }
        if (value instanceof List<?> list) {
            List<Object> resolved = new ArrayList<>(list.size());
            list.forEach(item -> resolved.add(resolveDeep(item, resolveKeys)));
            return resolved;
        }
        return value;
    }

    protected String getSystemEnv(String name) {
        return System.getenv(name);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
