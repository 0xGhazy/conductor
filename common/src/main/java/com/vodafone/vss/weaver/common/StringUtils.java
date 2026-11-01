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

import java.util.Map;

/**
 * Utility functions for string operations and map extractions.
 */
public final class StringUtils {

    private StringUtils() {}

    public static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    public static String defaultIfBlank(String value, String defaultValue) {
        return (value == null || value.isBlank()) ? defaultValue : value;
    }

    public static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public static String getStringOrNull(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object value = map.get(key);
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    public static String getStringOrEmpty(Map<String, Object> map, String key) {
        String value = getStringOrNull(map, key);
        return value == null ? "" : value;
    }
}

