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
package com.vodafone.vss.weaver.common.scripting;

public enum ScriptErrorCode {
    SCRIPT_EXECUTED(false),
    SCRIPT_VALIDATION_ERROR(false),
    SCRIPT_EXECUTION_ERROR(false),
    SCRIPT_SYNTAX_ERROR(false),
    SCRIPT_NAME_ERROR(false),
    SCRIPT_TYPE_ERROR(false),
    SCRIPT_VALUE_ERROR(false),
    SCRIPT_RUNTIME_ERROR(false),
    SCRIPT_HOST_ERROR(false),
    SCRIPT_POLYGLOT_ERROR(false),
    SCRIPT_UNSUPPORTED_METHOD_ERROR(false),
    SCRIPT_RESOURCE_EXHAUSTED(false),
    ENGINE_BUSY(true),
    TIME_OUT(true),
    SCRIPT_ENGINE_BUSY(true),
    SCRIPT_TIMEOUT(true);

    private final boolean retryable;

    ScriptErrorCode(boolean retryable) {
        this.retryable = retryable;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
