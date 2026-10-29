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
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.zaxxer.hikari.HikariConfig;

import static org.junit.jupiter.api.Assertions.*;

class DialectRegistryTest {

    private DialectRegistry registry;

    @BeforeEach
    void setUp() {
        registry =
                new DialectRegistry(
                        List.of(
                                new PostgresDatabaseDialect(),
                                new MysqlDatabaseDialect(),
                                new OracleDatabaseDialect()));
    }

    @Test
    @DisplayName("Registry provides all expected dialects")
    void registryProvidesExpectedDialects() {
        assertTrue(registry.supports(DatabaseType.POSTGRES));
        assertTrue(registry.supports(DatabaseType.MYSQL));
        assertTrue(registry.supports(DatabaseType.ORACLE));

        assertTrue(registry.supports("POSTGRES"));
        assertTrue(registry.supports("mysql"));
        assertTrue(registry.supports("Oracle"));
        assertFalse(registry.supports("SQLITE"));
        assertFalse(registry.supports((String) null));
    }

    @Test
    @DisplayName("Postgres dialect provides correct driver, url validation, and schema setting")
    void postgresDialectProperties() {
        DatabaseDialect postgres = registry.getDialect(DatabaseType.POSTGRES);
        assertEquals("org.postgresql.Driver", postgres.driverClassName());
        assertTrue(postgres.isValidUrl("jdbc:postgresql://localhost:5432/mydb"));
        assertFalse(postgres.isValidUrl("jdbc:mysql://localhost:3306/mydb"));

        HikariConfig hc = new HikariConfig();
        postgres.applySchema(hc, "custom_schema");
        assertEquals("custom_schema", hc.getSchema());

        SQLException authEx = new SQLException("password authentication failed", "28P01");
        assertEquals(DatabaseErrorCode.AUTH_FAILED, postgres.classify(authEx));
    }

    @Test
    @DisplayName("MySQL dialect provides correct driver, url validation, and schema setting")
    void mysqlDialectProperties() {
        DatabaseDialect mysql = registry.getDialect(DatabaseType.MYSQL);
        assertEquals("com.mysql.cj.jdbc.Driver", mysql.driverClassName());
        assertTrue(mysql.isValidUrl("jdbc:mysql://localhost:3306/mydb"));
        assertFalse(mysql.isValidUrl("jdbc:postgresql://localhost:5432/mydb"));

        HikariConfig hc = new HikariConfig();
        mysql.applySchema(hc, "my_catalog");
        assertEquals("my_catalog", hc.getSchema());

        SQLException authEx = new SQLException("Access denied for user", "28000", 1045);
        assertEquals(DatabaseErrorCode.AUTH_FAILED, mysql.classify(authEx));
    }

    @Test
    @DisplayName("Oracle dialect provides correct driver, url validation, and schema setting")
    void oracleDialectProperties() {
        DatabaseDialect oracle = registry.getDialect(DatabaseType.ORACLE);
        assertEquals("oracle.jdbc.OracleDriver", oracle.driverClassName());
        assertTrue(oracle.isValidUrl("jdbc:oracle:thin:@localhost:1521:XEPDB1"));
        assertTrue(oracle.isValidUrl("jdbc:oracle:thin:@//localhost:1521/XEPDB1"));
        assertFalse(oracle.isValidUrl("jdbc:mysql://localhost:3306/mydb"));

        HikariConfig hc = new HikariConfig();
        oracle.applySchema(hc, "app_schema");
        assertEquals("APP_SCHEMA", hc.getSchema());

        SQLException authEx =
                new SQLException("invalid username/password; logon denied", "72000", 1017);
        assertEquals(DatabaseErrorCode.AUTH_FAILED, oracle.classify(authEx));
    }

    @Test
    @DisplayName("DialectRegistry.getDefault() fallback works out of the box")
    void defaultRegistryContainsAllDialects() {
        DialectRegistry def = DialectRegistry.getDefault();
        assertNotNull(def);
        assertTrue(def.supports(DatabaseType.POSTGRES));
        assertTrue(def.supports(DatabaseType.MYSQL));
        assertTrue(def.supports(DatabaseType.ORACLE));
    }
}

