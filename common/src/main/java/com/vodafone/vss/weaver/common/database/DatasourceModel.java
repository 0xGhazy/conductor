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
package com.vodafone.vss.weaver.common.database;

import com.vodafone.vss.weaver.common.audit.UserAudited;
import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.List;
import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.*;

/**
 * Domain model representing a managed database instance / datasource.
 */
@Getter
@Setter
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DatasourceModel implements Serializable, UserAudited {

    private UUID id;
    private String name;
    private Long version;
    private DatabaseType type;
    private JdbcConnectionDetails connection;
    private DatasourceStatus status;

    /**
     * The database's saved queries (newest first, without SQL); only in
     * GET /api/databases/{id}?withQueries=true. Never stored or read from requests.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<QueryModel> queries;
    @Builder.Default private Instant createdAt = Instant.now();
    private Instant updatedAt;
    /**
     * Who created it: the Keycloak user (only the id, user_entity.id, is stored). Set by the server
     * and never read from requests; responses add the name and email when the user is known.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UserMinimal createdBy;

    /** Who last changed it; same rules as {@link #createdBy}. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private UserMinimal updatedBy;
}
