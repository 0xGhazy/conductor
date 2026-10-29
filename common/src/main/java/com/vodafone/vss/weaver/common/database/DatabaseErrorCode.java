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

import lombok.Getter;

/**
 * Error codes for datasource connectivity and query execution.
 */
@Getter
public enum DatabaseErrorCode {

    // Connection errors
    AUTH_FAILED("Authentication failed: invalid username or password.", false),
    HOST_UNREACHABLE("Database host is unreachable or connection was refused.", true),
    TIMEOUT("Connection attempt timed out.", true),
    DATABASE_NOT_FOUND("Specified database was not found on the database server.", false),
    INVALID_CONFIGURATION("Datasource configuration or connection settings are invalid.", false),
    CONNECTION_FAILED("Database connection test failed.", true),
    UNKNOWN("Failed to establish database connection.", false),

    // Query execution errors
    NONE("Execution was successful with no errors.", false),
    QUERY_NOT_FOUND("The requested database query metadata could not be found.", false),
    QUERY_TIMEOUT("The query execution timed out before receiving a response from the database.", true),
    CONNECTION_FAILURE("Could not establish or maintain a connection to the database instance.", true),
    DUPLICATE_KEY_VIOLATION("A record with the same unique key identifier already exists in the database.", false),
    INTEGRITY_VIOLATION("The operation violates a database schema integrity constraint.", false),
    SYNTAX_ERROR("The provided SQL statement contains invalid grammar or references missing database elements.", false),
    RESULT_SIZE_MISMATCH("The database returned an unexpected number of rows for a single-result query mapping.", false),
    PERMISSION_DENIED("The authenticated database user does not have privileges to execute this query.", false),
    UNCLASSIFIED_DAO("An unexpected runtime exception was intercepted from the persistence context.", false),
    DATA_ACCESS_ERROR("A general database processing failure occurred.", false);

    private final String defaultMessage;
    private final boolean retryable;

    DatabaseErrorCode(String defaultMessage, boolean retryable) {
        this.defaultMessage = defaultMessage;
        this.retryable = retryable;
    }
}

