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
import jakarta.validation.constraints.Min;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

/** Body of {@code POST /api/queries/{id}/execute}: run a saved query with arguments. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Schema(name = "QueryExecutionRequest", description = "Arguments for a saved query")
public class QueryExecutionRequest {

    // Values may be sensitive; keep them out of logs and audit records.
    @ToString.Exclude
    @Builder.Default
    @Schema(description = "Values for the query's declared parameters, converted to their declared types",
            example = "{\"status\": \"COMPLETED\"}")
    private Map<String, Object> parameters = new HashMap<>();

    @Min(value = 1, message = "maxRows must be at least 1")
    @Schema(description = "Maximum rows returned; capped by weaver.database.execute.max-rows", example = "100")
    private Integer maxRows;
}
