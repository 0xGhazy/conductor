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

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import org.springframework.web.reactive.function.client.WebClient;

import com.vodafone.vss.weaver.common.StringUtils;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class BasicAuthentication implements AuthStrategy {

    private String username;
    private String password;

    public BasicAuthentication(Map<String, Object> config) {
        this.username = StringUtils.getStringOrNull(config, "username");
        this.password = StringUtils.getStringOrNull(config, "password");
    }

    @Override
    public WebClient.RequestHeadersSpec<?> apply(WebClient.RequestHeadersSpec<?> req) {
        if (StringUtils.isBlank(username) || StringUtils.isBlank(password)) {
            throw new IllegalStateException("username and password are required for BasicAuthentication");
        }
        String token = Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
        return req.header("Authorization", "Basic " + token);
    }

    @Override
    public boolean testAuthentication() {
        return username != null && !username.isBlank() && password != null && !password.isBlank();
    }
}

