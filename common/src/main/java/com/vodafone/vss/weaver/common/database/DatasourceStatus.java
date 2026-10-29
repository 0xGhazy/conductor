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
import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DatasourceStatus(
        String status,
        String message,
        String reason,
        String errorCode,
        Instant lastCheck
) implements Serializable {

    public DatasourceStatus(String status, String message, String reason, Instant lastCheck) {
        this(status, message, reason, null, lastCheck);
    }

    public static DatasourceStatus inactive(String message, String reason) {
        return new DatasourceStatus("INACTIVE", message, reason, null, Instant.now());
    }

    public static DatasourceStatus inactive(String message, String reason, String errorCode) {
        return new DatasourceStatus("INACTIVE", message, reason, errorCode, Instant.now());
    }

    public static DatasourceStatus active() {
        return new DatasourceStatus("ACTIVE", null, null, null, Instant.now());
    }

    public static DatasourceStatus active(Instant lastCheck) {
        return new DatasourceStatus("ACTIVE", null, null, null, lastCheck != null ? lastCheck : Instant.now());
    }

    public static DatasourceStatus unknown(String reason) {
        return new DatasourceStatus("UNKNOWN", null, reason, null, Instant.now());
    }

    public static DatasourceStatus unknown(String reason, Instant lastCheck) {
        return new DatasourceStatus("UNKNOWN", null, reason, null, lastCheck != null ? lastCheck : Instant.now());
    }

    public static DatasourceStatus inactive(String message, String reason, String errorCode, Instant lastCheck) {
        return new DatasourceStatus("INACTIVE", message, reason, errorCode, lastCheck != null ? lastCheck : Instant.now());
    }
}
