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

import java.math.BigDecimal;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PGobject;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.actions.database.converter.ConversionContext;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.database.QueryParameterDataType;

import static org.junit.jupiter.api.Assertions.*;

class QueryParamTypeConverterTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("Convert numeric types (INTEGER, LONG, FLOAT, DOUBLE, DECIMAL)")
    void convertNumericTypes() {
        // INTEGER
        assertEquals(42, QueryParamTypeConverter.convertValue(42, QueryParameterDataType.INTEGER));
        assertEquals(42, QueryParamTypeConverter.convertValue("42", QueryParameterDataType.INTEGER));
        assertEquals(
                42, QueryParamTypeConverter.convertValue("42.0", QueryParameterDataType.INTEGER));

        // LONG
        assertEquals(
                10000000000L,
                QueryParamTypeConverter.convertValue(10000000000L, QueryParameterDataType.LONG));
        assertEquals(
                10000000000L,
                QueryParamTypeConverter.convertValue("10000000000", QueryParameterDataType.LONG));

        // FLOAT
        assertEquals(
                12.5f, QueryParamTypeConverter.convertValue(12.5f, QueryParameterDataType.FLOAT));
        assertEquals(
                12.5f, QueryParamTypeConverter.convertValue("12.5", QueryParameterDataType.FLOAT));

        // DOUBLE
        assertEquals(
                12.345, QueryParamTypeConverter.convertValue(12.345, QueryParameterDataType.DOUBLE));
        assertEquals(
                12.345,
                QueryParamTypeConverter.convertValue("12.345", QueryParameterDataType.DOUBLE));

        // DECIMAL
        BigDecimal expected = new BigDecimal("123.456");
        assertEquals(
                expected,
                QueryParamTypeConverter.convertValue(expected, QueryParameterDataType.DECIMAL));
        assertEquals(
                expected,
                QueryParamTypeConverter.convertValue("123.456", QueryParameterDataType.DECIMAL));
        assertEquals(
                new BigDecimal("42"),
                QueryParamTypeConverter.convertValue(42, QueryParameterDataType.DECIMAL));
    }

    @Test
    @DisplayName("Convert scalar types (STRING, BOOLEAN, UUID, BINARY)")
    void convertScalarTypes() {
        // STRING
        assertEquals(
                "hello", QueryParamTypeConverter.convertValue("hello", QueryParameterDataType.STRING));
        assertEquals(
                "123", QueryParamTypeConverter.convertValue(123, QueryParameterDataType.STRING));

        // BOOLEAN
        assertEquals(
                true, QueryParamTypeConverter.convertValue(true, QueryParameterDataType.BOOLEAN));
        assertEquals(
                true, QueryParamTypeConverter.convertValue("true", QueryParameterDataType.BOOLEAN));
        assertEquals(
                true, QueryParamTypeConverter.convertValue("1", QueryParameterDataType.BOOLEAN));
        assertEquals(
                true, QueryParamTypeConverter.convertValue("yes", QueryParameterDataType.BOOLEAN));
        assertEquals(
                false,
                QueryParamTypeConverter.convertValue("false", QueryParameterDataType.BOOLEAN));
        assertEquals(
                false, QueryParamTypeConverter.convertValue(0, QueryParameterDataType.BOOLEAN));

        // UUID
        UUID uuid = UUID.randomUUID();
        assertEquals(uuid, QueryParamTypeConverter.convertValue(uuid, QueryParameterDataType.UUID));
        assertEquals(
                uuid,
                QueryParamTypeConverter.convertValue(uuid.toString(), QueryParameterDataType.UUID));

        // BINARY
        byte[] bytes = new byte[] {1, 2, 3, 4};
        assertArrayEquals(
                bytes,
                (byte[])
                        QueryParamTypeConverter.convertValue(
                                bytes, QueryParameterDataType.BINARY));
        String base64 = Base64.getEncoder().encodeToString(bytes);
        assertArrayEquals(
                bytes,
                (byte[])
                        QueryParamTypeConverter.convertValue(
                                base64, QueryParameterDataType.BINARY));
    }

    @Test
    @DisplayName("Convert temporal types (DATE, TIME, DATETIME, TIMESTAMP)")
    void convertTemporalTypes() {
        // DATE
        LocalDate date = LocalDate.of(2026, 10, 27);
        assertEquals(date, QueryParamTypeConverter.convertValue(date, QueryParameterDataType.DATE));
        assertEquals(
                date,
                QueryParamTypeConverter.convertValue("2026-10-27", QueryParameterDataType.DATE));
        assertEquals(
                date,
                QueryParamTypeConverter.convertValue(
                        "2026-10-27T14:30:00Z", QueryParameterDataType.DATE));

        // TIME
        LocalTime time = LocalTime.of(14, 30, 0);
        Time sqlTime = Time.valueOf(time);
        assertEquals(
                sqlTime, QueryParamTypeConverter.convertValue(sqlTime, QueryParameterDataType.TIME));
        assertEquals(
                sqlTime,
                QueryParamTypeConverter.convertValue("14:30:00", QueryParameterDataType.TIME));
        assertEquals(
                sqlTime,
                QueryParamTypeConverter.convertValue("14:30", QueryParameterDataType.TIME));

        // DATETIME
        LocalDateTime ldt = LocalDateTime.of(2026, 10, 27, 14, 30, 0);
        assertEquals(
                ldt, QueryParamTypeConverter.convertValue(ldt, QueryParameterDataType.DATETIME));
        assertEquals(
                ldt,
                QueryParamTypeConverter.convertValue(
                        "2026-10-27T14:30:00", QueryParameterDataType.DATETIME));
        assertEquals(
                ldt,
                QueryParamTypeConverter.convertValue(
                        "2026-10-27 14:30:00", QueryParameterDataType.DATETIME));

        // TIMESTAMP
        long epochMs = 1761567000000L;
        Timestamp expectedTs = new Timestamp(epochMs);
        assertEquals(
                expectedTs,
                QueryParamTypeConverter.convertValue(
                        expectedTs, QueryParameterDataType.TIMESTAMP));
        assertEquals(
                expectedTs,
                QueryParamTypeConverter.convertValue(epochMs, QueryParameterDataType.TIMESTAMP));
        assertEquals(
                expectedTs,
                QueryParamTypeConverter.convertValue(
                        String.valueOf(epochMs), QueryParameterDataType.TIMESTAMP));
        assertNotNull(
                QueryParamTypeConverter.convertValue(
                        "2026-10-27T14:30:00Z", QueryParameterDataType.TIMESTAMP));
    }

    @Test
    @DisplayName("Convert structured types (JSON, JSONB, LIST) with Postgres and MySQL contexts")
    void convertStructuredTypes() throws Exception {
        Map<String, Object> map = Map.of("key", "val", "count", 10);

        // Postgres produces PGobject
        Object pgResult =
                QueryParamTypeConverter.convertValue(
                        map,
                        QueryParameterDataType.JSON,
                        ConversionContext.of(DatabaseType.POSTGRES));
        assertInstanceOf(PGobject.class, pgResult);
        PGobject pgObj = (PGobject) pgResult;
        assertEquals("json", pgObj.getType());
        assertTrue(pgObj.getValue().contains("\"key\":\"val\""));

        Object pgbResult =
                QueryParamTypeConverter.convertValue(
                        map,
                        QueryParameterDataType.JSONB,
                        ConversionContext.of(DatabaseType.POSTGRES));
        assertInstanceOf(PGobject.class, pgbResult);
        assertEquals("jsonb", ((PGobject) pgbResult).getType());

        // MySQL produces standard JSON String
        Object mysqlResult =
                QueryParamTypeConverter.convertValue(
                        map,
                        QueryParameterDataType.JSON,
                        ConversionContext.of(DatabaseType.MYSQL));
        assertInstanceOf(String.class, mysqlResult);
        assertTrue(((String) mysqlResult).contains("\"key\":\"val\""));

        // LIST
        List<String> list = List.of("A", "B", "C");
        assertEquals(list, QueryParamTypeConverter.convertValue(list, QueryParameterDataType.LIST));
        assertEquals(
                list,
                QueryParamTypeConverter.convertValue(
                        new String[] {"A", "B", "C"}, QueryParameterDataType.LIST));
        assertEquals(
                list,
                QueryParamTypeConverter.convertValue("A, B, C", QueryParameterDataType.LIST));
        assertEquals(
                List.of("A", "B"),
                QueryParamTypeConverter.convertValue("[\"A\", \"B\"]", QueryParameterDataType.LIST));
    }

    @Test
    @DisplayName("convertParams validates parameter presence and converts correctly")
    void convertParams_successful() {
        Map<String, Object> incoming = new HashMap<>();
        incoming.put("limit", 50);
        incoming.put("active", "true");
        incoming.put("tagList", "dev,prod");

        Map<String, QueryParameterDataType> expected = new HashMap<>();
        expected.put("limit", QueryParameterDataType.INTEGER);
        expected.put("active", QueryParameterDataType.BOOLEAN);
        expected.put("tagList", QueryParameterDataType.LIST);

        Map<String, Object> converted = QueryParamTypeConverter.convertParams(incoming, expected);

        assertEquals(50, converted.get("limit"));
        assertEquals(true, converted.get("active"));
        assertEquals(List.of("dev", "prod"), converted.get("tagList"));
    }

    @Test
    @DisplayName("convertParams when missing parameter or size mismatch")
    void convertParams_errors() {
        Map<String, Object> incoming = Map.of("a", 1);
        Map<String, QueryParameterDataType> expected =
                Map.of("a", QueryParameterDataType.INTEGER, "b", QueryParameterDataType.STRING);

        assertThrows(
                IllegalArgumentException.class,
                () -> QueryParamTypeConverter.convertParams(incoming, expected));

        Map<String, Object> wrongKeyIncoming = Map.of("c", 1);
        Map<String, QueryParameterDataType> singleExpected =
                Map.of("a", QueryParameterDataType.INTEGER);

        assertThrows(
                IllegalArgumentException.class,
                () -> QueryParamTypeConverter.convertParams(wrongKeyIncoming, singleExpected));
    }

    @Test
    @DisplayName("normalizeRow and normalizeValue handle PGobject and Timestamp")
    void normalizeRowAndValue() throws Exception {
        PGobject jsonPg = new PGobject();
        jsonPg.setType("jsonb");
        jsonPg.setValue("{\"name\":\"test\"}");

        Object normalizedJson = QueryParamTypeConverter.normalizeValue(jsonPg, mapper);
        assertInstanceOf(JsonNode.class, normalizedJson);
        assertEquals("test", ((JsonNode) normalizedJson).get("name").asText());

        Timestamp ts = new Timestamp(System.currentTimeMillis());
        Object normalizedTs = QueryParamTypeConverter.normalizeValue(ts, mapper);
        assertInstanceOf(Instant.class, normalizedTs);
        assertEquals(ts.toInstant(), normalizedTs);
    }

    @Test
    @DisplayName("QueryParameterDataType.from resolves aliases and falls back gracefully")
    void enumFromAliases() {
        assertEquals(QueryParameterDataType.INTEGER, QueryParameterDataType.from("int"));
        assertEquals(QueryParameterDataType.INTEGER, QueryParameterDataType.from("INTEGER"));
        assertEquals(QueryParameterDataType.LONG, QueryParameterDataType.from("BIGINT"));
        assertEquals(QueryParameterDataType.LONG, QueryParameterDataType.from("long"));
        assertEquals(QueryParameterDataType.DECIMAL, QueryParameterDataType.from("numeric"));
        assertEquals(QueryParameterDataType.DECIMAL, QueryParameterDataType.from("BigDecimal"));
        assertEquals(QueryParameterDataType.FLOAT, QueryParameterDataType.from("real"));
        assertEquals(QueryParameterDataType.LIST, QueryParameterDataType.from("array"));
        assertEquals(QueryParameterDataType.BINARY, QueryParameterDataType.from("bytea"));
        assertEquals(QueryParameterDataType.BINARY, QueryParameterDataType.from("blob"));
        assertEquals(QueryParameterDataType.STRING, QueryParameterDataType.from("unknown_type"));
        assertEquals(QueryParameterDataType.STRING, QueryParameterDataType.from(null));
    }
}

