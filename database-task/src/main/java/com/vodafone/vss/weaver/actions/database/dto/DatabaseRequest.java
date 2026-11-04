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
package com.vodafone.vss.weaver.actions.database.dto;

import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.DatasourceModel;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

/**
 * Body of {@code POST /api/databases} and {@code PUT /api/databases/{id}}: only what a caller
 * may set. The id, version, status and audit fields are set by the server.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Schema(name = "DatabaseRequest", description = "Database definition to create or update")
public class DatabaseRequest {

    @Schema(description = "Unique name, case-insensitive", example = "conductor-db",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private String name;

    @Schema(description = "Database type", example = "POSTGRES", requiredMode = Schema.RequiredMode.REQUIRED)
    private DatabaseType type;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private DatabaseConnectionRequest connection;

    /** As a model for the service; server-managed fields are left empty. */
    public DatasourceModel toModel() {
        return DatasourceModel.builder()
                .name(name)
                .type(type)
                .connection(connection != null ? connection.toConnectionDetails() : null)
                .build();
    }
}
