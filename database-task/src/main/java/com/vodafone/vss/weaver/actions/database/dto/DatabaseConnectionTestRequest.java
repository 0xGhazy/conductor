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

import java.util.UUID;

import com.vodafone.vss.weaver.common.database.DatabaseType;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** Body of {@code POST /api/databases/test}: a database definition, plus an optional saved id. */
@Getter
@Setter
@NoArgsConstructor
@ToString(callSuper = true)
@Schema(name = "DatabaseConnectionTestRequest", description = "Database definition to test without saving")
public class DatabaseConnectionTestRequest extends DatabaseRequest {

    @Schema(description = "Id of a saved database being edited. When given, a blank or masked password "
            + "uses the stored one, so the form can be tested without retyping it.",
            example = "018f2d5e-7a91-729d-9d41-382594a9192f")
    private UUID id;

    public DatabaseConnectionTestRequest(UUID id, String name, DatabaseType type, DatabaseConnectionRequest connection) {
        super(name, type, connection);
        this.id = id;
    }
}
