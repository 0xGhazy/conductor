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
import java.util.concurrent.TimeoutException;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;

import static org.junit.jupiter.api.Assertions.*;

class DatabaseErrorClassifierTest {

    @Test
    @DisplayName("Classifies PostgreSQL password auth failure by SQLState 28P01")
    void classify_postgresAuthSqlState() {
        SQLException sqlEx =
                new SQLException("FATAL: password authentication failed for user \"admin\"", "28P01");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.AUTH_FAILED, result.code());
        assertEquals("Authentication failed: invalid username or password.", result.safeMessage());
        assertFalse(result.safeMessage().contains("admin"));
        assertFalse(result.safeMessage().contains("28P01"));
    }

    @Test
    @DisplayName("Classifies MySQL access denied by vendor error code 1045")
    void classify_mysqlAuthVendorCode() {
        SQLException sqlEx =
                new SQLException(
                        "Access denied for user 'root'@'192.168.1.5' (using password: YES)",
                        "28000",
                        1045);
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.AUTH_FAILED, result.code());
        assertEquals("Authentication failed: invalid username or password.", result.safeMessage());
        assertFalse(result.safeMessage().contains("192.168.1.5"));
        assertFalse(result.safeMessage().contains("root"));
    }

    @Test
    @DisplayName("Classifies Oracle ORA-01017 invalid username/password by vendor code 1017")
    void classify_oracleAuthVendorCode() {
        SQLException sqlEx =
                new SQLException(
                        "ORA-01017: invalid username/password; logon denied", "72000", 1017);
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.AUTH_FAILED, result.code());
        assertEquals("Authentication failed: invalid username or password.", result.safeMessage());
        assertFalse(result.safeMessage().contains("ORA-01017"));
    }

    @Test
    @DisplayName(
            "Classifies authentication failure wrapped inside RuntimeException via message matching")
    void classify_wrappedAuthMessage() {
        RuntimeException wrapped =
                new RuntimeException(
                        "Pool init failed: fatal: password authentication failed for user"
                                + " app_user");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(wrapped);

        assertEquals(DatabaseErrorCode.AUTH_FAILED, result.code());
        assertEquals("Authentication failed: invalid username or password.", result.safeMessage());
        assertFalse(result.safeMessage().contains("app_user"));
    }

    @Test
    @DisplayName("Classifies ConnectException as HOST_UNREACHABLE")
    void classify_connectException() {
        ConnectException netEx =
                new ConnectException("Connection refused: connect to db.internal.net:5432");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(netEx);

        assertEquals(DatabaseErrorCode.HOST_UNREACHABLE, result.code());
        assertEquals(
                "Database host is unreachable or connection was refused.", result.safeMessage());
        assertTrue(result.code().isRetryable());
        assertFalse(result.safeMessage().contains("db.internal.net"));
        assertFalse(result.safeMessage().contains("5432"));
    }

    @Test
    @DisplayName("Classifies UnknownHostException as HOST_UNREACHABLE")
    void classify_unknownHostException() {
        UnknownHostException netEx = new UnknownHostException("unknown-db-host.internal");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(netEx);

        assertEquals(DatabaseErrorCode.HOST_UNREACHABLE, result.code());
        assertEquals(
                "Database host is unreachable or connection was refused.", result.safeMessage());
        assertFalse(result.safeMessage().contains("unknown-db-host.internal"));
    }

    @Test
    @DisplayName("Classifies NoRouteToHostException as HOST_UNREACHABLE")
    void classify_noRouteToHostException() {
        NoRouteToHostException netEx =
                new NoRouteToHostException("No route to host (Host unreachable)");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(netEx);

        assertEquals(DatabaseErrorCode.HOST_UNREACHABLE, result.code());
    }

    @Test
    @DisplayName("Classifies SQLState 08001 as HOST_UNREACHABLE")
    void classify_sqlState08001() {
        SQLException sqlEx = new SQLException("Unable to connect to host", "08001");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.HOST_UNREACHABLE, result.code());
    }

    @Test
    @DisplayName(
            "Classifies MySQL vendor code 2003 (Can't connect to server) as HOST_UNREACHABLE")
    void classify_mysqlVendorCode2003() {
        SQLException sqlEx =
                new SQLException(
                        "Can't connect to MySQL server on '10.0.0.1:3306' (111)", "HY000", 2003);
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.HOST_UNREACHABLE, result.code());
        assertFalse(result.safeMessage().contains("10.0.0.1"));
        assertFalse(result.safeMessage().contains("3306"));
    }

    @Test
    @DisplayName("Classifies Oracle ORA-12541 (TNS:no listener) as HOST_UNREACHABLE")
    void classify_oracleTnsNoListener() {
        SQLException sqlEx = new SQLException("ORA-12541: TNS:no listener", "66000", 12541);
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.HOST_UNREACHABLE, result.code());
    }

    @Test
    @DisplayName("Classifies SocketTimeoutException as TIMEOUT")
    void classify_socketTimeoutException() {
        SocketTimeoutException timeoutEx = new SocketTimeoutException("Read timed out");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(timeoutEx);

        assertEquals(DatabaseErrorCode.TIMEOUT, result.code());
        assertEquals("Connection attempt timed out.", result.safeMessage());
        assertTrue(result.code().isRetryable());
    }

    @Test
    @DisplayName("Classifies SQLTimeoutException as TIMEOUT")
    void classify_sqlTimeoutException() {
        SQLTimeoutException timeoutEx = new SQLTimeoutException("Statement timed out");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(timeoutEx);

        assertEquals(DatabaseErrorCode.TIMEOUT, result.code());
    }

    @Test
    @DisplayName("Classifies TimeoutException as TIMEOUT")
    void classify_genericTimeoutException() {
        TimeoutException timeoutEx = new TimeoutException("Operation timed out after 3000ms");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(timeoutEx);

        assertEquals(DatabaseErrorCode.TIMEOUT, result.code());
    }

    @Test
    @DisplayName("Classifies Hikari pool initialization timeout from message")
    void classify_hikariTimeoutMessage() {
        RuntimeException hikariEx =
                new RuntimeException(
                        "HikariPool-1 - Connection is not available, request timed out after"
                                + " 30000ms.");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(hikariEx);

        assertEquals(DatabaseErrorCode.TIMEOUT, result.code());
        assertEquals("Connection attempt timed out.", result.safeMessage());
    }

    @Test
    @DisplayName("Classifies PostgreSQL database not found SQLState 3D000")
    void classify_databaseNotFoundSqlState3D000() {
        SQLException sqlEx =
                new SQLException("FATAL: database \"finance_prod\" does not exist", "3D000");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.DATABASE_NOT_FOUND, result.code());
        assertEquals(
                "Specified database was not found on the database server.", result.safeMessage());
        assertFalse(result.safeMessage().contains("finance_prod"));
    }

    @Test
    @DisplayName("Classifies MySQL unknown database vendor code 1049")
    void classify_mysqlDatabaseNotFound1049() {
        SQLException sqlEx = new SQLException("Unknown database 'billing_dev'", "42000", 1049);
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.DATABASE_NOT_FOUND, result.code());
        assertFalse(result.safeMessage().contains("billing_dev"));
    }

    @Test
    @DisplayName("Classifies Oracle ORA-12514 unknown service as DATABASE_NOT_FOUND")
    void classify_oracleTnsUnknownService12514() {
        SQLException sqlEx =
                new SQLException(
                        "ORA-12514: TNS:listener does not currently know of service requested",
                        "66000",
                        12514);
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(sqlEx);

        assertEquals(DatabaseErrorCode.DATABASE_NOT_FOUND, result.code());
    }

    @Test
    @DisplayName("Classifies connection test failure message")
    void classify_connectionTestFailed() {
        Exception testEx =
                new Exception("Datasource connection test failed (isValid returned false)");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(testEx);

        assertEquals(DatabaseErrorCode.CONNECTION_FAILED, result.code());
        assertEquals("Database connection test failed.", result.safeMessage());
    }

    @Test
    @DisplayName("Classifies invalid JDBC URL or configuration")
    void classify_invalidConfiguration() {
        Exception configEx =
                new Exception("No suitable driver found for jdbc:invalid://localhost/test");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(configEx);

        assertEquals(DatabaseErrorCode.INVALID_CONFIGURATION, result.code());
        assertEquals(
                "Datasource configuration or connection settings are invalid.",
                result.safeMessage());
        assertFalse(result.safeMessage().contains("jdbc:invalid"));
    }

    @Test
    @DisplayName("Falls back to UNKNOWN for unrecognized exceptions and null input")
    void classify_fallbackToUnknown() {
        assertEquals(DatabaseErrorCode.UNKNOWN, DatabaseErrorClassifier.classify(null).code());

        RuntimeException generic = new RuntimeException("Some unexpected internal error");
        DatabaseErrorClassifier.Result result = DatabaseErrorClassifier.classify(generic);

        assertEquals(DatabaseErrorCode.UNKNOWN, result.code());
        assertEquals("Failed to establish database connection.", result.safeMessage());
        assertFalse(result.safeMessage().contains("unexpected internal error"));
    }
}

