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

import java.time.Instant;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RedisDatasourceResponseDto {

    private UUID id;
    private String name;
    private String host;
    private Integer port;
    private String username;
    private String passwordMasked;
    private Integer databaseIndex;
    private Boolean ssl;
    private Integer timeoutMs;
    private Boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    public static RedisDatasourceResponseDto fromModel(RedisDatasourceModel model) {
        if (model == null) {
            return null;
        }
        String maskedPass = (model.getPassword() != null && !model.getPassword().isBlank()) ? "******" : null;
        return RedisDatasourceResponseDto.builder()
                .id(model.getId())
                .name(model.getName())
                .host(model.getHost())
                .port(model.getPort())
                .username(model.getUsername())
                .passwordMasked(maskedPass)
                .databaseIndex(model.getDatabaseIndex())
                .ssl(model.getSsl())
                .timeoutMs(model.getTimeoutMs())
                .active(model.getActive())
                .createdAt(model.getCreatedAt())
                .updatedAt(model.getUpdatedAt())
                .build();
    }
}
