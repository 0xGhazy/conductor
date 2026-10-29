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
package com.vodafone.vss.weaver.actions.database.util;

import java.sql.Timestamp;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.postgresql.util.PGobject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.actions.database.converter.ConversionContext;
import com.vodafone.vss.weaver.actions.database.converter.ParamConverter;
import com.vodafone.vss.weaver.actions.database.converter.ParamConverterRegistry;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.QueryParameterDataType;

public final class QueryParamTypeConverter {

    private static final Logger log = LoggerFactory.getLogger(QueryParamTypeConverter.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private QueryParamTypeConverter() {}

    public static Object convertValue(QueryParameterDataType type, String value) {
        return convertValue((Object) value, type, ConversionContext.defaultContext());
    }

    public static Object convertValue(String value, QueryParameterDataType type) {
        return convertValue((Object) value, type, ConversionContext.defaultContext());
    }

    public static Object convertValue(Object value, QueryParameterDataType type) {
        return convertValue(value, type, ConversionContext.defaultContext());
    }

    public static Object convertValue(Object value, QueryParameterDataType type, ConversionContext context) {
        if (value == null) {
            return null;
        }
        if (type == null) {
            return value;
        }
        ParamConverter converter = ParamConverterRegistry.get(type);
        if (converter == null) {
            return value;
        }
        return converter.convert(value, context != null ? context : ConversionContext.defaultContext());
    }

    public static Map<String, Object> convertParams(
            Map<String, Object> incoming,
            Map<String, QueryParameterDataType> expected) {
        return convertParams(incoming, expected, ConversionContext.defaultContext());
    }

    public static Map<String, Object> convertParams(
            Map<String, Object> incoming,
            Map<String, QueryParameterDataType> expected,
            DatabaseType databaseType) {
        return convertParams(incoming, expected, ConversionContext.of(databaseType, MAPPER));
    }

    public static Map<String, Object> convertParams(
            Map<String, Object> incoming,
            Map<String, QueryParameterDataType> expected,
            ConversionContext context) {
        log.debug("Validating query parameters against supported data types - incoming params: {}, expected {}", incoming, expected);
        Map<String, Object> safeIncoming = incoming == null ? Map.of() : incoming;
        Map<String, QueryParameterDataType> safeExpected = expected == null ? Map.of() : expected;

        if (safeIncoming.isEmpty()) {
            return Map.of();
        }

        if (safeExpected.isEmpty()) {
            return safeIncoming;
        }

        if (safeExpected.size() != safeIncoming.size()) {
            throw new IllegalArgumentException(
                    String.format("Query parameters are not same size - incoming params %s expected params %s",
                            safeIncoming.size(), safeExpected.size()));
        }

        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, QueryParameterDataType> entry : safeExpected.entrySet()) {
            String key = entry.getKey();
            QueryParameterDataType type = entry.getValue();

            Object rawValue = safeIncoming.get(key);
            if (rawValue == null) {
                throw new IllegalArgumentException("Missing parameter: " + key);
            }
            result.put(key, convertValue(rawValue, type, context));
        }

        return result;
    }

    public static Map<String, Object> parseQueryParameters(
            Map<String, Object> requestParameters,
            Map<String, QueryParameterDataType> expectedParams) {
        return convertParams(requestParameters, expectedParams);
    }

    public static Map<String, Object> parseQueryParameters(
            Map<String, Object> requestParameters,
            Map<String, QueryParameterDataType> expectedParams,
            DatabaseType databaseType) {
        return convertParams(requestParameters, expectedParams, databaseType);
    }

    public static Map<String, Object> normalizeRow(Map<String, Object> row, ObjectMapper objectMapper) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        row.forEach((key, value) -> normalized.put(key, normalizeValue(value, objectMapper)));
        return normalized;
    }

    public static Object normalizeValue(Object value, ObjectMapper objectMapper) {
        if (value == null) {
            return null;
        }

        if (value instanceof PGobject pgObject) {
            String type = pgObject.getType();

            if ("json".equalsIgnoreCase(type) || "jsonb".equalsIgnoreCase(type)) {
                try {
                    return objectMapper.readTree(pgObject.getValue());
                } catch (Exception e) {
                    throw new IllegalArgumentException(
                            "Failed to parse Postgres JSON value: " + pgObject.getValue(),
                            e
                    );
                }
            }

            return pgObject.getValue();
        }

        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }

        return value;
    }
}

