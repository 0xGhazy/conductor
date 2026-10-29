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

import java.io.Serializable;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.*;

/**
 * JDBC connection configuration and connection pool tuning parameters.
 */
@Getter
@Setter
@Builder
@ToString
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class JdbcConnectionDetails implements Serializable {

    private String url;
    private String username;
    @ToString.Exclude
    private String password;

    @Builder.Default private Integer minimumIdle = 0;
    @Builder.Default private Integer maxPoolSize = 5;
    @JsonAlias("idealTimeout")
    @Builder.Default private Integer idleTimeout = 60_000;
    @Builder.Default private Long maxLifetime = 1_800_000L;
    @Builder.Default private Integer connectionTimeout = 10_000;
    @Builder.Default private String schema = "";
    private Map<String, String> properties;
}

