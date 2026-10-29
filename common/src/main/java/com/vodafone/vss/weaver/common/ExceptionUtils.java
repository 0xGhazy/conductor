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
package com.vodafone.vss.weaver.common;

import org.springframework.http.HttpStatus;

import com.vodafone.vss.weaver.common.exceptions.BusinessException;
import com.vodafone.vss.weaver.common.exceptions.BusinessExceptionBuilder;

public final class ExceptionUtils {

    private ExceptionUtils() {}

    public static BusinessException throwBusinessException(BusinessExceptionBuilder builder) {
        return builder.buildException();
    }

    public static BusinessException throwNotFound(String message) {
        return BusinessExceptionBuilder.builder()
                .message(message)
                .reason("Requested entity not found")
                .status(HttpStatus.NOT_FOUND)
                .success(false)
                .code("NOT_FOUND")
                .build()
                .buildException();
    }

    public static BusinessException throwAlreadyExist(String message) {
        return BusinessExceptionBuilder.builder()
                .message(message)
                .reason("Provided entity already exists")
                .status(HttpStatus.CONFLICT)
                .success(false)
                .code("CONFLICT")
                .build()
                .buildException();
    }

    public static BusinessException throwBadInputs(String message, String reason) {
        return BusinessExceptionBuilder.builder()
                .message(message)
                .reason(reason)
                .status(HttpStatus.BAD_REQUEST)
                .success(false)
                .code("BAD_REQUEST")
                .build()
                .buildException();
    }

    public static BusinessException throwInternalServerError(String message) {
        return BusinessExceptionBuilder.builder()
                .message(message)
                .reason("Internal server error occurred")
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .success(false)
                .code("INTERNAL_SERVER_ERROR")
                .build()
                .buildException();
    }
}

