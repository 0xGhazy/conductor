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
package com.vodafone.vss.weaver.actions.database.exception;

import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import lombok.Getter;

/**
 * Thrown when a datasource connection pool cannot be acquired, initialized, or is in active failure backoff.
 */
@Getter
public class DatasourceUnavailableException extends IllegalStateException {

    private final DatabaseErrorCode errorCode;
    private final boolean retryable;

    public DatasourceUnavailableException(String message, DatabaseErrorCode errorCode, boolean retryable) {
        this(message, errorCode, retryable, null);
    }

    public DatasourceUnavailableException(String message, DatabaseErrorCode errorCode, boolean retryable, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode != null ? errorCode : DatabaseErrorCode.UNKNOWN;
        this.retryable = retryable;
    }
}

