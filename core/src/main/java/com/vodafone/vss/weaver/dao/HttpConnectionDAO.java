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

import com.vodafone.vss.weaver.common.http.HttpConnectionModel;

/**
 * Data Access Object for HTTP connections and authentication credentials.
 */
public interface HttpConnectionDAO {

    /**
     * Persists a new HTTP connection.
     */
    HttpConnectionModel create(HttpConnectionModel connection);

    /**
     * Updates an existing HTTP connection.
     */
    HttpConnectionModel update(HttpConnectionModel connection);

    /**
     * Finds a connection by unique identifier.
     */
    Optional<HttpConnectionModel> findById(UUID id);

    /**
     * Finds a connection by name (case-insensitive).
     */
    Optional<HttpConnectionModel> findByName(String name);

    /**
     * Checks if a connection exists with the given name (case-insensitive).
     */
    boolean existsByName(String name);

    /**
     * Checks if a connection exists with the given ID.
     */
    boolean existsById(UUID id);

    /**
     * Returns all stored HTTP connections.
     */
    List<HttpConnectionModel> findAll();

    /**
     * Deletes a connection by identifier.
     */
    boolean deleteById(UUID id);

    /**
     * Finds connections where authConfig JSON matches the given LIKE pattern (e.g. for secret usages).
     */
    List<HttpConnectionModel> findByAuthConfigLike(String pattern);
}

