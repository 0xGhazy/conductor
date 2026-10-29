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

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.SQLTimeoutException;
import java.util.*;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.*;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterUtils;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vodafone.vss.weaver.actions.database.exception.DatasourceUnavailableException;
import com.vodafone.vss.weaver.actions.database.registry.DataSourceLease;
import com.vodafone.vss.weaver.actions.database.util.QueryParamTypeConverter;
import com.vodafone.vss.weaver.common.database.DatabaseErrorCode;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;

@Service
public class QueryExecutorService {

    private static final Logger log = LoggerFactory.getLogger(QueryExecutorService.class);

    private final ObjectMapper mapper;
    private final DynamicDataSourceManager dataSourceManager;

    public static final int DEFAULT_TIMEOUT_SECONDS = 5;

    public QueryExecutorService(ObjectMapper mapper, DynamicDataSourceManager dataSourceManager) {
        this.mapper = mapper != null ? mapper : new ObjectMapper();
        this.dataSourceManager = dataSourceManager;
    }

    public static int toTimeoutSeconds(Integer timeoutMs) {
        if (timeoutMs == null || timeoutMs <= 0) {
            return DEFAULT_TIMEOUT_SECONDS;
        }
        return Math.max(1, timeoutMs / 1000);
    }

    public QueryExecutionResult execute(UUID datasourceId,
                                        @NotNull String sql,
                                        Map<String, Object> parameters,
                                        int timeoutSeconds,
                                        String name) {
        try (DataSourceLease lease = leasePool(datasourceId)) {
            return sqlExecute(sql, parameters, timeoutSeconds, name, lease.template());
        }
    }

    private DataSourceLease leasePool(UUID datasourceId) {
        try {
            return dataSourceManager.lease(datasourceId);
        } catch (DatasourceUnavailableException e) {
            throw e;
        } catch (IllegalStateException | IllegalArgumentException e) {
            throw new DatasourceUnavailableException(
                    "Datasource " + datasourceId + " is not available: " + e.getMessage(),
                    DatabaseErrorCode.UNKNOWN,
                    false,
                    e);
        }
    }

    QueryExecutionResult sqlExecute(@NotNull String sql,
                                    Map<String, Object> parameters,
                                    int timeoutSeconds,
                                    String name,
                                    @NotNull NamedParameterJdbcTemplate template) {
        log.info("Executing SQL query {} with timeout {}s", name, timeoutSeconds);

        QueryExecutionResult out = QueryExecutionResult.builder().status("FAILED").build();
        String ctx = String.format("query=%s timeout=%ss params=%s", name, timeoutSeconds, parameters);

        long start = System.currentTimeMillis();
        try {
            NamedParameterJdbcTemplate activeTemplate = getNamedParameterJdbcTemplate(template, timeoutSeconds);
            executePreparedStatement(activeTemplate, sql.trim(), parameters, out);

            out.setStatus("SUCCESS");
            return out;
        } catch (QueryTimeoutException e) {
            log.warn("Query timeout on {}. Execution exceeded {} seconds.", ctx, timeoutSeconds, e);
            out.setErrorCode(DatabaseErrorCode.QUERY_TIMEOUT.name());
            out.setReason(DatabaseErrorCode.QUERY_TIMEOUT.getDefaultMessage());
            return out;
        } catch (CannotGetJdbcConnectionException | TransientDataAccessResourceException e) {
            log.warn("Connection failure on {}. Cannot establish or maintain a connection.", ctx, e);
            out.setErrorCode(DatabaseErrorCode.CONNECTION_FAILURE.name());
            out.setReason(DatabaseErrorCode.CONNECTION_FAILURE.getDefaultMessage());
            return out;
        } catch (DuplicateKeyException e) {
            log.warn("Duplicate key violation on {}.", ctx, e);
            out.setErrorCode(DatabaseErrorCode.DUPLICATE_KEY_VIOLATION.name());
            out.setReason(DatabaseErrorCode.DUPLICATE_KEY_VIOLATION.getDefaultMessage());
            return out;
        } catch (DataIntegrityViolationException e) {
            log.warn("Data integrity violation on {}.", ctx, e);
            out.setErrorCode(DatabaseErrorCode.INTEGRITY_VIOLATION.name());
            out.setReason(DatabaseErrorCode.INTEGRITY_VIOLATION.getDefaultMessage());
            return out;
        } catch (BadSqlGrammarException e) {
            Throwable rootCause = e.getMostSpecificCause();
            if (rootCause instanceof org.postgresql.util.PSQLException psqlException) {
                String sqlState = psqlException.getSQLState();
                if ("42P01".equals(sqlState)) {
                    log.warn("Table or relation not found on {}. SQLState={}", ctx, sqlState, e);
                    out.setStatus("FAILED");
                    out.setErrorCode(DatabaseErrorCode.SYNTAX_ERROR.name());
                    out.setReason("Table or relation not found");
                    return out;
                }
            }
            log.warn("SQL syntax error on {}.", ctx, e);
            out.setStatus("FAILED");
            out.setErrorCode(DatabaseErrorCode.SYNTAX_ERROR.name());
            out.setReason(DatabaseErrorCode.SYNTAX_ERROR.getDefaultMessage());
            return out;
        } catch (IncorrectResultSizeDataAccessException e) {
            log.warn("Result size mismatch on {}.", ctx, e);
            out.setErrorCode(DatabaseErrorCode.RESULT_SIZE_MISMATCH.name());
            out.setReason(DatabaseErrorCode.RESULT_SIZE_MISMATCH.getDefaultMessage());
            return out;
        } catch (PermissionDeniedDataAccessException e) {
            log.warn("Permission denied on {}.", ctx, e);
            out.setErrorCode(DatabaseErrorCode.PERMISSION_DENIED.name());
            out.setReason(DatabaseErrorCode.PERMISSION_DENIED.getDefaultMessage());
            return out;
        } catch (UncategorizedDataAccessException e) {
            if (e.getCause() instanceof SQLTimeoutException) {
                log.warn("SQL timeout detected on {}.", ctx, e);
                out.setErrorCode(DatabaseErrorCode.QUERY_TIMEOUT.name());
                out.setReason(DatabaseErrorCode.QUERY_TIMEOUT.getDefaultMessage());
            } else {
                log.warn("Uncategorized data access error on {}.", ctx, e);
                out.setErrorCode(DatabaseErrorCode.UNCLASSIFIED_DAO.name());
                out.setReason(DatabaseErrorCode.UNCLASSIFIED_DAO.getDefaultMessage());
            }
            return out;
        } catch (DataAccessException e) {
            log.warn("Generic data access error on {}.", ctx, e);
            out.setErrorCode(DatabaseErrorCode.DATA_ACCESS_ERROR.name());
            out.setReason(DatabaseErrorCode.DATA_ACCESS_ERROR.getDefaultMessage());
            return out;
        } finally {
            long elapsedMs = System.currentTimeMillis() - start;
            if ("SUCCESS".equals(out.getStatus())) {
                log.info("Query {} executed successfully in {} ms", name, elapsedMs);
            } else {
                log.warn("Query {} failed in {} ms with errorCode={}", name, elapsedMs, out.getErrorCode());
            }
        }
    }

    private void executePreparedStatement(NamedParameterJdbcTemplate template, String sql, Map<String, Object> parameters, QueryExecutionResult out) {
        MapSqlParameterSource parameterSource = new MapSqlParameterSource(parameters == null ? Collections.emptyMap() : parameters);
        var parsedSql = NamedParameterUtils.parseSqlStatement(sql);
        String sqlToUse = NamedParameterUtils.substituteNamedParameters(parsedSql, parameterSource);
        Object[] values = NamedParameterUtils.buildValueArray(parsedSql, parameterSource, null);

        PreparedStatementCreator statementCreator = connection -> {
            var preparedStatement = connection.prepareStatement(sqlToUse);
            for (int index = 0; index < values.length; index++) {
                preparedStatement.setObject(index + 1, values[index]);
            }
            return preparedStatement;
        };

        PreparedStatementCallback<Void> statementCallback = preparedStatement -> {
            boolean hasResultSet = preparedStatement.execute();
            if (hasResultSet) {
                List<Map<String, Object>> rows = readRows(preparedStatement.getResultSet());
                List<Map<String, Object>> normalized = rows.stream()
                        .map(row -> QueryParamTypeConverter.normalizeRow(row, mapper))
                        .toList();

                out.setResultSet(mapper.valueToTree(normalized));
                out.setSize(rows.size());
            } else {
                int affected = preparedStatement.getUpdateCount();
                out.setAffectedRows(Math.max(affected, 0));
            }
            return null;
        };

        template.getJdbcTemplate().execute(statementCreator, statementCallback);
    }

    private List<Map<String, Object>> readRows(ResultSet resultSet) throws SQLException {
        if (resultSet == null) {
            return Collections.emptyList();
        }

        ResultSetMetaData metaData = resultSet.getMetaData();
        int columnCount = metaData.getColumnCount();
        List<Map<String, Object>> rows = new ArrayList<>();

        while (resultSet.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int column = 1; column <= columnCount; column++) {
                String label = metaData.getColumnLabel(column);
                row.put(label != null && !label.isBlank() ? label : metaData.getColumnName(column), resultSet.getObject(column));
            }
            rows.add(row);
        }
        return rows;
    }

    private NamedParameterJdbcTemplate getNamedParameterJdbcTemplate(NamedParameterJdbcTemplate template, int timeoutSec) {
        NamedParameterJdbcTemplate activeTemplate = template;
        if (timeoutSec > 0) {
            var customJdbcTemplate = new JdbcTemplate(Objects.requireNonNull(template.getJdbcTemplate().getDataSource()));
            customJdbcTemplate.setQueryTimeout(timeoutSec);
            customJdbcTemplate.setFetchSize(100);
            activeTemplate = new NamedParameterJdbcTemplate(customJdbcTemplate);
        }
        return activeTemplate;
    }
}

