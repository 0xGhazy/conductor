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

import java.util.EnumMap;
import java.util.Map;

import com.vodafone.vss.weaver.common.database.QueryParameterDataType;

public final class ParamConverterRegistry {

    private static final Map<QueryParameterDataType, ParamConverter> CONVERTERS = new EnumMap<>(QueryParameterDataType.class);

    static {
        register(new ScalarParamConverters.StringConverter());
        register(new ScalarParamConverters.UuidConverter());
        register(new ScalarParamConverters.BooleanConverter());
        register(new ScalarParamConverters.BinaryConverter());

        register(new NumericParamConverters.IntegerConverter());
        register(new NumericParamConverters.LongConverter());
        register(new NumericParamConverters.FloatConverter());
        register(new NumericParamConverters.DoubleConverter());
        register(new NumericParamConverters.DecimalConverter());

        register(new TemporalParamConverters.DateConverter());
        register(new TemporalParamConverters.TimeConverter());
        register(new TemporalParamConverters.DateTimeConverter());
        register(new TemporalParamConverters.TimestampConverter());

        register(new StructuredParamConverters.JsonConverter());
        register(new StructuredParamConverters.JsonbConverter());
        register(new StructuredParamConverters.ListConverter());
    }

    private ParamConverterRegistry() {}

    private static void register(ParamConverter converter) {
        CONVERTERS.put(converter.getSupportedType(), converter);
    }

    public static ParamConverter get(QueryParameterDataType type) {
        return CONVERTERS.get(type);
    }
}

