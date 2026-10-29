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
package com.vodafone.vss.weaver.actions.database.converter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.common.database.DatabaseType;

public record ConversionContext(
        DatabaseType databaseType,
        ObjectMapper objectMapper
) {
    private static final ObjectMapper DEFAULT_MAPPER = new ObjectMapper();

    public static ConversionContext defaultContext() {
        return new ConversionContext(DatabaseType.POSTGRES, DEFAULT_MAPPER);
    }

    public static ConversionContext of(DatabaseType databaseType) {
        return new ConversionContext(databaseType != null ? databaseType : DatabaseType.POSTGRES, DEFAULT_MAPPER);
    }

    public static ConversionContext of(DatabaseType databaseType, ObjectMapper objectMapper) {
        return new ConversionContext(
                databaseType != null ? databaseType : DatabaseType.POSTGRES,
                objectMapper != null ? objectMapper : DEFAULT_MAPPER
        );
    }
}

