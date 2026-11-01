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
package com.vodafone.vss.weaver.common.redis;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RedisDatasourceRequestDto {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Host is required")
    private String host;

    @Builder.Default
    @Min(value = 1, message = "Port must be > 0")
    @Max(value = 65535, message = "Port must be <= 65535")
    private Integer port = 6379;

    private String username;
    private String password;

    @Builder.Default
    @Min(value = 0, message = "Database index must be >= 0")
    private Integer databaseIndex = 0;

    @Builder.Default private Boolean ssl = false;

    @Builder.Default
    @Min(value = 100, message = "Timeout must be >= 100ms")
    private Integer timeoutMs = 2000;

    @Builder.Default private Boolean active = true;
}

