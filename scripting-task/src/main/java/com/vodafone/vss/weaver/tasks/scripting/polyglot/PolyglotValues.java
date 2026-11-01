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
package com.vodafone.vss.weaver.tasks.scripting.polyglot;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.graalvm.polyglot.Value;

/**
 * Copies a script result out of its GraalVM context into plain Java values.
 * The copy only holds null, Boolean, numbers, String, List, and Map.
 */
public final class PolyglotValues {

    public static final int MAX_DEPTH = 64;

    private PolyglotValues() {}

    public static Object toJava(Value value) {
        return toJava(value, 0);
    }

    private static Object toJava(Value value, int depth) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (depth > MAX_DEPTH) {
            throw new IllegalArgumentException("Script result is nested deeper than " + MAX_DEPTH + " levels");
        }
        if (value.isBoolean()) {
            return value.asBoolean();
        }
        if (value.isString()) {
            return value.asString();
        }
        if (value.isNumber()) {
            return toNumber(value);
        }
        if (value.isHostObject()) {
            return value.asHostObject();
        }
        if (value.isInstant()) {
            return value.asInstant().toString();
        }
        if (value.canExecute()) {
            return null;
        }
        if (value.hasArrayElements()) {
            long size = value.getArraySize();
            List<Object> list = new ArrayList<>((int) Math.min(size, 1024));
            for (long index = 0; index < size; index++) {
                list.add(toJava(value.getArrayElement(index), depth + 1));
            }
            return list;
        }
        if (value.hasHashEntries()) {
            Map<String, Object> map = new LinkedHashMap<>();
            Value entries = value.getHashEntriesIterator();
            while (entries.hasIteratorNextElement()) {
                Value entry = entries.getIteratorNextElement();
                map.put(keyOf(entry.getArrayElement(0)), toJava(entry.getArrayElement(1), depth + 1));
            }
            return map;
        }
        if (value.hasIterator()) {
            List<Object> list = new ArrayList<>();
            Value iterator = value.getIterator();
            while (iterator.hasIteratorNextElement()) {
                list.add(toJava(iterator.getIteratorNextElement(), depth + 1));
            }
            return list;
        }
        if (value.hasMembers()) {
            Map<String, Object> map = new LinkedHashMap<>();
            for (String key : value.getMemberKeys()) {
                if (key.startsWith("__")) {
                    continue;
                }
                Value member = value.getMember(key);
                if (member != null && !member.canExecute()) {
                    map.put(key, toJava(member, depth + 1));
                }
            }
            return map;
        }
        return value.toString();
    }

    private static Object toNumber(Value value) {
        if (value.fitsInInt()) {
            return value.asInt();
        }
        if (value.fitsInLong()) {
            return value.asLong();
        }
        if (value.fitsInBigInteger()) {
            return value.asBigInteger();
        }
        if (value.fitsInDouble()) {
            return value.asDouble();
        }
        return value.toString();
    }

    private static String keyOf(Value key) {
        if (key == null || key.isNull()) {
            return "null";
        }
        return key.isString() ? key.asString() : key.toString();
    }
}

