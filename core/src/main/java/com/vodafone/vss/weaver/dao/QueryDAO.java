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

import com.vodafone.vss.weaver.common.database.QueryModel;

/**
 * Pluggable Data Access Object interface for managing saved SQL queries.
 */
public interface QueryDAO {

    /**
     * Persists a new query record.
     */
    QueryModel create(QueryModel query);

    /**
     * Updates an existing query.
     */
    QueryModel update(QueryModel query);

    /**
     * Finds a query by ID.
     */
    Optional<QueryModel> findById(UUID id);

    /**
     * Finds a query by name within a specific datasource.
     */
    Optional<QueryModel> findByNameAndDatasourceId(String name, UUID datasourceId);

    /**
     * Retrieves paginated queries with optional search and datasource filter.
     */
    List<QueryModel> findAll(int offset, int limit, String search, UUID datasourceId);

    /**
     * Counts queries matching search and datasource filter.
     */
    long count(String search, UUID datasourceId);

    /**
     * Deletes a query by ID.
     */
    boolean deleteById(UUID id);

    /**
     * Deletes all queries belonging to a datasource.
     */
    int deleteByDatasourceId(UUID datasourceId);

    /**
     * Reassigns all queries from one datasource to another.
     */
    int reassign(UUID fromDatasourceId, UUID toDatasourceId);

    /**
     * Counts queries linked to a datasource.
     */
    long countByDatasourceId(UUID datasourceId);
}

