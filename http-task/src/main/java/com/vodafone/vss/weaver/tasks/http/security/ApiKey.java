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
package com.vodafone.vss.weaver.tasks.http.security;

import org.springframework.web.reactive.function.client.WebClient;

import com.vodafone.vss.weaver.common.StringUtils;
import com.vodafone.vss.weaver.common.http.HttpConnectionModel;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class ApiKey implements AuthStrategy {

    private String header;
    private String apiKey;
    @Builder.Default
    private long expiry = Long.MAX_VALUE;

    public ApiKey(HttpConnectionModel conn) {
        this.apiKey = StringUtils.getStringOrNull(conn.getAuthConfig(), "apiKey");
        this.header = StringUtils.getStringOrNull(conn.getAuthConfig(), "apiKeyHeader");
    }

    @Override
    public WebClient.RequestHeadersSpec<?> apply(WebClient.RequestHeadersSpec<?> req) {
        if (header == null || header.isBlank() || apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("header and apiKey are required for ApiKey authentication");
        }
        return req.header(header, apiKey);
    }

    @Override
    public boolean testAuthentication() {
        return header != null && !header.isBlank() && apiKey != null && !apiKey.isBlank();
    }
}

