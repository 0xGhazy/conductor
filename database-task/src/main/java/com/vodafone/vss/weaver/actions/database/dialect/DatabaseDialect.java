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

import java.util.Map;

import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.DatabaseType;
import com.zaxxer.hikari.HikariConfig;

/**
 * Strategy interface defining database engine specific behaviors:
 * driver class name, URL validation, formatting hints, default pool properties,
 * schema application, and dialect error classification.
 */
public interface DatabaseDialect {

    DatabaseType type();

    String driverClassName();

    boolean isValidUrl(String url);

    String urlFormatHint();

    Map<String, String> defaultDataSourceProperties();

    void applySchema(HikariConfig hc, String schema);

    DatabaseErrorCode classify(Throwable t);
}

