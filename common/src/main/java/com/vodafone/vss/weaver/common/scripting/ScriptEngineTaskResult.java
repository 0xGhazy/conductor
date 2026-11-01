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

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScriptEngineTaskResult {

    private String code;
    private String reason;
    private Object output;
    private String status;
    private String message;
    private long executionTime;

    public static ScriptEngineTaskResult success(Object output) {
        return ScriptEngineTaskResult.builder()
                .status("SUCCESS")
                .code(ScriptErrorCode.SCRIPT_EXECUTED.name())
                .message("Script executed successfully")
                .output(output)
                .build();
    }

    public static ScriptEngineTaskResult failure(ScriptErrorCode code, String reason) {
        return ScriptEngineTaskResult.builder()
                .status("FAILED")
                .code(code != null ? code.name() : ScriptErrorCode.SCRIPT_EXECUTION_ERROR.name())
                .reason(reason)
                .message("Script execution failed")
                .build();
    }
}
