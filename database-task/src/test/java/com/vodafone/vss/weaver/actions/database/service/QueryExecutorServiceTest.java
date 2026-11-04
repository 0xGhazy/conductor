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
package com.vodafone.vss.weaver.actions.database.service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.Map;
import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Row limiting, against a mocked JDBC driver that returns 3 rows. */
class QueryExecutorServiceTest {

    private PreparedStatement statement;
    private NamedParameterJdbcTemplate template;
    private QueryExecutorService executor;

    @BeforeEach
    void setUp() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        statement = mock(PreparedStatement.class);
        ResultSet resultSet = mock(ResultSet.class);
        ResultSetMetaData metaData = mock(ResultSetMetaData.class);

        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(statement.execute()).thenReturn(true);
        when(statement.getResultSet()).thenReturn(resultSet);
        when(resultSet.getMetaData()).thenReturn(metaData);
        when(metaData.getColumnCount()).thenReturn(1);
        when(metaData.getColumnLabel(1)).thenReturn("id");
        when(resultSet.next()).thenReturn(true, true, true, false);
        when(resultSet.getObject(1)).thenReturn(1, 2, 3);

        template = new NamedParameterJdbcTemplate(new JdbcTemplate(dataSource));
        executor = new QueryExecutorService(new ObjectMapper(), mock(DynamicDataSourceManager.class));
    }

    @Test
    void resultIsCutAndMarkedWhenOverTheLimit() throws Exception {
        QueryExecutionResult result = executor.sqlExecute("SELECT id FROM t", Map.of(), 0, "test", template, 2);

        assertEquals("SUCCESS", result.getStatus());
        assertEquals(2, result.getSize());
        assertEquals(Boolean.TRUE, result.getTruncated());
        assertEquals(2, ((JsonNode) result.getResultSet()).size());
        // one extra row is fetched to detect the cut
        verify(statement).setMaxRows(3);
    }

    @Test
    void resultIsNotMarkedWhenItFits() throws Exception {
        QueryExecutionResult result = executor.sqlExecute("SELECT id FROM t", Map.of(), 0, "test", template, 3);

        assertEquals(3, result.getSize());
        assertNull(result.getTruncated());
    }

    @Test
    void noLimitMeansAllRows() throws Exception {
        QueryExecutionResult result = executor.sqlExecute("SELECT id FROM t", Map.of(), 0, "test", template, 0);

        assertEquals(3, result.getSize());
        verify(statement, never()).setMaxRows(anyInt());
    }
}
