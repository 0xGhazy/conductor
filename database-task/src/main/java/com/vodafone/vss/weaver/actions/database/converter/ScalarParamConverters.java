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

import java.util.Base64;
import java.util.Locale;
import java.util.UUID;

import com.vodafone.vss.weaver.common.database.QueryParameterDataType;

public final class ScalarParamConverters {

    private ScalarParamConverters() {}

    public static class StringConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.STRING;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            if (rawValue instanceof String s) {
                return s;
            }
            return rawValue.toString();
        }
    }

    public static class BooleanConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.BOOLEAN;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof Boolean b) {
                    return b;
                }
                if (rawValue instanceof Number n) {
                    return n.intValue() != 0;
                }
                String str = rawValue.toString().trim().toLowerCase(Locale.ROOT);
                return "true".equals(str) || "1".equals(str) || "yes".equals(str) || "t".equals(str) || "y".equals(str);
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class UuidConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.UUID;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof UUID u) {
                    return u;
                }
                return UUID.fromString(rawValue.toString().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }

    public static class BinaryConverter implements ParamConverter {
        @Override
        public QueryParameterDataType getSupportedType() {
            return QueryParameterDataType.BINARY;
        }

        @Override
        public Object convert(Object rawValue, ConversionContext context) {
            if (rawValue == null) return null;
            try {
                if (rawValue instanceof byte[] b) {
                    return b;
                }
                if (rawValue instanceof Byte[] boxed) {
                    byte[] bytes = new byte[boxed.length];
                    for (int i = 0; i < boxed.length; i++) {
                        bytes[i] = boxed[i];
                    }
                    return bytes;
                }
                return Base64.getDecoder().decode(rawValue.toString().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException(String.format("Error converting value '%s' to type %s", rawValue, getSupportedType()));
            }
        }
    }
}

