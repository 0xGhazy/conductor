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
package com.vodafone.vss.weaver.common.exceptions;

import java.util.Map;

import org.springframework.http.HttpStatus;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {

    private final String message;
    private final String reason;
    private final String code;
    private final HttpStatus status;
    private final Boolean retryable;
    private final Boolean success;
    private final Object details;
    private final Exception exception;
    private final Map<String, Object> errorDetails;

    public BusinessException(
            String message,
            String reason,
            String code,
            HttpStatus status,
            Boolean retryable,
            Boolean success,
            Object details,
            Exception exception,
            Map<String, Object> errorDetails) {
        super(message);
        this.message = message;
        this.reason = reason;
        this.code = code;
        this.status = status != null ? status : HttpStatus.INTERNAL_SERVER_ERROR;
        this.retryable = retryable;
        this.success = success;
        this.details = details;
        this.exception = exception;
        this.errorDetails = errorDetails;
    }
}

