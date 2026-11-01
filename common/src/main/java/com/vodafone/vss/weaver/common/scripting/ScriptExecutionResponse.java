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

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptExecutionResponse {

    private String status;
    private Object output;
    private String code;
    private String reason;
    private long executionTimeMs;

    public static ScriptExecutionResponse fromResult(
            ScriptEngineTaskResult result, long executionTimeMs) {
        if (result == null) {
            return ScriptExecutionResponse.builder()
                    .status("FAILED")
                    .code(ScriptErrorCode.SCRIPT_EXECUTION_ERROR.name())
                    .executionTimeMs(executionTimeMs)
                    .build();
        }
        return ScriptExecutionResponse.builder()
                .status(result.getStatus())
                .output(result.getOutput())
                .code(result.getCode())
                .reason(result.getReason())
                .executionTimeMs(executionTimeMs)
                .build();
    }
}

