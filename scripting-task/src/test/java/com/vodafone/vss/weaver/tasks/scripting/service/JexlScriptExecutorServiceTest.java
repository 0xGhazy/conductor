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

import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;
import com.vodafone.vss.weaver.tasks.scripting.config.JexlEngineConfig;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class JexlScriptExecutorServiceTest {

    private JexlScriptExecutorService jexl;

    @BeforeEach
    void setUp() {
        jexl = new JexlScriptExecutorService(new JexlEngineConfig().jexlEngine(16), mock(ScriptMetricsService.class));
        jexl.initExecutor();
    }

    @AfterEach
    void tearDown() {
        jexl.shutdown();
    }

    @Test
    @DisplayName("Evaluate simple expression")
    void evaluateSimpleExpression() {
        ScriptEngineTaskResult result = jexl.evaluate("x + y", Map.of("x", 10, "y", 20), 1000);
        assertEquals("SUCCESS", result.getStatus());
        assertEquals(30, result.getOutput());
    }

    @Test
    @DisplayName("A timed-out JEXL loop gives its thread back")
    void timedOutLoopReleasesItsThread() throws InterruptedException {
        assertEquals("TIME_OUT", jexl.evaluate("while (true) { }", Map.of(), 200).getCode());

        ScriptEngineTaskResult next = null;
        for (int attempt = 0; attempt < 40; attempt++) {
            next = jexl.evaluate("x + 1", Map.of("x", 1), 1000);
            if (!"ENGINE_BUSY".equals(next.getCode())) {
                break;
            }
            Thread.sleep(50);
        }
        assertEquals("SUCCESS", next.getStatus(), String.valueOf(next.getReason()));
        assertEquals(2, next.getOutput());
    }
}

