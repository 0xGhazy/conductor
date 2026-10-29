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
package com.vodafone.vss.weaver.actions.database.util;

import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.sql.SQLException;
import java.sql.SQLTimeoutException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeoutException;

import com.vodafone.vss.weaver.actions.database.dialect.DatabaseDialect;
import com.vodafone.vss.weaver.actions.database.dialect.DialectRegistry;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;

/**
 * Classifies database and connection pool exceptions into standardized, safe {@link DatabaseErrorCode}s.
 */
public final class DatabaseErrorClassifier {

    private DatabaseErrorClassifier() {}

    public record Result(DatabaseErrorCode code, String safeMessage) {
        public static Result of(DatabaseErrorCode code) {
            return new Result(code, code.getDefaultMessage());
        }

        public static Result of(DatabaseErrorCode code, String customSafeMessage) {
            return new Result(code, customSafeMessage);
        }

        public boolean retryable() {
            return code != null && code.isRetryable();
        }
    }

    public static Result classify(Throwable throwable) {
        if (throwable == null) {
            return Result.of(DatabaseErrorCode.UNKNOWN);
        }

        DialectRegistry registry = DialectRegistry.getDefault();
        if (registry != null) {
            for (DatabaseDialect dialect : registry.getAll()) {
                DatabaseErrorCode dialectCode = dialect.classify(throwable);
                if (dialectCode != null) {
                    return Result.of(dialectCode);
                }
            }
        }

        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        Throwable current = throwable;

        // Pass 1: Check SQLState, vendor codes, and specific network/timeout exception types
        while (current != null && seen.add(current)) {
            if (current instanceof SQLException sqlEx) {
                String sqlState = sqlEx.getSQLState();
                int vendorCode = sqlEx.getErrorCode();

                if (isAuthSqlState(sqlState) || isAuthVendorCode(vendorCode)) {
                    return Result.of(DatabaseErrorCode.AUTH_FAILED);
                }
                if (isDatabaseNotFoundSqlState(sqlState) || isDatabaseNotFoundVendorCode(vendorCode)) {
                    return Result.of(DatabaseErrorCode.DATABASE_NOT_FOUND);
                }
                if (isTimeoutSqlState(sqlState)) {
                    return Result.of(DatabaseErrorCode.TIMEOUT);
                }
                if (isConnectionSqlState(sqlState) || isConnectionVendorCode(vendorCode)) {
                    return Result.of(DatabaseErrorCode.HOST_UNREACHABLE);
                }
            }

            if (current instanceof SocketTimeoutException || current instanceof SQLTimeoutException || current instanceof TimeoutException) {
                return Result.of(DatabaseErrorCode.TIMEOUT);
            }
            if (current instanceof ConnectException || current instanceof UnknownHostException || current instanceof NoRouteToHostException) {
                return Result.of(DatabaseErrorCode.HOST_UNREACHABLE);
            }

            current = current.getCause();
        }

        // Pass 2: Fall back to pattern matching on message contents
        seen.clear();
        current = throwable;
        while (current != null && seen.add(current)) {
            String msg = current.getMessage();
            if (msg != null && !msg.isBlank()) {
                String lower = msg.toLowerCase(Locale.ROOT);

                if (containsAny(lower,
                        "password authentication failed",
                        "fatal: password authentication",
                        "access denied for user",
                        "ora-01017",
                        "ora-28000",
                        "ora-28001",
                        "invalid username/password",
                        "logon denied")) {
                    return Result.of(DatabaseErrorCode.AUTH_FAILED);
                }

                if (containsAny(lower,
                        "database does not exist",
                        "database \"",
                        "unknown database",
                        "ora-12514")) {
                    return Result.of(DatabaseErrorCode.DATABASE_NOT_FOUND);
                }

                if (containsAny(lower,
                        "timed out",
                        "timeout",
                        "connection is not available, request timed out")) {
                    return Result.of(DatabaseErrorCode.TIMEOUT);
                }

                if (containsAny(lower,
                        "connection refused",
                        "communications link failure",
                        "unknown host",
                        "network adapter could not establish the connection",
                        "tns:no listener",
                        "tns:connect failed",
                        "no route to host")) {
                    return Result.of(DatabaseErrorCode.HOST_UNREACHABLE);
                }

                if (containsAny(lower,
                        "isvalid returned false",
                        "connection test failed")) {
                    return Result.of(DatabaseErrorCode.CONNECTION_FAILED);
                }

                if (containsAny(lower,
                        "invalid jdbc url",
                        "no suitable driver",
                        "unsupported url",
                        "cannot load driver class")) {
                    return Result.of(DatabaseErrorCode.INVALID_CONFIGURATION);
                }
            }
            current = current.getCause();
        }

        return Result.of(DatabaseErrorCode.UNKNOWN);
    }

    private static boolean isAuthSqlState(String sqlState) {
        if (sqlState == null) return false;
        String upper = sqlState.trim().toUpperCase(Locale.ROOT);
        return upper.startsWith("28");
    }

    private static boolean isAuthVendorCode(int code) {
        return code == 1045
                || code == 1017
                || code == 28000
                || code == 28001;
    }

    private static boolean isDatabaseNotFoundSqlState(String sqlState) {
        if (sqlState == null) return false;
        String upper = sqlState.trim().toUpperCase(Locale.ROOT);
        return upper.startsWith("3D");
    }

    private static boolean isDatabaseNotFoundVendorCode(int code) {
        return code == 1049
                || code == 12514;
    }

    private static boolean isTimeoutSqlState(String sqlState) {
        if (sqlState == null) return false;
        String upper = sqlState.trim().toUpperCase(Locale.ROOT);
        return "57014".equals(upper);
    }

    private static boolean isConnectionSqlState(String sqlState) {
        if (sqlState == null) return false;
        String upper = sqlState.trim().toUpperCase(Locale.ROOT);
        return upper.startsWith("08");
    }

    private static boolean isConnectionVendorCode(int code) {
        return code == 2002
                || code == 2003
                || code == 2005
                || code == 12541
                || code == 12545
                || code == 17002;
    }

    private static boolean containsAny(String text, String... patterns) {
        for (String pattern : patterns) {
            if (text.contains(pattern)) {
                return true;
            }
        }
        return false;
    }
}

