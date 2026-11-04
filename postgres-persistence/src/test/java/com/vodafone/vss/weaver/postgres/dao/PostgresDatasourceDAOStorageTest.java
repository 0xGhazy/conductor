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
package com.vodafone.vss.weaver.postgres.dao;

import org.junit.Test;

import com.vodafone.vss.weaver.common.database.JdbcConnectionDetails;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * The password is hidden from normal JSON, so the DAO must store it through its own mapper.
 * Without that, every save would wipe the stored password. No database needed.
 */
public class PostgresDatasourceDAOStorageTest {

    private final ObjectMapper appMapper = new ObjectMapper();

    private static JdbcConnectionDetails connection() {
        return JdbcConnectionDetails.builder()
                .url("jdbc:postgresql://localhost:5432/conductor")
                .username("app")
                .password("ENC(secret)")
                .build();
    }

    @Test
    public void appJsonLeavesThePasswordOut() throws Exception {
        assertFalse(appMapper.writeValueAsString(connection()).contains("password"));
    }

    @Test
    public void storedJsonKeepsThePasswordAndReadsBack() throws Exception {
        String stored = PostgresDatasourceDAO.storageMapper(appMapper).writeValueAsString(connection());

        assertTrue(stored, stored.contains("\"password\":\"ENC(secret)\""));
        // The DAO reads rows with the normal mapper: write-only still allows reading.
        assertEquals("ENC(secret)", appMapper.readValue(stored, JdbcConnectionDetails.class).getPassword());
    }

    @Test
    public void storageMapperDoesNotChangeTheAppMapper() throws Exception {
        PostgresDatasourceDAO.storageMapper(appMapper);

        assertFalse(appMapper.writeValueAsString(connection()).contains("password"));
    }
}
