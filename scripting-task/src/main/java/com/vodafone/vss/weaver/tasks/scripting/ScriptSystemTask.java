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
package com.vodafone.vss.weaver.tasks.scripting;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;
import com.vodafone.vss.weaver.tasks.scripting.service.ScriptExecutorService;

import com.fasterxml.jackson.databind.ObjectMapper;

@Component("SCRIPT")
public class ScriptSystemTask extends ScriptWorkerTask {

    public static final String TASK_TYPE_SCRIPT = "SCRIPT";

    @Autowired
    public ScriptSystemTask(
            ScriptExecutorService scriptExecutorService,
            ObjectMapper objectMapper,
            @Autowired(required = false) ScriptMetricsService scriptMetricsService,
            @Value("${weaver.scripting.resolve-source-variables:true}") boolean resolveSourceVariables) {
        super(TASK_TYPE_SCRIPT, scriptExecutorService, objectMapper, scriptMetricsService, resolveSourceVariables);
    }
}

