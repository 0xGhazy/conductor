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
package com.vodafone.vss.weaver.common.utils;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import com.vodafone.vss.weaver.common.metadata.tasks.Task;

public final class WorkerUtils {

    private WorkerUtils() {}

    public static Map<String, Object> resolveInputParameters(Task task) {
        if (task == null) {
            return Map.of();
        }

        Map<String, Object> inputData = task.getInputData();
        if (inputData == null || inputData.isEmpty()) {
            return Map.of();
        }

        for (String configKey :
                List.of(
                        "inputParameters",
                        "HttpConfigs",
                        "DatabaseConfigs",
                        "RedisConfigs",
                        "ScriptConfigs")) {
            Object nested = inputData.get(configKey);
            if (nested instanceof Map<?, ?> map) {
                Map<String, Object> resolved = toStringObjectMap(map);
                inputData.forEach(
                        (k, v) -> {
                            if (k.startsWith("_") && !resolved.containsKey(k)) {
                                resolved.put(k, v);
                            }
                        });
                return resolved;
            }
        }

        return toStringObjectMap(inputData);
    }

    public static Map<String, Object> toStringObjectMap(Map<?, ?> values) {
        if (values == null || values.isEmpty()) {
            return Map.of();
        }

        Map<String, Object> resolved = new LinkedHashMap<>();
        values.forEach((key, value) -> resolved.put(String.valueOf(key), value));
        return resolved;
    }

    public static String getString(Map<String, Object> values, String key) {
        if (values == null) {
            return "";
        }

        Object value = values.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    public static String resultType(Object result) {
        return result == null ? "null" : result.getClass().getSimpleName();
    }

    public static Integer resultSize(Object result) {
        if (result instanceof Collection<?> collection) {
            return collection.size();
        }
        if (result instanceof Map<?, ?> map) {
            return map.size();
        }
        if (result instanceof CharSequence text) {
            return text.length();
        }
        return null;
    }

    public static Set<String> sortedKeys(Map<String, ?> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        return new TreeSet<>(values.keySet());
    }

    public static String safeLogReason(String reason) {
        String value =
                (reason == null ? "" : reason)
                        .replaceAll(
                                "(?i)(password|secret|token|authorization|cookie|apiKey|refreshToken|accessToken|clientSecret)=\\S+",
                                "$1=[REDACTED]")
                        .replaceAll("[\\r\\n\\t]+", " ")
                        .trim();

        if (value.length() > 240) {
            return value.substring(0, 240) + "...";
        }
        return value;
    }
}
