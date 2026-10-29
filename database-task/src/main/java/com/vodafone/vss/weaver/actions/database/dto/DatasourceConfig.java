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

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.PoolSettings;

/**
 * Immutable configuration snapshot for a datasource.
 * Decouples the connection pool manager from detached entities/models.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DatasourceConfig(
        UUID id,
        String name,
        Long version,
        DatabaseType type,
        String url,
        String username,
        String password,
        PoolSettings pool,
        String schema,
        Map<String, String> properties
) {

    public DatasourceConfig {
        version = version != null ? version : 0L;
        properties = properties != null ? Collections.unmodifiableMap(properties) : Collections.emptyMap();
        pool = pool != null ? pool : PoolSettings.defaultSettings();
    }

    public DatasourceConfig(
            UUID id,
            Long version,
            DatabaseType type,
            String url,
            String username,
            String password,
            PoolSettings pool,
            String schema,
            Map<String, String> properties
    ) {
        this(id, "datasource", version, type, url, username, password, pool, schema, properties);
    }

    @Override
    public String toString() {
        return "DatasourceConfig[" +
                "id=" + id +
                ", name=" + name +
                ", version=" + version +
                ", type=" + type +
                ", url=" + url +
                ", username=" + username +
                ", password=***" +
                ", pool=" + pool +
                ", schema=" + schema +
                ", properties=" + properties +
                ']';
    }
}

