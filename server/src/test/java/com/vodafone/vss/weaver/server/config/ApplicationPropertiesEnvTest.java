/*
 * Copyright 2026 Conductor Authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.server.config;

import org.junit.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

public class ApplicationPropertiesEnvTest {

    @Test
    public void testPropertiesLoaded() {
        try (ConfigurableApplicationContext ctx =
                new SpringApplicationBuilder(TestConfig.class)
                        .properties("spring.main.web-application-type=none")
                        .run()) {
            Environment env = ctx.getEnvironment();
            assertNotNull(env.getProperty("conductor.db.type"));
            assertNotNull(env.getProperty("spring.datasource.url"));
            assertEquals("postgres", env.getProperty("conductor.db.type"));
        }
    }

    @org.springframework.context.annotation.Configuration
    static class TestConfig {}
}

