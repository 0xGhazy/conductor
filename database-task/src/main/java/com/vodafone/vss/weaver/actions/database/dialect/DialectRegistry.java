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

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.database.DatabaseType;

/**
 * Registry collecting and managing all registered {@link DatabaseDialect} implementations.
 */
@Component
public class DialectRegistry {

    private static volatile DialectRegistry defaultInstance;

    private final Map<DatabaseType, DatabaseDialect> dialects;

    @Autowired
    public DialectRegistry(List<DatabaseDialect> dialectList) {
        if (dialectList == null || dialectList.isEmpty()) {
            this.dialects = Map.of(
                    DatabaseType.POSTGRES, new PostgresDatabaseDialect(),
                    DatabaseType.MYSQL, new MysqlDatabaseDialect(),
                    DatabaseType.ORACLE, new OracleDatabaseDialect()
            );
        } else {
            this.dialects = dialectList.stream()
                    .collect(Collectors.toMap(DatabaseDialect::type, Function.identity()));
        }
        defaultInstance = this;
    }

    public static DialectRegistry getDefault() {
        DialectRegistry current = defaultInstance;
        if (current == null) {
            synchronized (DialectRegistry.class) {
                if (defaultInstance == null) {
                    defaultInstance = new DialectRegistry(List.of(
                            new PostgresDatabaseDialect(),
                            new MysqlDatabaseDialect(),
                            new OracleDatabaseDialect()
                    ));
                }
                current = defaultInstance;
            }
        }
        return current;
    }

    public DatabaseDialect getDialect(DatabaseType type) {
        if (type == null) {
            throw ExceptionUtils.throwBadInputs("Validation error", "Datasource type cannot be null");
        }
        DatabaseDialect dialect = dialects.get(type);
        if (dialect == null) {
            throw ExceptionUtils.throwBadInputs("Unsupported database", "No dialect registered for database type: " + type);
        }
        return dialect;
    }

    public DatabaseDialect getDialect(String typeName) {
        if (typeName == null || typeName.isBlank()) {
            throw ExceptionUtils.throwBadInputs("Validation error", "Datasource type cannot be null or empty");
        }
        try {
            DatabaseType type = DatabaseType.valueOf(typeName.trim().toUpperCase(Locale.ROOT));
            return getDialect(type);
        } catch (IllegalArgumentException e) {
            throw ExceptionUtils.throwBadInputs("Unsupported database", "Unsupported database engine type: " + typeName);
        }
    }

    public boolean supports(DatabaseType type) {
        return type != null && dialects.containsKey(type);
    }

    public boolean supports(String typeName) {
        if (typeName == null || typeName.isBlank()) {
            return false;
        }
        try {
            DatabaseType type = DatabaseType.valueOf(typeName.trim().toUpperCase(Locale.ROOT));
            return supports(type);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public Collection<DatabaseDialect> getAll() {
        return Collections.unmodifiableCollection(dialects.values());
    }
}

