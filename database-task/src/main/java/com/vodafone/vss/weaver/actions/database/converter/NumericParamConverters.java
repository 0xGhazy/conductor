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

import java.math.BigDecimal;

import com.vodafone.vss.weaver.common.database.QueryParameterDataType;

public final class NumericParamConverters {

    private NumericParamConverters() {}

    public static class IntegerConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.INTEGER;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Number n) {
                    return n.intValue();
                }
                String str = rawValue.toString().trim();
                if (str.contains(".")) {
                    return (int) Double.parseDouble(str);
                }
                return Integer.parseInt(str);
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class LongConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.LONG;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Number n) {
                    return n.longValue();
                }
                String str = rawValue.toString().trim();
                if (str.contains(".")) {
                    return (long) Double.parseDouble(str);
                }
                return Long.parseLong(str);
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class FloatConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.FLOAT;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Number n) {
                    return n.floatValue();
                }
                return Float.parseFloat(rawValue.toString().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class DoubleConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.DOUBLE;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Number n) {
                    return n.doubleValue();
                }
                return Double.parseDouble(rawValue.toString().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class DecimalConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.DECIMAL;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof BigDecimal bd) {
                    return bd;
                }
                if (rawValue instanceof Number n) {
                    return new BigDecimal(n.toString());
                }
                return new BigDecimal(rawValue.toString().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }
}
