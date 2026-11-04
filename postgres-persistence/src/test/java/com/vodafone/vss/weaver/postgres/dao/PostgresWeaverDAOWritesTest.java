/*
 * Copyright 2026 Weaver Contributors.
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
package com.vodafone.vss.weaver.postgres.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.retry.support.RetryTemplate;

import com.vodafone.vss.weaver.common.secrets.SecretModel;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression test for writes that bound parameters but never ran the statement, so creates,
 * updates and deletes returned success without touching the database. Runs without a database:
 * the JDBC connection is mocked and the test checks that the statement is actually executed and
 * the transaction committed.
 */
class PostgresWeaverDAOWritesTest {

    private Connection connection;
    private PreparedStatement statement;
    private PostgresSecretDAO secretDAO;

    @BeforeEach
    void setUp() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        connection = mock(Connection.class);
        statement = mock(PreparedStatement.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getAutoCommit()).thenReturn(true);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(statement.executeUpdate()).thenReturn(1);
        secretDAO = new PostgresSecretDAO(new RetryTemplate(), new ObjectMapper(), dataSource);
    }

    @Test
    void createSecretExecutesInsert() throws Exception {
        secretDAO.create(
                SecretModel.builder()
                        .name("db_password")
                        .encryptedValue(new byte[] {1, 2, 3})
                        .iv(new byte[] {4, 5, 6})
                        .displayedText("ab****yz")
                        .build());

        verify(connection).prepareStatement(org.mockito.ArgumentMatchers.startsWith("INSERT INTO secrets"));
        verify(statement, times(1)).executeUpdate();
        verify(connection).commit();
    }

    @Test
    void deleteSecretByIdExecutesDelete() throws Exception {
        secretDAO.deleteById(UUID.randomUUID());

        verify(statement, times(1)).executeUpdate();
        verify(connection).commit();
    }

    @Test
    void deleteSecretByNameExecutesDelete() throws Exception {
        secretDAO.deleteByName("db_password");

        verify(statement, times(1)).executeUpdate();
        verify(connection).commit();
    }
}
