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

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

@Setter
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(
        name = "AdhocQueryExecutionRequest",
        description = "Request payload used to execute an inline/ad-hoc SQL query against a datasource"
)
public class AdhocQueryExecutionRequest {

    @NotNull(message = "Datasource ID is required")
    @JsonAlias({"datasourceId", "dataSource", "dataSourceId"})
    @Schema(
            description = "UUID of the datasource to execute the query against",
            example = "018f2d5e-7a91-729d-9d41-382594a9192f",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private UUID datasource;

    @NotBlank(message = "SQL query statement is required")
    @JsonAlias({"query", "sqlQuery"})
    @Schema(
            description = "Raw SQL query statement to execute",
            example = "SELECT * FROM users WHERE active = :active",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String sql;

    @Schema(
            description = "Optional named parameters to bind to the SQL query",
            example = "{\"active\": true}"
    )
    @Builder.Default
    private Map<String, Object> parameters = new HashMap<>();

    @Schema(
            description = "Optional execution timeout in milliseconds",
            example = "5000"
    )
    @Builder.Default
    private Integer timeout = 5000;
}

