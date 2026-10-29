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

import java.util.Locale;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum QueryParameterDataType {
    INTEGER,
    STRING,
    UUID,
    DATETIME,
    DOUBLE,
    BOOLEAN,
    DATE,
    TIME,
    JSON,
    JSONB,
    TIMESTAMP,
    LONG,
    FLOAT,
    DECIMAL,
    LIST,
    BINARY;

    @JsonCreator
    public static QueryParameterDataType from(String value) {
        if (value == null || value.isBlank()) {
            return STRING;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "INT", "INTEGER" -> INTEGER;
            case "LONG", "BIGINT" -> LONG;
            case "FLOAT", "REAL" -> FLOAT;
            case "DOUBLE", "FLOAT8" -> DOUBLE;
            case "DECIMAL", "NUMERIC", "BIGDECIMAL" -> DECIMAL;
            case "BOOL", "BOOLEAN" -> BOOLEAN;
            case "DATE" -> DATE;
            case "TIME" -> TIME;
            case "DATETIME" -> DATETIME;
            case "TIMESTAMP" -> TIMESTAMP;
            case "JSON" -> JSON;
            case "JSONB" -> JSONB;
            case "LIST", "ARRAY" -> LIST;
            case "BINARY", "BYTEA", "BLOB" -> BINARY;
            case "UUID" -> UUID;
            default -> {
                try {
                    yield QueryParameterDataType.valueOf(normalized);
                } catch (IllegalArgumentException e) {
                    yield STRING;
                }
            }
        };
    }
}
