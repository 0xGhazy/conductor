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

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.function.Supplier;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Engine;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.ResourceLimits;
import org.graalvm.polyglot.Source;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.vodafone.vss.weaver.tasks.scripting.polyglot.PolyglotContextPool;
import com.vodafone.vss.weaver.tasks.scripting.polyglot.PreparedContext;

@Configuration
public class GraalVmEngineConfig {

    private static final Logger log = LoggerFactory.getLogger(GraalVmEngineConfig.class);

    private static final Source JS_JSON_PARSE = Source.create("js", "JSON.parse");
    private static final Source PYTHON_JSON_LOADS = Source.create("python", "__import__('json').loads");

    private static final Source PYTHON_RESET = Source.create("python", """
            def _weaver_reset_factory(g):
                baseline = {k: v for k, v in g.items() if not k.startswith('_weaver_')}
                def reset():
                    for name in [k for k in g if k not in baseline]:
                        del g[name]
                    g.update(baseline)
                return reset
            _weaver_reset_factory(globals())
            """);

    @Value("${script.engine.python.helper-path:python/validators.py}")
    private String pythonHelperPath;

    @Value("${script.engine.js.helper-path:js/validators.js}")
    private String jsHelperPath;

    @Value("${weaver.scripting.js.warm-contexts:2}")
    private int jsWarmContexts;

    @Value("${weaver.scripting.js.max-concurrent:8}")
    private int jsMaxConcurrent;

    @Value("${weaver.scripting.python.warm-contexts:2}")
    private int pythonWarmContexts;

    @Value("${weaver.scripting.python.max-concurrent:4}")
    private int pythonMaxConcurrent;

    @Value("${weaver.scripting.python.max-runs-per-context:50}")
    private int pythonMaxRunsPerContext;

    @Value("${weaver.scripting.statement-limit:0}")
    private long statementLimit;

    @Bean
    public Engine engine() {
        return Engine.newBuilder()
                .option("engine.WarnInterpreterOnly", "false")
                .build();
    }

    @Bean
    public ResourceLimits scriptResourceLimits() {
        ResourceLimits.Builder builder = ResourceLimits.newBuilder();
        if (statementLimit > 0) {
            builder.statementLimit(statementLimit, null);
        }
        return builder.build();
    }

    @Bean(name = "jsContextPool")
    public PolyglotContextPool jsContextPool(Engine engine, ResourceLimits scriptResourceLimits) {
        Source helpers = loadHelpers("js", jsHelperPath);
        return new PolyglotContextPool("js", jsWarmContexts, jsMaxConcurrent, 1,
                contextFactory(engine, "js", helpers, scriptResourceLimits));
    }

    @Bean(name = "pythonContextPool")
    public PolyglotContextPool pythonContextPool(Engine engine, ResourceLimits scriptResourceLimits) {
        Source helpers = loadHelpers("python", pythonHelperPath);
        return new PolyglotContextPool("python", pythonWarmContexts, pythonMaxConcurrent, pythonMaxRunsPerContext,
                contextFactory(engine, "python", helpers, scriptResourceLimits));
    }

    public static Supplier<PreparedContext> contextFactory(
            Engine engine, String languageId, Source helpers, ResourceLimits limits) {
        return () -> {
            Context.Builder builder = Context.newBuilder(languageId)
                    .engine(engine)
                    .allowAllAccess(false)
                    .allowHostAccess(HostAccess.NONE)
                    .allowHostClassLookup(className -> false);
            if (limits != null) {
                builder.resourceLimits(limits);
            }
            Context context = builder.build();
            try {
                if (helpers != null) {
                    context.eval(helpers);
                }
                return switch (languageId) {
                    case "js" -> new PreparedContext(context, context.eval(JS_JSON_PARSE), null);
                    case "python" -> {
                        org.graalvm.polyglot.Value parseJson = context.eval(PYTHON_JSON_LOADS);
                        org.graalvm.polyglot.Value reset = context.eval(PYTHON_RESET);
                        reset.execute();
                        yield new PreparedContext(context, parseJson, reset);
                    }
                    default -> throw new IllegalArgumentException("Unsupported script language: " + languageId);
                };
            } catch (RuntimeException e) {
                context.close();
                throw e;
            }
        };
    }

    private Source loadHelpers(String languageId, String path) {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(path)) {
            if (inputStream == null) {
                log.warn("Script helper resource not found: {}", path);
                return null;
            }
            String code = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            return Source.newBuilder(languageId, code, path).buildLiteral();
        } catch (IOException e) {
            log.warn("Failed to read script helper resource: {}", path, e);
            return null;
        }
    }
}

