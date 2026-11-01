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
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskDto;
import com.vodafone.vss.weaver.common.scripting.ScriptEngineTaskResult;

import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultSize;
import static com.vodafone.vss.weaver.common.utils.WorkerUtils.resultType;

@Service
public class ScriptExecutorService {

    private static final Logger log = LoggerFactory.getLogger(ScriptExecutorService.class);

    private final PythonScriptExecutorService pythonScriptExecutorService;
    private final JavaScriptExecutorService javaScriptExecutorService;
    private final JexlScriptExecutorService jexlScriptExecutorService;

    public ScriptExecutorService(
            PythonScriptExecutorService pythonScriptExecutorService,
            JavaScriptExecutorService javaScriptExecutorService,
            JexlScriptExecutorService jexlScriptExecutorService) {
        this.pythonScriptExecutorService = pythonScriptExecutorService;
        this.javaScriptExecutorService = javaScriptExecutorService;
        this.jexlScriptExecutorService = jexlScriptExecutorService;
    }

    public ScriptEngineTaskResult executeScript(@NotNull ScriptEngineTaskDto payload) {
        Languages language = payload.getLanguage();
        if (language == null) {
            language = Languages.JEXL;
        }
        Map<String, Object> variables = payload.getVariables() == null ? Map.of() : payload.getVariables();

        ScriptEngineTaskResult result = switch (language) {
            case PYTHON -> pythonScriptExecutorService.evaluate(payload.getScript(), variables, payload.getTimeout());
            case JAVA_SCRIPT -> javaScriptExecutorService.evaluate(payload.getScript(), variables, payload.getTimeout());
            case JEXL -> jexlScriptExecutorService.evaluate(payload.getScript(), variables, payload.getTimeout());
        };

        log.debug("script_engine_completed language={} resultType={} resultSize={}",
                language, resultType(result.getOutput()), resultSize(result.getOutput()));
        return result;
    }
}

