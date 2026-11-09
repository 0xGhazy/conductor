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
package com.vodafone.vss.weaver.postgres.config;

import org.junit.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.junit.Assert.assertEquals;

/** The Keycloak user lookup is on only when its URL is set and not blank. */
public class UserLookupConditionTest {

    @Configuration
    static class Probe {
        @Bean
        @ConditionalOnExpression(PostgresConfiguration.USER_LOOKUP_ENABLED)
        String userLookup() {
            return "on";
        }
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner().withUserConfiguration(Probe.class);

    private void expect(int beans, String... properties) {
        runner.withPropertyValues(properties)
                .run(context -> assertEquals(beans, context.getBeanNamesForType(String.class).length));
    }

    @Test
    public void onlyAUrlTurnsItOn() {
        expect(0);
        expect(0, "weaver.audit.user-lookup.url=");
        expect(0, "weaver.audit.user-lookup.url=   ");
        expect(1, "weaver.audit.user-lookup.url=jdbc:postgresql://localhost:5432/keycloak");
    }
}
