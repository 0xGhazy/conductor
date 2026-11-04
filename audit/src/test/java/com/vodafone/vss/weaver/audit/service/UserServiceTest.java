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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.vodafone.vss.weaver.common.audit.UserAudited;
import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.dao.UserLookupDAO;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class UserServiceTest {

    private UserLookupDAO userLookupDAO;
    private UserService userService;

    @BeforeEach
    public void setup() {
        userLookupDAO = Mockito.mock(UserLookupDAO.class);
        when(userLookupDAO.findByRealm(anyString()))
                .thenReturn(
                        List.of(
                                new UserMinimal("user-1", "john.doe", "John", "Doe", "john@example.com"),
                                new UserMinimal("user-2", "jane.smith", "Jane", "Smith", "jane@example.com")));

        userService = new UserService(userLookupDAO, 100, 24);
        userService.fillUserCache();
    }

    @Test
    public void testUserCachePrePopulation() {
        assertEquals(2, userService.getCacheSize());

        UserMinimal user1 = userService.getUserMinimalById("user-1");
        assertNotNull(user1);
        assertEquals("user-1", user1.getId());
        assertEquals("John Doe", user1.getName());
        assertEquals("john@example.com", user1.getEmail());

        // Verify lookup was from cache without invoking findByIdAndRealm
        verify(userLookupDAO, never()).findByIdAndRealm(eq("user-1"), anyString());
    }

    @Test
    public void testCacheMissFallbackToDAO() {
        when(userLookupDAO.findByIdAndRealm(eq("user-3"), anyString()))
                .thenReturn(
                        Optional.of(
                                new UserMinimal("user-3", "bob.ross", "Bob", "Ross", "bob@example.com")));

        UserMinimal user3 = userService.getUserMinimalById("user-3");
        assertNotNull(user3);
        assertEquals("user-3", user3.getId());
        assertEquals("Bob Ross", user3.getName());

        // Second lookup should hit cache
        UserMinimal cached = userService.getUserMinimalById("user-3");
        assertNotNull(cached);
        verify(userLookupDAO, times(1)).findByIdAndRealm(eq("user-3"), anyString());
    }

    @Test
    public void testUserNotFoundReturnsNull() {
        when(userLookupDAO.findByIdAndRealm(eq("unknown"), anyString()))
                .thenReturn(Optional.empty());

        UserMinimal user = userService.getUserMinimalById("unknown");
        assertNull(user);
    }

    @Test
    public void testClearAndRefreshCache() {
        assertEquals(2, userService.getCacheSize());

        userService.clearCache();
        assertEquals(0, userService.getCacheSize());

        userService.refreshCache();
        assertEquals(2, userService.getCacheSize());
    }

    @Test
    public void testGracefulHandlingWhenDaoIsNull() {
        UserService serviceWithoutDao = new UserService(null, 100, 24);
        assertNull(serviceWithoutDao.getUserMinimalById("any-user"));
        assertEquals(0, serviceWithoutDao.getCacheSize());
    }

    @Test
    public void resolveFindsCachedUsersById() {
        assertEquals("John Doe", userService.resolve("user-1").orElseThrow().getName());
        verify(userLookupDAO, never()).findByIdAndRealm(anyString(), anyString());
    }

    @Test
    public void resolveLooksUpUnknownIdsAndCachesThem() {
        UserMinimal admin = new UserMinimal("user-9", "admin", "Conductor", "Admin", "admin@conductor.local");
        when(userLookupDAO.findByIdAndRealm(eq("user-9"), anyString())).thenReturn(Optional.of(admin));

        assertEquals("Conductor Admin", userService.resolve("user-9").orElseThrow().getName());
        assertEquals("Conductor Admin", userService.resolve("user-9").orElseThrow().getName());
        verify(userLookupDAO, times(1)).findByIdAndRealm(eq("user-9"), anyString());
    }

    @Test
    public void nameFallsBackToTheUsernameWhichIsNotKept() throws Exception {
        UserMinimal user = new UserMinimal("user-7", "svc-bot", null, " ", null);

        assertEquals("svc-bot", user.getName());
        String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(user);
        assertFalse(json.contains("username"), json);
    }

    @Test
    public void unknownValuesAreLookedUpOnlyOnce() {
        String deleted = UUID.randomUUID().toString();
        when(userLookupDAO.findByIdAndRealm(eq(deleted), anyString())).thenReturn(Optional.empty());

        assertTrue(userService.resolve(deleted).isEmpty());
        assertTrue(userService.resolve(deleted).isEmpty());
        verify(userLookupDAO, times(1)).findByIdAndRealm(eq(deleted), anyString());
    }

    @Test
    public void resolveIgnoresBlankAndSurvivesLookupErrors() {
        assertTrue(userService.resolve(null).isEmpty());
        assertTrue(userService.resolve("  ").isEmpty());
        when(userLookupDAO.findByIdAndRealm(eq("broken"), anyString())).thenThrow(new RuntimeException("db down"));
        assertTrue(userService.resolve("broken").isEmpty());
    }

    @Test
    public void fillUsersSetsBothUsersFromKeycloakIds() {
        UUID creator = UUID.randomUUID();
        UUID unknown = UUID.randomUUID();
        userService.putUser(new UserMinimal(creator.toString(), "ops", "Ops", "User", "ops@example.com"));
        Record record = new Record(UserMinimal.ofId(creator.toString()), UserMinimal.ofId(unknown.toString()));

        userService.fillUsers(List.of(record));

        assertEquals("Ops User", record.createdBy.getName());
        assertEquals("ops@example.com", record.createdBy.getEmail());
        // Unknown id: kept as { id } without name or email.
        assertEquals(unknown.toString(), record.updatedBy.getId());
        assertNull(record.updatedBy.getName());
    }

    private static final class Record implements UserAudited {
        private UserMinimal createdBy;
        private UserMinimal updatedBy;

        Record(UserMinimal createdBy, UserMinimal updatedBy) {
            this.createdBy = createdBy;
            this.updatedBy = updatedBy;
        }

        @Override
        public UserMinimal getCreatedBy() {
            return createdBy;
        }

        @Override
        public UserMinimal getUpdatedBy() {
            return updatedBy;
        }

        @Override
        public void setCreatedBy(UserMinimal user) {
            this.createdBy = user;
        }

        @Override
        public void setUpdatedBy(UserMinimal user) {
            this.updatedBy = user;
        }
    }
}
