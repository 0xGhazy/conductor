/*
 * Copyright 2026 Conductor Authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
package com.vodafone.vss.weaver.dao;

import java.util.List;
import java.util.Optional;

import com.vodafone.vss.weaver.common.audit.UserMinimal;

/**
 * Data Access Object for resolving user details from identity provider storage.
 */
public interface UserLookupDAO {

    /**
     * Finds a user by their user ID and realm ID.
     *
     * @param id Keycloak or identity user UUID
     * @param realmId Target realm or domain identifier
     * @return Optional containing UserMinimal if found, or empty
     */
    Optional<UserMinimal> findByIdAndRealm(String id, String realmId);

    /**
     * Lists all users belonging to a realm.
     *
     * @param realmId Target realm identifier
     * @return List of minimal user records
     */
    List<UserMinimal> findByRealm(String realmId);

    /**
     * Lists all users across all realms.
     *
     * @return List of minimal user records
     */
    List<UserMinimal> findAll();
}
