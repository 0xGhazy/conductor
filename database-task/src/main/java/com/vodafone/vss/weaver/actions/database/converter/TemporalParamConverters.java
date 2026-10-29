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

import java.sql.Time;
import java.sql.Timestamp;
import java.time.*;

import com.vodafone.vss.weaver.common.database.QueryParameterDataType;

public final class TemporalParamConverters {

    private TemporalParamConverters() {}

    public static class DateConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.DATE;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof LocalDate ld) {
                    return ld;
                }
                if (rawValue instanceof java.sql.Date sd) {
                    return sd.toLocalDate();
                }
                if (rawValue instanceof java.util.Date ud) {
                    return ud.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                }
                if (rawValue instanceof Number n) {
                    return Instant.ofEpochMilli(n.longValue()).atZone(ZoneId.systemDefault()).toLocalDate();
                }
                String str = rawValue.toString().trim();
                if (str.length() >= 10 && (str.contains("T") || str.contains(" "))) {
                    return LocalDate.parse(str.substring(0, 10));
                }
                return LocalDate.parse(str);
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class TimeConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.TIME;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Time t) {
                    return t;
                }
                if (rawValue instanceof LocalTime lt) {
                    return Time.valueOf(lt);
                }
                String str = rawValue.toString().trim();
                if (str.length() == 5 && str.charAt(2) == ':') {
                    return Time.valueOf(LocalTime.parse(str + ":00"));
                }
                return Time.valueOf(LocalTime.parse(str));
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class DateTimeConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.DATETIME;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof LocalDateTime ldt) {
                    return ldt;
                }
                if (rawValue instanceof Instant inst) {
                    return LocalDateTime.ofInstant(inst, ZoneId.systemDefault());
                }
                if (rawValue instanceof Timestamp ts) {
                    return ts.toLocalDateTime();
                }
                if (rawValue instanceof java.util.Date ud) {
                    return LocalDateTime.ofInstant(ud.toInstant(), ZoneId.systemDefault());
                }
                if (rawValue instanceof Number n) {
                    return LocalDateTime.ofInstant(Instant.ofEpochMilli(n.longValue()), ZoneId.systemDefault());
                }
                String str = rawValue.toString().trim();
                if (str.contains("Z") || str.contains("+")) {
                    return LocalDateTime.ofInstant(Instant.parse(str), ZoneId.systemDefault());
                }
                if (str.contains("T")) {
                    return LocalDateTime.parse(str);
                }
                return LocalDateTime.parse(str.replace(' ', 'T'));
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class TimestampConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.TIMESTAMP;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Timestamp ts) {
                    return ts;
                }
                if (rawValue instanceof Instant inst) {
                    return Timestamp.from(inst);
                }
                if (rawValue instanceof LocalDateTime ldt) {
                    return Timestamp.valueOf(ldt);
                }
                if (rawValue instanceof java.util.Date ud) {
                    return new Timestamp(ud.getTime());
                }
                if (rawValue instanceof Number n) {
                    return new Timestamp(n.longValue());
                }
                String str = rawValue.toString().trim();
                if (str.matches("^\\d+$")) {
                    return new Timestamp(Long.parseLong(str));
                }
                if (str.endsWith("Z") || str.contains("+") || (str.contains("-") && str.lastIndexOf('-') > 10)) {
                    try {
                        return Timestamp.from(java.time.OffsetDateTime.parse(str).toInstant());
                    } catch (java.time.format.DateTimeParseException ignored) {
                        return Timestamp.from(Instant.parse(str));
                    }
                }
                if (str.contains("T")) {
                    return Timestamp.valueOf(LocalDateTime.parse(str));
                }
                return Timestamp.valueOf(str);
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }
}
