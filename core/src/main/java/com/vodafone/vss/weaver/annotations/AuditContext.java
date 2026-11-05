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
package com.vodafone.vss.weaver.annotations;

import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Details an {@link Audit}-annotated method attaches to its own audit event, such as what it
 * changed. The audit aspect opens a context around each audited call and stores what was put
 * here. Outside an audited call these methods do nothing.
 *
 * <p>Never put secrets here; record that a secret changed, not its value.
 */
public final class AuditContext {

    /** Key of the field changes in the event details. */
    public static final String CHANGES = "changes";

    // A stack, so an audited call made from another audited call keeps its own details.
    private static final ThreadLocal<Deque<Map<String, Object>>> STACK = ThreadLocal.withInitial(ArrayDeque::new);

    private AuditContext() {}

    /** Starts the details of an audited call (used by the audit aspect). */
    public static void open() {
        STACK.get().push(new LinkedHashMap<>());
    }

    /** Ends the current audited call and returns its details (used by the audit aspect). */
    public static Map<String, Object> close() {
        Deque<Map<String, Object>> stack = STACK.get();
        Map<String, Object> details = stack.isEmpty() ? Map.of() : stack.pop();
        if (stack.isEmpty()) {
            STACK.remove();
        }
        return details;
    }

    /** Adds one detail to the current audited call. */
    public static void put(String key, Object value) {
        putRaw(key, normalize(value));
    }

    /**
     * Records the fields that differ between {@code before} and {@code after} as
     * {@code changes: {field: {from, to}}}. For a create pass an empty {@code before}: each field
     * then has only {@code to}.
     */
    public static void recordChanges(Map<String, ?> before, Map<String, ?> after) {
        // Kept even when empty: "saved, nothing changed" is information too.
        putRaw(CHANGES, diff(before, after));
    }

    private static void putRaw(String key, Object value) {
        Deque<Map<String, Object>> stack = STACK.get();
        if (stack.isEmpty()) {
            STACK.remove();
            return;
        }
        stack.peek().put(key, value);
    }

    /** Field-by-field differences; fields equal (or absent) on both sides are left out. */
    public static Map<String, Object> diff(Map<String, ?> before, Map<String, ?> after) {
        Map<String, ?> from = before != null ? before : Collections.emptyMap();
        Map<String, ?> to = after != null ? after : Collections.emptyMap();
        Map<String, Object> changes = new LinkedHashMap<>();
        for (String field : union(from, to)) {
            Object oldValue = normalize(from.get(field));
            Object newValue = normalize(to.get(field));
            if (Objects.equals(oldValue, newValue)) {
                continue;
            }
            Map<String, Object> change = new LinkedHashMap<>();
            if (from.containsKey(field)) {
                change.put("from", oldValue);
            }
            change.put("to", newValue);
            changes.put(field, change);
        }
        return changes;
    }

    private static Iterable<String> union(Map<String, ?> a, Map<String, ?> b) {
        LinkedHashMap<String, Boolean> keys = new LinkedHashMap<>();
        a.keySet().forEach(key -> keys.put(key, true));
        b.keySet().forEach(key -> keys.put(key, true));
        return keys.keySet();
    }

    /**
     * Values stored as JSON-friendly types (ids and enums as text). Empty text, maps and
     * collections count as no value, so "nothing" saved as {} is not reported as a change.
     */
    private static Object normalize(Object value) {
        if (value instanceof UUID || value instanceof Enum<?>) {
            return value.toString();
        }
        if (value instanceof String text && text.isBlank()
                || value instanceof Map<?, ?> map && map.isEmpty()
                || value instanceof java.util.Collection<?> collection && collection.isEmpty()) {
            return null;
        }
        return value;
    }
}
