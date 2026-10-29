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
package com.vodafone.vss.weaver.common.validator;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

import lombok.experimental.UtilityClass;

/**
 * Validates JDBC connection strings across supported database dialects.
 */
@UtilityClass
public final class JdbcUrlValidator {

    private static final Pattern HOST_PATTERN = Pattern.compile("^[A-Za-z0-9.-]+$");
    private static final Pattern DB_NAME_PATTERN = Pattern.compile("^[A-Za-z0-9_$.-]+$");
    private static final Pattern ORACLE_SID_PATTERN =
            Pattern.compile(
                    "^jdbc:oracle:thin:@(?<host>[A-Za-z0-9.-]+):(?<port>\\d{1,5}):(?<sid>[A-Za-z0-9_$.-]+)$");
    private static final Pattern ORACLE_SERVICE_PATTERN =
            Pattern.compile(
                    "^jdbc:oracle:thin:@//(?<host>[A-Za-z0-9.-]+):(?<port>\\d{1,5})/(?<service>[A-Za-z0-9_$.-]+)$");
    private static final Pattern ORACLE_TNS_PATTERN =
            Pattern.compile("^jdbc:oracle:thin:@\\(.+\\)$", Pattern.CASE_INSENSITIVE);

    public static boolean isValidJdbcUrl(String type, String url) {
        if (type == null || url == null) {
            return false;
        }

        return switch (type.toUpperCase(Locale.ROOT)) {
            case "POSTGRES" -> isValidPostgresUrl(url);
            case "MYSQL" -> isValidMysqlUrl(url);
            case "ORACLE" -> isValidOracleUrl(url);
            default -> false;
        };
    }

    public static String getExpectedFormatHint(String type) {
        if (type == null) {
            return "jdbc:<engine>://<connection_details>";
        }

        return switch (type.toUpperCase(Locale.ROOT)) {
            case "POSTGRES" -> "jdbc:postgresql://<host>:<port>/<database>";
            case "MYSQL" -> "jdbc:mysql://<host>:<port>/<database>";
            case "ORACLE" -> "jdbc:oracle:thin:@//<host>:<port>/<service_name> or jdbc:oracle:thin:@<host>:<port>:<sid>";
            default -> "jdbc:<engine>://<connection_details>";
        };
    }

    private static boolean isValidPostgresUrl(String url) {
        return isValidStandardJdbcUrl(url, "jdbc:postgresql://", true);
    }

    private static boolean isValidMysqlUrl(String url) {
        return isValidStandardJdbcUrl(url, "jdbc:mysql://", true);
    }

    private static boolean isValidStandardJdbcUrl(
            String url, String expectedPrefix, boolean requireDatabaseName) {
        if (!url.toLowerCase(Locale.ROOT).startsWith(expectedPrefix)) {
            return false;
        }

        try {
            String uriValue = url.substring("jdbc:".length());
            URI uri = URI.create(uriValue);

            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();
            String path = uri.getPath();

            if (scheme == null || host == null || port < 1 || port > 65535) {
                return false;
            }

            if (!HOST_PATTERN.matcher(host).matches()) {
                return false;
            }

            if (requireDatabaseName) {
                if (path == null || path.length() <= 1) {
                    return false;
                }

                String dbName = path.substring(1);

                if (!DB_NAME_PATTERN.matcher(dbName).matches()) {
                    return false;
                }
            }

            return true;

        } catch (Exception ex) {
            return false;
        }
    }

    private static boolean isValidOracleUrl(String url) {
        if (url == null || !url.startsWith("jdbc:oracle:thin:@")) {
            return false;
        }

        if (matchesOracleSidStyle(url)) {
            return true;
        }

        if (matchesOracleServiceStyle(url)) {
            return true;
        }

        return matchesOracleTnsStyle(url);
    }

    private static boolean matchesOracleSidStyle(String url) {
        var matcher = ORACLE_SID_PATTERN.matcher(url);
        if (!matcher.matches()) {
            return false;
        }
        return isValidHostAndPort(matcher.group("host"), matcher.group("port"));
    }

    private static boolean matchesOracleServiceStyle(String url) {
        var matcher = ORACLE_SERVICE_PATTERN.matcher(url);
        if (!matcher.matches()) {
            return false;
        }
        return isValidHostAndPort(matcher.group("host"), matcher.group("port"));
    }

    private static boolean matchesOracleTnsStyle(String url) {
        return ORACLE_TNS_PATTERN.matcher(url).matches()
                && url.contains("HOST=")
                && url.contains("PORT=")
                && (url.contains("SERVICE_NAME=") || url.contains("SID="));
    }

    private static boolean isValidHostAndPort(String host, String portValue) {
        if (host == null || !HOST_PATTERN.matcher(host).matches()) {
            return false;
        }

        try {
            int port = Integer.parseInt(portValue);
            return port >= 1 && port <= 65535;
        } catch (NumberFormatException ex) {
            return false;
        }
    }
}

