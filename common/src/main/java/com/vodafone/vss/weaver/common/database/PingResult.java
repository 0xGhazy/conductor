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
package com.vodafone.vss.weaver.common.database;

import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PingResult(boolean reachable, String reason, String errorCode) implements Serializable {

    public PingResult(boolean reachable, String reason) {
        this(reachable, reason, reachable ? null : "UNKNOWN");
    }

    public PingResult(boolean reachable, long latencyMs, String reason, DatabaseErrorCode errorCode) {
        this(reachable, reason, errorCode != null ? errorCode.name() : null);
    }
}
