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
package com.vodafone.vss.weaver.common.dto;

import java.time.Instant;

import org.slf4j.MDC;
import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Standard API envelope response format across Weaver management APIs.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AppResponse {

    private String message;
    private String reason;
    private Boolean success;
    private Boolean retryable;
    private HttpStatus status;
    private String code;
    private Object data;
    private Object details;
    private String path;

    @Builder.Default private String requestId = resolveRequestId();
    @Builder.Default private Instant timestamp = Instant.now();

    private static String resolveRequestId() {
        try {
            String rid = MDC.get("RID");
            return rid != null ? rid : MDC.get("correlationId");
        } catch (Exception e) {
            return null;
        }
    }
}

