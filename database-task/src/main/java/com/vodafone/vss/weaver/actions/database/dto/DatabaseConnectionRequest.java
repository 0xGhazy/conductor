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

import java.util.Map;

import com.vodafone.vss.weaver.common.database.JdbcConnectionDetails;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

/** JDBC connection settings sent when creating, updating or testing a database. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Schema(name = "DatabaseConnectionRequest", description = "JDBC connection settings")
public class DatabaseConnectionRequest {

    @Schema(description = "JDBC URL for the database type. May use ${weaver.env.NAME}.",
            example = "jdbc:postgresql://localhost:5432/conductor",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private String url;

    @Schema(description = "Database user. May use ${weaver.env.NAME} or ${weaver.secrets.NAME}.",
            example = "${weaver.secrets.username}",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private String username;

    @ToString.Exclude
    @Schema(description = "Required on create. On update, leave blank or masked (****) to keep the stored password. "
                    + "Stored encrypted and never returned. May use ${weaver.secrets.NAME}.",
            example = "${weaver.secrets.password}")
    private String password;

    @Schema(description = "Default schema", example = "public")
    private String schema;

    @Schema(description = "Idle connections kept in the pool (default 0)", example = "0")
    private Integer minimumIdle;

    @Schema(description = "Largest pool size (default 5)", example = "5")
    private Integer maxPoolSize;

    @Schema(description = "Milliseconds before an idle connection is closed (default 60000)", example = "60000")
    private Integer idleTimeout;

    @Schema(description = "Longest life of a connection in milliseconds (default 1800000)", example = "1800000")
    private Long maxLifetime;

    @Schema(description = "Milliseconds to wait for a connection (default 10000)", example = "10000")
    private Integer connectionTimeout;

    // May hold credentials; keep it out of logs and audit records.
    @ToString.Exclude
    @Schema(description = "Extra JDBC driver properties", example = "{\"sslmode\": \"disable\"}")
    private Map<String, String> properties;

    /** As stored connection details; unset pool settings stay null so the service applies defaults. */
    public JdbcConnectionDetails toConnectionDetails() {
        JdbcConnectionDetails details = new JdbcConnectionDetails();
        details.setUrl(url);
        details.setUsername(username);
        details.setPassword(password);
        details.setSchema(schema);
        details.setMinimumIdle(minimumIdle);
        details.setMaxPoolSize(maxPoolSize);
        details.setIdleTimeout(idleTimeout);
        details.setMaxLifetime(maxLifetime);
        details.setConnectionTimeout(connectionTimeout);
        details.setProperties(properties);
        return details;
    }
}
