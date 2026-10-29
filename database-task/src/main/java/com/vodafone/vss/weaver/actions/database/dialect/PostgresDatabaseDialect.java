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
package com.vodafone.vss.weaver.actions.database.dialect;

import java.sql.SQLException;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.vodafone.vss.weaver.common.validator.JdbcUrlValidator;
import com.zaxxer.hikari.HikariConfig;

@Component
public class PostgresDatabaseDialect implements DatabaseDialect {

    @Override
    public DatabaseType type() {
        return DatabaseType.POSTGRES;
    }

    @Override
    public String driverClassName() {
        return "org.postgresql.Driver";
    }

    @Override
    public boolean isValidUrl(String url) {
        return JdbcUrlValidator.isValidJdbcUrl("POSTGRES", url);
    }

    @Override
    public String urlFormatHint() {
        return JdbcUrlValidator.getExpectedFormatHint("POSTGRES");
    }

    @Override
    public Map<String, String> defaultDataSourceProperties() {
        return Map.of("stringtype", "unspecified");
    }

    @Override
    public void applySchema(HikariConfig hc, String schema) {
        if (schema != null && !schema.isBlank()) {
            hc.setSchema(schema.trim());
        }
    }

    @Override
    public DatabaseErrorCode classify(Throwable t) {
        Throwable current = t;
        while (current != null) {
            if (current instanceof SQLException sqlEx) {
                String sqlState = sqlEx.getSQLState();
                if (sqlState != null) {
                    String state = sqlState.trim().toUpperCase(Locale.ROOT);
                    if ("28P01".equals(state) || "28000".equals(state)) {
                        return DatabaseErrorCode.AUTH_FAILED;
                    }
                    if ("3D000".equals(state)) {
                        return DatabaseErrorCode.DATABASE_NOT_FOUND;
                    }
                    if ("57014".equals(state)) {
                        return DatabaseErrorCode.TIMEOUT;
                    }
                    if (state.startsWith("08")) {
                        return DatabaseErrorCode.HOST_UNREACHABLE;
                    }
                }
            }
            String msg = current.getMessage();
            if (msg != null) {
                String lower = msg.toLowerCase(Locale.ROOT);
                if (lower.contains("password authentication failed") || lower.contains("fatal: password authentication")) {
                    return DatabaseErrorCode.AUTH_FAILED;
                }
                if (lower.contains("database") && lower.contains("does not exist")) {
                    return DatabaseErrorCode.DATABASE_NOT_FOUND;
                }
            }
            current = current.getCause();
        }
        return null;
    }
}

