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
public class MysqlDatabaseDialect implements DatabaseDialect {

    @Override
    public DatabaseType type() {
        return DatabaseType.MYSQL;
    }

    @Override
    public String driverClassName() {
        return "com.mysql.cj.jdbc.Driver";
    }

    @Override
    public boolean isValidUrl(String url) {
        return JdbcUrlValidator.isValidJdbcUrl("MYSQL", url);
    }

    @Override
    public String urlFormatHint() {
        return JdbcUrlValidator.getExpectedFormatHint("MYSQL");
    }

    @Override
    public Map<String, String> defaultDataSourceProperties() {
        return Map.of(
                "characterEncoding", "UTF-8",
                "serverTimezone", "UTC"
        );
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
                int vendorCode = sqlEx.getErrorCode();
                if (vendorCode == 1045) {
                    return DatabaseErrorCode.AUTH_FAILED;
                }
                if (vendorCode == 1049) {
                    return DatabaseErrorCode.DATABASE_NOT_FOUND;
                }
                if (vendorCode == 2002 || vendorCode == 2003 || vendorCode == 2005) {
                    return DatabaseErrorCode.HOST_UNREACHABLE;
                }
            }
            String msg = current.getMessage();
            if (msg != null) {
                String lower = msg.toLowerCase(Locale.ROOT);
                if (lower.contains("access denied for user")) {
                    return DatabaseErrorCode.AUTH_FAILED;
                }
                if (lower.contains("unknown database")) {
                    return DatabaseErrorCode.DATABASE_NOT_FOUND;
                }
                if (lower.contains("communications link failure")) {
                    return DatabaseErrorCode.HOST_UNREACHABLE;
                }
            }
            current = current.getCause();
        }
        return null;
    }
}

