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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

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
}
