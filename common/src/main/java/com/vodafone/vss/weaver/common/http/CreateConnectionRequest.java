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

import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request payload for creating or updating an HTTP connection.
 */
public record CreateConnectionRequest(
        @NotBlank(message = "Connection name is required") String name,
        @NotNull(message = "Authentication strategy is required") AuthenticationStrategy strategy,
        Map<String, Object> authConfig,
        UUID createdBy,
        UUID updatedBy
) {
    public CreateConnectionRequest(String name, AuthenticationStrategy strategy, Map<String, Object> authConfig) {
        this(name, strategy, authConfig, null, null);
    }
}

