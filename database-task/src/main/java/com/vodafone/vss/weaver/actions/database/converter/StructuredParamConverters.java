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

import java.util.*;

import org.postgresql.util.PGobject;

import com.fasterxml.jackson.databind.JsonNode;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.QueryParameterDataType;

public final class StructuredParamConverters {

    private StructuredParamConverters() {}

    public static class JsonConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.JSON;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            return convertJson(rawValue, "json", context);
        }
    }

    public static class JsonbConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.JSONB;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            return convertJson(rawValue, "jsonb", context);
        }
    }

    public static class ListConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.LIST;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Collection<?> col) {
                    return new ArrayList<>(col);
                }
                if (rawValue instanceof Object[] arr) {
                    return Arrays.asList(arr);
                }
                String str = rawValue.toString().trim();
                if (str.startsWith("[") && str.endsWith("]")) {
                    return context.objectMapper().readValue(str, List.class);
                }
                if (str.contains(",")) {
                    return Arrays.stream(str.split(",")).map(String::trim).toList();
                }
                return List.of(str);
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    private static Object convertJson(Object rawValue, String pgType, ConversionContext context) {
        if (rawValue == null) return null;
        try {
            String jsonString;
            if (rawValue instanceof JsonNode || rawValue instanceof Map || rawValue instanceof Collection) {
                jsonString = context.objectMapper().writeValueAsString(rawValue);
            } else {
                jsonString = rawValue.toString().trim();
                // Validate JSON syntax
                context.objectMapper().readTree(jsonString);
            }

            DatabaseType dbType = context.databaseType() != null ? context.databaseType() : DatabaseType.POSTGRES;
            if (dbType == DatabaseType.POSTGRES) {
                PGobject pgObject = new PGobject();
                pgObject.setType(pgType);
                pgObject.setValue(jsonString);
                return pgObject;
            }

            // For MySQL, Oracle, etc., modern JDBC handles JSON strings natively
            return jsonString;
        } catch (Exception e) {
            throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, pgType.toUpperCase(Locale.ROOT)));
        }
    }
}

