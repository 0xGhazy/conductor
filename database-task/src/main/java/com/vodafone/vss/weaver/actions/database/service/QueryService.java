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

import java.net.URI;
import java.util.*;
import java.util.concurrent.TimeUnit;
import jakarta.annotation.PreDestroy;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.vodafone.vss.weaver.actions.database.dto.AdhocQueryExecutionRequest;
import com.vodafone.vss.weaver.actions.database.exception.DatasourceUnavailableException;
import com.vodafone.vss.weaver.actions.database.util.QueryParamTypeConverter;
import com.vodafone.vss.weaver.actions.database.util.SqlMinifier;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.VariableResolver;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.database.QueryParameterDataType;
import com.vodafone.vss.weaver.common.dto.AppResponse;
import com.vodafone.vss.weaver.common.exceptions.BusinessExceptionBuilder;
import com.vodafone.vss.weaver.common.response.PaginatedResult;
import com.vodafone.vss.weaver.dao.DatasourceDAO;
import com.vodafone.vss.weaver.dao.QueryDAO;

@Service
public class QueryService {

    private static final Logger log = LoggerFactory.getLogger(QueryService.class);

    private final QueryDAO queryDAO;
    private final DatasourceDAO datasourceDAO;
    private final QueryExecutorService queryExecutorService;
    private final Cache<UUID, QueryModel> queryCache;
    private final Cache<String, PaginatedCacheEntry> paginatedQueryCache;

    @Autowired(required = false)
    private AuditSecurityHelper auditSecurityHelper;

    @Autowired(required = false)
    private VariableResolver variableResolver;

    private record PaginatedCacheEntry(List<?> data, PaginatedResult details) {}

    @Autowired
    public QueryService(
            QueryDAO queryDAO,
            DatasourceDAO datasourceDAO,
            QueryExecutorService queryExecutorService,
            @Value("${query.cache.max-size:1000}") int maxCacheSize,
            @Value("${query.cache.key.ttl:3600}") long ttlSeconds
    ) {
        this.queryDAO = queryDAO;
        this.datasourceDAO = datasourceDAO;
        this.queryExecutorService = queryExecutorService;
        this.queryCache = Caffeine.newBuilder()
                .maximumSize(maxCacheSize)
                .expireAfterWrite(ttlSeconds, TimeUnit.SECONDS)
                .build();
        this.paginatedQueryCache = Caffeine.newBuilder()
                .maximumSize(maxCacheSize)
                .expireAfterWrite(ttlSeconds, TimeUnit.SECONDS)
                .build();
        log.info("QueryService initialized with Caffeine cache (maxSize={}, ttl={}s)", maxCacheSize, ttlSeconds);
    }

    public ResponseEntity<AppResponse> createRest(@NotNull QueryModel payload) {
        String normalizedName = payload.getName().trim();
        UUID datasourceId = payload.getDatasourceId();
        if (datasourceId == null) {
            throw ExceptionUtils.throwBadInputs("Validation error", "Datasource ID is required");
        }
        log.info("Start defining new query {} on datasource {}", normalizedName, datasourceId);

        DatasourceModel datasource = loadDatasource(datasourceId);

        String currentUserId = getCurrentUserId();

        QueryModel query = QueryModel.builder()
                .name(normalizedName)
                .description(normalizeDescription(payload.getDescription()))
                .sql(SqlMinifier.minify(payload.getSql()))
                .parameters(normalizeParameters(payload.getParameters()))
                .datasourceId(datasource.getId())
                .timeout(payload.getTimeout() != null ? payload.getTimeout() : 1000)
                .createdBy(currentUserId)
                .updatedBy(currentUserId)
                .build();

        QueryModel saved = queryDAO.create(query);
        queryCache.put(saved.getId(), saved);
        paginatedQueryCache.invalidateAll();
        log.info("Query {} has been created with id {}", normalizedName, saved.getId());

        AppResponse response = AppResponse.builder()
                .message("Query created successfully")
                .data(saved)
                .status(HttpStatus.CREATED)
                .retryable(false)
                .success(true)
                .build();

        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(saved.getId())
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    public ResponseEntity<AppResponse> updateRest(@NotNull UUID id, @NotNull QueryModel payload) {
        String normalizedName = payload.getName().trim();
        UUID datasourceId = payload.getDatasourceId();
        if (datasourceId == null) {
            throw ExceptionUtils.throwBadInputs("Validation error", "Datasource ID is required");
        }
        log.info("Start updating query {} on datasource {}", normalizedName, datasourceId);

        QueryModel existing = findById(id);
        loadDatasource(datasourceId);

        String currentUserId = getCurrentUserId();

        QueryModel query = QueryModel.builder()
                .id(id)
                .name(normalizedName)
                .description(normalizeDescription(payload.getDescription()))
                .sql(SqlMinifier.minify(payload.getSql()))
                .parameters(normalizeParameters(payload.getParameters()))
                .datasourceId(datasourceId)
                .timeout(payload.getTimeout() != null ? payload.getTimeout() : existing.getTimeout())
                .createdBy(existing.getCreatedBy())
                .updatedBy(currentUserId)
                .build();

        QueryModel updated = queryDAO.update(query);
        queryCache.put(updated.getId(), updated);
        paginatedQueryCache.invalidateAll();
        log.info("Query {} has been updated with id {}", normalizedName, updated.getId());

        AppResponse response = AppResponse.builder()
                .message("Query updated successfully")
                .data(updated)
                .status(HttpStatus.OK)
                .retryable(false)
                .success(true)
                .build();

        return new ResponseEntity<>(response, response.getStatus());
    }

    public ResponseEntity<AppResponse> findByIdRest(@NotNull UUID id, boolean includeQuery) {
        log.info("Start fetching query with id {}", id);
        QueryModel entity = findById(id);
        QueryModel out = copyForResponse(entity, includeQuery);

        AppResponse response = AppResponse.builder()
                .message("Query fetched successfully")
                .data(out)
                .status(HttpStatus.OK)
                .retryable(false)
                .success(true)
                .build();

        return new ResponseEntity<>(response, response.getStatus());
    }

    public ResponseEntity<AppResponse> findAllPageableRest(UUID datasource, boolean includeQuery, String search, Pageable pageable) {
        String normalizedSearch = normalizeSearch(search);
        int offset = (int) pageable.getOffset();
        int limit = pageable.getPageSize();

        List<QueryModel> list = queryDAO.findAll(offset, limit, normalizedSearch, datasource);
        long total = queryDAO.count(normalizedSearch, datasource);

        List<QueryModel> responseList = list.stream()
                .map(q -> copyForResponse(q, includeQuery))
                .toList();

        PaginatedResult details = new PaginatedResult(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                total,
                (int) Math.ceil((double) total / pageable.getPageSize()),
                responseList.size()
        );

        AppResponse response = AppResponse.builder()
                .message("Queries fetched successfully")
                .data(responseList)
                .details(details)
                .status(HttpStatus.OK)
                .retryable(false)
                .success(true)
                .build();

        return new ResponseEntity<>(response, response.getStatus());
    }

    public ResponseEntity<AppResponse> deleteByIdRest(@NotNull UUID id) {
        log.info("Deleting query with id {}", id);
        boolean deleted = queryDAO.deleteById(id);
        if (!deleted) {
            throw ExceptionUtils.throwNotFound("Query not found with id " + id);
        }
        queryCache.invalidate(id);
        paginatedQueryCache.invalidateAll();
        return ResponseEntity.noContent().build();
    }

    public ResponseEntity<AppResponse> bulkDeleteRest(@NotNull Set<UUID> ids) {
        log.info("Bulk deleting queries: count={}", ids.size());
        for (UUID id : ids) {
            queryDAO.deleteById(id);
            queryCache.invalidate(id);
        }
        paginatedQueryCache.invalidateAll();
        AppResponse response = AppResponse.builder()
                .message("Queries deleted successfully")
                .status(HttpStatus.OK)
                .retryable(false)
                .success(true)
                .build();
        return new ResponseEntity<>(response, response.getStatus());
    }

    public ResponseEntity<AppResponse> executeAdhocQueryRest(AdhocQueryExecutionRequest payload) {
        UUID datasourceId = payload.getDatasource();
        String sql = payload.getSql();
        Integer timeoutMs = payload.getTimeout();
        Map<String, Object> parameters = payload.getParameters();

        log.info("Executing ad-hoc query on datasource {}: timeout={}ms", datasourceId, timeoutMs);

        QueryExecutionResult result = executeSql(datasourceId, sql, parameters, timeoutMs, "adhoc");
        if (!"SUCCESS".equals(result.getStatus())) {
            AppResponse response = AppResponse.builder()
                    .message(result.getReason() != null ? String.valueOf(result.getReason()) : "Query execution failed")
                    .status(HttpStatus.BAD_REQUEST)
                    .data(result)
                    .success(false)
                    .retryable(false)
                    .build();
            return new ResponseEntity<>(response, response.getStatus());
        }

        AppResponse response = AppResponse.builder()
                .message("Ad-hoc query executed successfully")
                .status(HttpStatus.OK)
                .data(result)
                .success(true)
                .retryable(false)
                .build();
        return new ResponseEntity<>(response, response.getStatus());
    }

    public QueryExecutionResult executeSavedQuery(@NotNull UUID queryId, Map<String, Object> arguments) {
        QueryModel query = findById(queryId);
        DatasourceModel datasource = loadDatasource(query.getDatasourceId());
        Map<String, Object> parameters = QueryParamTypeConverter.parseQueryParameters(
                resolveVariables(arguments), query.getParameters(), datasource.getType());
        return executeSql(datasource.getId(), resolveVariables(query.getSql()), parameters, query.getTimeout(), query.getName());
    }

    public QueryExecutionResult executeTaskSql(@NotNull UUID datasourceId,
                                               @NotNull String sql,
                                               Map<String, Object> parameters,
                                               String name) {
        return executeSql(datasourceId, resolveVariables(sql), resolveVariables(parameters), null, name);
    }

    public QueryExecutionResult executeSql(@NotNull UUID datasourceId,
                                           @NotNull String sql,
                                           Map<String, Object> parameters,
                                           Integer timeoutMs,
                                           String name) {
        return queryExecutorService.execute(
                datasourceId,
                sql.trim(),
                parameters != null ? parameters : Collections.emptyMap(),
                QueryExecutorService.toTimeoutSeconds(timeoutMs),
                name);
    }

    public QueryModel findById(@NotNull UUID id) {
        QueryModel cached = queryCache.getIfPresent(id);
        if (cached != null) {
            return cached;
        }
        QueryModel query = queryDAO.findById(id).orElseThrow(
                () -> new NoSuchElementException("Query not found with id " + id));
        queryCache.put(id, query);
        return query;
    }

    private DatasourceModel loadDatasource(UUID id) {
        return datasourceDAO.findById(id).orElseThrow(() -> ExceptionUtils.throwBusinessException(
                BusinessExceptionBuilder.builder()
                        .message("Datasource not found with id " + id)
                        .reason("No datasource found matching the provided id")
                        .code("DATASOURCE_NOT_FOUND")
                        .status(HttpStatus.NOT_FOUND)
                        .retryable(false)
                        .success(false)
                        .build()
        ));
    }

    private String resolveVariables(String sql) {
        return sql == null || variableResolver == null ? sql : variableResolver.resolve(sql);
    }

    private Map<String, Object> resolveVariables(Map<String, Object> parameters) {
        return parameters == null || variableResolver == null ? parameters : variableResolver.resolveMap(parameters);
    }

    private static String normalizeDescription(String description) {
        return description == null ? null : description.trim();
    }

    private static Map<String, QueryParameterDataType> normalizeParameters(Map<String, QueryParameterDataType> parameters) {
        Map<String, QueryParameterDataType> normalized = new LinkedHashMap<>();
        if (parameters == null) {
            return normalized;
        }
        parameters.forEach((key, type) -> {
            if (key != null && !key.isBlank()) {
                normalized.put(key.trim(), type != null ? type : QueryParameterDataType.STRING);
            }
        });
        return normalized;
    }

    private static String normalizeSearch(String search) {
        return (search == null || search.isBlank()) ? null : search.trim();
    }

    private static QueryModel copyForResponse(QueryModel q, boolean includeQuery) {
        if (q == null) return null;
        return QueryModel.builder()
                .id(q.getId())
                .name(q.getName())
                .description(q.getDescription())
                .sql(includeQuery ? q.getSql() : null)
                .timeout(q.getTimeout())
                .parameters(q.getParameters())
                .datasourceId(q.getDatasourceId())
                .createdAt(q.getCreatedAt())
                .updatedAt(q.getUpdatedAt())
                .createdBy(q.getCreatedBy())
                .updatedBy(q.getUpdatedBy())
                .build();
    }

    private String getCurrentUserId() {
        if (auditSecurityHelper != null) {
            try {
                var actor = auditSecurityHelper.resolveCurrentActor();
                if (actor != null && actor.getActorId() != null) {
                    return actor.getActorId();
                }
            } catch (Exception e) {
                // fallback to default
            }
        }
        return "system";
    }

    @PreDestroy
    public void close() {
        queryCache.invalidateAll();
        paginatedQueryCache.invalidateAll();
    }
}
