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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class AuditContextTest {

    @Test
    public void diffKeepsOnlyChangedFieldsWithFromAndTo() {
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("name", "orders");
        before.put("timeout", 1000);
        before.put("description", null);
        Map<String, Object> after = new LinkedHashMap<>(before);
        after.put("timeout", 5000);
        after.put("description", "Daily totals");

        Map<String, Object> changes = AuditContext.diff(before, after);

        assertEquals(Map.of("timeout", Map.of("from", 1000, "to", 5000),
                "description", mapOf("from", null, "to", "Daily totals")), changes);
        assertFalse(changes.containsKey("name"));
    }

    @Test
    public void aCreateHasOnlyToValuesAndSkipsEmptyFields() {
        Map<String, Object> created = new LinkedHashMap<>();
        UUID id = UUID.randomUUID();
        created.put("name", "orders");
        created.put("datasourceId", id);
        created.put("description", null);

        Map<String, Object> changes = AuditContext.diff(Map.of(), created);

        assertEquals(Map.of("to", "orders"), changes.get("name"));
        assertEquals(Map.of("to", id.toString()), changes.get("datasourceId"));
        assertFalse(changes.containsKey("description"));
    }

    @Test
    public void detailsBelongToTheInnermostOpenCall() {
        AuditContext.open();
        AuditContext.put("name", "outer");
        AuditContext.open();
        AuditContext.put("name", "inner");
        assertEquals(Map.of("name", "inner"), AuditContext.close());
        assertEquals(Map.of("name", "outer"), AuditContext.close());
    }

    @Test
    public void outsideAnAuditedCallNothingIsKept() {
        AuditContext.put("name", "ignored");
        AuditContext.recordChanges(Map.of(), Map.of("a", 1));
        assertTrue(AuditContext.close().isEmpty());
    }

    @Test
    public void emptyValuesAreNotChanges() {
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("parameters", null);
        before.put("description", "");
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("parameters", Map.of());
        after.put("description", null);

        assertTrue(AuditContext.diff(before, after).isEmpty());
    }

    private static Map<String, Object> mapOf(String k1, Object v1, String k2, Object v2) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put(k1, v1);
        map.put(k2, v2);
        return map;
    }
}
