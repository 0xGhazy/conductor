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
package com.vodafone.vss.weaver.tasks.scripting.service;

import java.util.List;
import java.util.Map;

import org.graalvm.polyglot.Engine;
import org.graalvm.polyglot.Source;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.tasks.scripting.config.GraalVmEngineConfig;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;
import com.vodafone.vss.weaver.tasks.scripting.polyglot.PolyglotContextPool;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;

class PolyglotScriptExecutorServiceTest {

    private static final Source PYTHON_HELPERS = Source.create("python", "def helper():\n    return 'original'\n");

    private static Engine engine;
    private static PolyglotContextPool jsPool;
    private static PolyglotContextPool pythonPool;
    private static JavaScriptExecutorService js;
    private static PythonScriptExecutorService python;

    @BeforeAll
    static void setUp() {
        engine = Engine.newBuilder().option("engine.WarnInterpreterOnly", "false").build();
        ScriptMetricsService metrics = mock(ScriptMetricsService.class);
        jsPool = new PolyglotContextPool("js", 1, 2, 1, GraalVmEngineConfig.contextFactory(engine, "js", null, null));
        pythonPool = new PolyglotContextPool("python", 1, 1, 50,
                GraalVmEngineConfig.contextFactory(engine, "python", PYTHON_HELPERS, null));
        js = new JavaScriptExecutorService(jsPool, metrics, 15000);
        python = new PythonScriptExecutorService(pythonPool, metrics, 30000);
    }

    @AfterAll
    static void tearDown() {
        js.shutdown();
        python.shutdown();
        jsPool.close();
        pythonPool.close();
        engine.close();
    }

    @Test
    @DisplayName("JavaScript runs are isolated and variables don't leak")
    void javaScriptRunsAreIsolated() {
        assertEquals("SUCCESS", js.evaluate("globalThis.leaked = secret; 1", Map.of("secret", "s3cr3t"), 5000).getStatus());

        ScriptEngineTaskResult next = js.evaluate("typeof secret + ',' + typeof leaked", Map.of(), 5000);
        assertEquals("SUCCESS", next.getStatus());
        assertEquals("undefined,undefined", next.getOutput());
    }

    @Test
    @DisplayName("JavaScript gets native variables and returns plain Java values")
    void javaScriptVariablesAndResultsAreNative() {
        ScriptEngineTaskResult result = js.evaluate(
                "({ isArray: Array.isArray(items), key: cfg.k, nested: { list: items.map(i => i * 2) } })",
                Map.of("items", List.of(1, 2, 3), "cfg", Map.of("k", "v")), 5000);

        assertEquals("SUCCESS", result.getStatus());
        Map<?, ?> output = assertInstanceOf(Map.class, result.getOutput());
        assertEquals(true, output.get("isArray"));
        assertEquals("v", output.get("key"));
        assertEquals(Map.of("list", List.of(2, 4, 6)), output.get("nested"));
    }

    @Test
    @DisplayName("Python gets native dicts, returns plain Java values and shares nothing between runs")
    void pythonVariablesResultsAndIsolation() {
        ScriptEngineTaskResult result = python.evaluate(
                "{'is_dict': isinstance(cfg, dict), 'key': cfg['k'], 'doubled': [i * 2 for i in items]}",
                Map.of("items", List.of(1, 2), "cfg", Map.of("k", "v")), 15000);

        assertEquals("SUCCESS", result.getStatus(), String.valueOf(result.getReason()));
        assertEquals(Map.of("is_dict", true, "key", "v", "doubled", List.of(2, 4)), result.getOutput());

        assertEquals("SUCCESS", python.evaluate("leaked = 1", Map.of(), 15000).getStatus());
        assertEquals(false, python.evaluate("'leaked' in globals()", Map.of(), 15000).getOutput());
    }

    @Test
    @DisplayName("A reused Python context gets its helpers back after a script redefines them")
    void pythonResetRestoresHelpers() {
        assertEquals("SUCCESS", python.evaluate("def helper():\n    return 'hacked'\nhelper()", Map.of(), 15000).getStatus());
        assertEquals("original", python.evaluate("helper()", Map.of(), 15000).getOutput());
    }
}
