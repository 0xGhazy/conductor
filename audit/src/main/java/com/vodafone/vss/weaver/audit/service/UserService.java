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
package com.vodafone.vss.weaver.audit.service;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.vodafone.vss.weaver.common.audit.UserAudited;
import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.dao.UserLookupDAO;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Service managing Keycloak users and providing high-performance in-memory
 * cached lookups using Caffeine.
 * Queries are performed via UserLookupDAO (JDBC-based, no JPA).
 */
@Slf4j
@Service
public class UserService {

    @Value("${keycloak.realm.id:${keycloak.realm:weaver}}")
    private String realmId = "weaver";

    private final UserLookupDAO userLookupDAO;
    private final Cache<String, UserMinimal> userCache;
    /** Values that matched no user (for example "system"), so they are not looked up on every request. */
    private final Cache<String, Boolean> missCache;

    public void setRealmId(String realmId) {
        this.realmId = realmId;
    }

    public String getRealmId() {
        return realmId;
    }

    @Autowired
    public UserService(
            @Autowired(required = false) UserLookupDAO userLookupDAO,
            @Value("${conductor.audit.user.max-cache-size:1000}") int maxCacheSize,
            @Value("${conductor.audit.user.cache-ttl-hours:24}") int cacheTtlHours) {
        this.userLookupDAO = userLookupDAO;
        this.userCache =
                Caffeine.newBuilder()
                        .maximumSize(maxCacheSize)
                        .expireAfterWrite(cacheTtlHours, TimeUnit.HOURS)
                        .build();
        this.missCache =
                Caffeine.newBuilder()
                        .maximumSize(maxCacheSize)
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .build();
        log.info(
                "UserService initialized with Caffeine cache (maxSize={}, ttl={}h)",
                maxCacheSize,
                cacheTtlHours);
    }

    /**
     * Initializes and fills the user cache on application startup.
     */
    @PostConstruct
    private void init() {
        fillUserCache();
    }

    /**
     * Pre-populates the Caffeine cache from database on startup or upon manual refresh.
     */
    public void fillUserCache() {
        if (userLookupDAO == null) {
            log.debug("UserLookupDAO not configured, user cache pre-population skipped.");
            return;
        }
        log.info("Initializing Caffeine user cache for Keycloak realm '{}'...", realmId);
        try {
            List<UserMinimal> users;
            if (realmId != null && !realmId.isBlank()) {
                users = userLookupDAO.findByRealm(realmId);
            } else {
                users = userLookupDAO.findAll();
            }

            for (UserMinimal user : users) {
                putUser(user);
            }
            log.info(
                    "Caffeine user cache successfully populated with {} user(s) for realm '{}'.",
                    userCache.estimatedSize(),
                    realmId);
        } catch (Exception ex) {
            log.warn(
                    "Could not pre-populate user cache from database at startup: {}. On-demand caching will be used.",
                    ex.getMessage());
        }
    }

    /**
     * Fetches user by userId and realmId from Caffeine cache, falling back to database query on cache miss.
     *
     * @param id Keycloak user UUID
     * @return UserMinimal or null if not found
     */
    public UserMinimal getUserMinimalById(String id) {
        if (id == null || id.isBlank()) {
            return null;
        }

        UserMinimal cached = userCache.getIfPresent(id);
        if (cached != null) {
            return cached;
        }

        if (userLookupDAO == null) {
            return null;
        }

        // Fallback to database via UserLookupDAO
        try {
            Optional<UserMinimal> userOpt = userLookupDAO.findByIdAndRealm(id, realmId);
            if (userOpt.isPresent()) {
                UserMinimal user = userOpt.get();
                userCache.put(id, user);
                return user;
            }
        } catch (Exception ex) {
            log.debug("Error looking up user with id '{}': {}", id, ex.getMessage());
        }

        log.debug(
                "User with userId '{}' and realmId '{}' not found in cache or database.",
                id,
                realmId);
        return null;
    }

    /**
     * Adds or updates a user in the cache manually.
     *
     * @param user Minimal user record
     */
    public void putUser(UserMinimal user) {
        if (user != null && user.getId() != null) {
            userCache.put(user.getId(), user);
            missCache.invalidate(user.getId());
        }
    }

    /**
     * Resolves a Keycloak user id (user_entity.id) to the user. Results and misses are cached.
     *
     * @param id Keycloak user id
     * @return the user, or empty when Keycloak has no such user (or lookup is off)
     */
    public Optional<UserMinimal> resolve(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        String key = id.trim();
        UserMinimal cached = userCache.getIfPresent(key);
        if (cached != null) {
            return Optional.of(cached);
        }
        if (userLookupDAO == null || missCache.getIfPresent(key) != null) {
            return Optional.empty();
        }
        Optional<UserMinimal> found;
        try {
            found = userLookupDAO.findByIdAndRealm(key, realmId);
        } catch (Exception ex) {
            log.debug("Could not resolve user '{}': {}", key, ex.getMessage());
            return Optional.empty();
        }
        if (found.isPresent()) {
            putUser(found.get());
        } else {
            missCache.put(key, Boolean.TRUE);
        }
        return found;
    }

    /**
     * Replaces the id-only {@code createdBy} / {@code updatedBy} users with the full users
     * (name and email). Unknown ids stay as {@code {id}}.
     */
    public void fillUsers(UserAudited record) {
        if (record == null) {
            return;
        }
        record.setCreatedBy(withDetails(record.getCreatedBy()));
        record.setUpdatedBy(withDetails(record.getUpdatedBy()));
    }

    private UserMinimal withDetails(UserMinimal user) {
        if (user == null || user.getId() == null) {
            return user;
        }
        return resolve(user.getId()).orElse(user);
    }

    /** {@link #fillUsers(UserAudited)} for each record. */
    public void fillUsers(Collection<? extends UserAudited> records) {
        if (records != null) {
            records.forEach(this::fillUsers);
        }
    }

    /**
     * Clears and reloads the Caffeine user cache from the database.
     */
    public void refreshCache() {
        clearCache();
        fillUserCache();
    }

    /**
     * Invalidates all entries in the Caffeine user cache.
     */
    public void clearCache() {
        userCache.invalidateAll();
        missCache.invalidateAll();
    }

    /**
     * Returns the estimated number of cached users.
     */
    public long getCacheSize() {
        return userCache.estimatedSize();
    }
}
