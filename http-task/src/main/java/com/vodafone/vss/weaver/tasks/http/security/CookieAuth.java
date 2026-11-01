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

import java.util.Map;

import org.springframework.web.reactive.function.client.WebClient;

import com.vodafone.vss.weaver.common.StringUtils;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class CookieAuth implements AuthStrategy {

    private String cookie;
    private String header;

    public CookieAuth(Map<String, Object> config) {
        this.cookie = StringUtils.getStringOrNull(config, "cookie");
        this.header = StringUtils.getStringOrNull(config, "cookieHeader");
    }

    @Override
    public WebClient.RequestHeadersSpec<?> apply(WebClient.RequestHeadersSpec<?> req) {
        if (cookie == null || cookie.isBlank()) {
            throw new IllegalStateException("cookie is required for CookieAuth");
        }
        String headerName = (header == null || header.isBlank()) ? "Cookie" : header;
        return req.header(headerName, cookie);
    }

    @Override
    public boolean testAuthentication() {
        return cookie != null && !cookie.isBlank();
    }
}

