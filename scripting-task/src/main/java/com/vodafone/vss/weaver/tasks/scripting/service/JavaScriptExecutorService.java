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

import java.util.Set;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.scripting.Languages;
import com.vodafone.vss.weaver.common.scripting.ScriptErrorCode;
import com.vodafone.vss.weaver.tasks.scripting.metrics.ScriptMetricsService;
import com.vodafone.vss.weaver.tasks.scripting.polyglot.PolyglotContextPool;

@Component
public class JavaScriptExecutorService extends PolyglotScriptExecutorService {

    public JavaScriptExecutorService(
            @Qualifier("jsContextPool") PolyglotContextPool jsContextPool,
            @Autowired(required = false) ScriptMetricsService scriptMetricsService,
            @org.springframework.beans.factory.annotation.Value(
                    "${weaver.scripting.context-acquire-timeout-ms:2000}") long acquireTimeoutMs) {
        super(Languages.JAVA_SCRIPT, "js", "JavaScript", jsContextPool, scriptMetricsService, acquireTimeoutMs);
    }

    @Override
    protected void bindVariables(Context context, Value parsed, Set<String> names) {
        Value bindings = context.getBindings("js");
        for (String name : names) {
            bindings.putMember(name, parsed.getMember(name));
        }
    }

    @Override
    protected ScriptErrorCode failureCode(PolyglotException ex) {
        String message = ex.getMessage() == null ? "" : ex.getMessage();
        if (message.startsWith("ReferenceError:")) {
            return ScriptErrorCode.SCRIPT_NAME_ERROR;
        }
        if (message.startsWith("TypeError:")) {
            return ScriptErrorCode.SCRIPT_TYPE_ERROR;
        }
        if (ex.isGuestException()) {
            return ScriptErrorCode.SCRIPT_RUNTIME_ERROR;
        }
        if (ex.isHostException()) {
            return ScriptErrorCode.SCRIPT_HOST_ERROR;
        }
        return ScriptErrorCode.SCRIPT_POLYGLOT_ERROR;
    }
}

