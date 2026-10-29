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
package com.vodafone.vss.weaver.dao;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.vodafone.vss.weaver.common.database.DatasourceModel;

/**
 * Pluggable Data Access Object interface for managing datasource instances.
 */
public interface DatasourceDAO {

    /**
     * Persists a new datasource record.
     */
    DatasourceModel create(DatasourceModel datasource);

    /**
     * Updates an existing datasource, enforcing optimistic locking on version.
     */
    DatasourceModel update(DatasourceModel datasource);

    /**
     * Finds a datasource by unique ID.
     */
    Optional<DatasourceModel> findById(UUID id);

    /**
     * Checks if a datasource with the given ID exists.
     */
    boolean existsById(UUID id);

    /**
     * Finds a datasource by unique name.
     */
    Optional<DatasourceModel> findByName(String name);

    /**
     * Checks if a datasource with the given name exists.
     */
    boolean existsByName(String name);

    /**
     * Checks if a datasource with the given name exists (case-insensitive).
     */
    boolean existsByNameIgnoreCase(String name);

    /**
     * Retrieves paginated datasources with optional name search.
     */
    List<DatasourceModel> findAll(int offset, int limit, String search, boolean minimal);

    /**
     * Compatibility overload for reverse argument order.
     */
    default List<DatasourceModel> findAll(int offset, int limit, boolean minimal, String search) {
        return findAll(offset, limit, search, minimal);
    }

    /**
     * Counts total datasources matching search term.
     */
    long count(String search);

    /**
     * Deletes a datasource by ID.
     */
    boolean deleteById(UUID id);

    /**
     * Gets current version of a datasource for cache invalidation.
     */
    Optional<Long> findVersionById(UUID id);

    /**
     * Atomically bumps versions for a list of datasource IDs.
     */
    void bumpVersions(List<UUID> ids);
}
