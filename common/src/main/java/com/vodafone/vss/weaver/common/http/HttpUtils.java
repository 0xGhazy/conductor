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
package com.vodafone.vss.weaver.common.http;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Utility functions for HTTP request handling and header redaction.
 */
public final class HttpUtils {

    private HttpUtils() {}

    public static Map<String, String> redactHeaders(Map<String, String> in) {
        if (in == null || in.isEmpty()) return Map.of();
        Map<String, String> copy = new LinkedHashMap<>(in.size());
        in.forEach((k, v) -> {
            String key = k == null ? "" : k;
            if (key.equalsIgnoreCase("authorization") || key.equalsIgnoreCase("cookie")) {
                copy.put(key, "***REDACTED***");
            } else {
                copy.put(key, v);
            }
        });
        return copy;
    }

    public static String buildUrlWithParams(String baseUrl, Map<String, String> params) {
        if (params == null || params.isEmpty()) return baseUrl;

        StringBuilder sb = new StringBuilder(baseUrl);
        sb.append(baseUrl.contains("?") ? "&" : "?");

        boolean first = true;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (!first) sb.append("&");
            first = false;
            String key = URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8);
            String value = URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8);
            sb.append(key).append("=").append(value);
        }

        return sb.toString();
    }
}

