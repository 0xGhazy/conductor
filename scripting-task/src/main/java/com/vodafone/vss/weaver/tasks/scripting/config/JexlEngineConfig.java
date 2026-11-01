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
package com.vodafone.vss.weaver.tasks.scripting.config;

import java.util.HashMap;
import java.util.Map;

import org.apache.commons.jexl3.JexlBuilder;
import org.apache.commons.jexl3.JexlEngine;
import org.apache.commons.jexl3.JexlFeatures;
import org.apache.commons.jexl3.introspection.JexlPermissions;
import org.apache.commons.jexl3.introspection.JexlSandbox;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration("scriptingJexlEngineConfig")
public class JexlEngineConfig {

    @Bean("scriptingJexlEngine")
    @ConditionalOnMissingBean(JexlEngine.class)
    public JexlEngine jexlEngine(@Value("${script.engine.jexl.cache-size:512}") int cacheSize) {
        JexlSandbox sandbox = new JexlSandbox(false);
        sandbox.allow(Math.class.getName());
        sandbox.allow(java.util.HashMap.class.getName());
        sandbox.allow(java.util.LinkedHashMap.class.getName());
        sandbox.allow(java.util.ArrayList.class.getName());
        sandbox.allow(java.util.HashSet.class.getName());
        sandbox.allow(java.util.Map.class.getName());
        sandbox.allow(String.class.getName());

        Map<String, Object> namespaces = new HashMap<>();
        namespaces.put("Math", Math.class);
        namespaces.put("HashMap", java.util.HashMap.class);
        namespaces.put("ArrayList", java.util.ArrayList.class);
        namespaces.put("HashSet", java.util.HashSet.class);
        namespaces.put("Str", String.class);

        JexlFeatures features = new JexlFeatures()
                .localVar(true)
                .loops(true)
                .sideEffect(true)
                .methodCall(true)
                .lambda(true)
                .newInstance(true)
                .structuredLiteral(true);

        return new JexlBuilder()
                .sandbox(sandbox)
                .namespaces(namespaces)
                .features(features)
                .permissions(JexlPermissions.UNRESTRICTED)
                .safe(false)
                .silent(false)
                .strict(true)
                .cancellable(true)
                .cache(cacheSize)
                .create();
    }
}

