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

import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import jakarta.annotation.PreDestroy;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.vodafone.vss.weaver.actions.database.dto.BulkDeleteResult;
import com.vodafone.vss.weaver.actions.database.dto.QueryExecutionRequest;
import com.vodafone.vss.weaver.actions.database.dto.SqlExecutionRequest;
import com.vodafone.vss.weaver.actions.database.util.QueryParamTypeConverter;
import com.vodafone.vss.weaver.actions.database.util.SqlMinifier;
import com.vodafone.vss.weaver.annotations.Audit;
import com.vodafone.vss.weaver.annotations.AuditContext;
import com.vodafone.vss.weaver.audit.service.AuditSecurityHelper;
import com.vodafone.vss.weaver.audit.service.UserService;
import com.vodafone.vss.weaver.common.ExceptionUtils;
import com.vodafone.vss.weaver.common.audit.UserMinimal;
import com.vodafone.vss.weaver.common.database.DatasourceMinimal;
import com.vodafone.vss.weaver.common.database.DatasourceModel;
import com.vodafone.vss.weaver.common.database.QueryExecutionResult;
import com.vodafone.vss.weaver.common.database.QueryModel;
import com.vodafone.vss.weaver.common.database.QueryParameterDataType;
import com.vodafone.vss.weaver.common.exceptions.BusinessExceptionBuilder;
import com.vodafone.vss.weaver.core.placeholders.WeaverPlaceholderResolver;
import com.vodafone.vss.weaver.dao.DatasourceDAO;
import com.vodafone.vss.weaver.dao.QueryDAO;

/**
 * Saved queries: CRUD for the REST API, and execution for both the API and the DATABASE task.
 * Methods return models; the REST layer decides the HTTP status.
 */
@Service
public class QueryService {

    private static final Logger log = LoggerFactory.getLogger(QueryService.class);

    static final int DEFAULT_TIMEOUT_MS = 5000;

    private final QueryDAO queryDAO;
    private final DatasourceDAO datasourceDAO;
    private final QueryExecutorService queryExecutorService;
    private final Cache<UUID, QueryModel> queryCache;
    private final int maxRowsLimit;
    private final Duration maxTimeout;

    @Autowired(required = false)
    private AuditSecurityHelper auditSecurityHelper;

    @Autowired(required = false)
    private WeaverPlaceholderResolver placeholders;

    @Autowired(required = false)
    private UserService userService;

    @Autowired
    public QueryService(
            QueryDAO queryDAO,
            DatasourceDAO datasourceDAO,
            QueryExecutorService queryExecutorService,
            @Value("${query.cache.max-size:1000}") int maxCacheSize,
            @Value("${query.cache.key.ttl:3600}") long ttlSeconds,
            @Value("${weaver.database.execute.max-rows:1000}") int maxRowsLimit,
            @Value("${weaver.database.execute.max-timeout:60s}") Duration maxTimeout
    ) {
        this.queryDAO = queryDAO;
        this.datasourceDAO = datasourceDAO;
        this.queryExecutorService = queryExecutorService;
        this.queryCache = Caffeine.newBuilder()
                .maximumSize(maxCacheSize)
                .expireAfterWrite(ttlSeconds, TimeUnit.SECONDS)
                .build();
        this.maxRowsLimit = Math.max(1, maxRowsLimit);
        this.maxTimeout = maxTimeout;
    }

    // ----- CRUD ----- //

    @Audit(action = "createQuery", resourceType = "QUERY", captureArguments = false)
    public QueryModel create(@NotNull QueryModel payload) {
        AuditContext.put("name", payload.getName());
        validate(payload);
        String name = payload.getName().trim();
        DatasourceModel datasource = loadDatasource(payload.getDatasourceId());
        ensureUniqueName(name, datasource.getId(), null);

        UserMinimal actor = currentUser();
        QueryModel saved = queryDAO.create(QueryModel.builder()
                .name(name)
                .description(normalizeDescription(payload.getDescription()))
                .sql(SqlMinifier.minify(payload.getSql()))
                .parameters(normalizeParameters(payload.getParameters()))
                .datasourceId(datasource.getId())
                .timeout(payload.getTimeout() != null ? payload.getTimeout() : 1000)
                .createdBy(actor)
                .updatedBy(actor)
                .build());
        queryCache.put(saved.getId(), saved);
        AuditContext.recordChanges(Map.of(), auditFields(saved));
        log.info("Query {} created with id {}", name, saved.getId());
        return toResponse(saved, true);
    }

    @Audit(action = "updateQuery", resourceType = "QUERY", captureArguments = false)
    public QueryModel update(@NotNull UUID id, @NotNull QueryModel payload) {
        AuditContext.put("name", payload.getName());
        validate(payload);
        String name = payload.getName().trim();
        QueryModel existing = get(id);
        loadDatasource(payload.getDatasourceId());
        ensureUniqueName(name, payload.getDatasourceId(), id);

        QueryModel updated = queryDAO.update(QueryModel.builder()
                .id(id)
                .name(name)
                .description(normalizeDescription(payload.getDescription()))
                .sql(SqlMinifier.minify(payload.getSql()))
                .parameters(normalizeParameters(payload.getParameters()))
                .datasourceId(payload.getDatasourceId())
                .timeout(payload.getTimeout() != null ? payload.getTimeout() : existing.getTimeout())
                .createdBy(existing.getCreatedBy())
                .updatedBy(currentUser())
                .build());
        queryCache.put(updated.getId(), updated);
        AuditContext.recordChanges(auditFields(existing), auditFields(updated));
        log.info("Query {} updated (id {})", name, id);
        return toResponse(updated, true);
    }

    /** The query, or a 404 error. */
    public QueryModel get(@NotNull UUID id) {
        try {
            return findById(id);
        } catch (NoSuchElementException e) {
            throw ExceptionUtils.throwNotFound("Query not found with id " + id);
        }
    }

    public QueryModel get(@NotNull UUID id, boolean includeSql) {
        return toResponse(get(id), includeSql);
    }

    /** One page of queries, newest first, optionally limited to one database. */
    public Page<QueryModel> list(UUID databaseId, boolean includeSql, String search, int page, int size) {
        String normalizedSearch = normalizeSearch(search);
        List<QueryModel> items = toResponses(queryDAO.findAll(page * size, size, normalizedSearch, databaseId), includeSql);
        long total = queryDAO.count(normalizedSearch, databaseId);
        return new PageImpl<>(items, PageRequest.of(page, size), total);
    }

    public void delete(@NotNull UUID id) {
        if (!queryDAO.deleteById(id)) {
            throw ExceptionUtils.throwNotFound("Query not found with id " + id);
        }
        queryCache.invalidate(id);
        log.info("Query {} deleted", id);
    }

    public BulkDeleteResult deleteAll(@NotNull Set<UUID> ids) {
        List<UUID> deleted = new ArrayList<>();
        List<UUID> notFound = new ArrayList<>();
        for (UUID id : ids) {
            if (queryDAO.deleteById(id)) {
                deleted.add(id);
            } else {
                notFound.add(id);
            }
            queryCache.invalidate(id);
        }
        log.info("Bulk delete of queries: deleted={}, notFound={}", deleted.size(), notFound.size());
        return new BulkDeleteResult(deleted, notFound);
    }

    // ----- Execution from the REST API (audited, row and time limited) ----- //

    /** Runs SQL sent by the caller against a database. */
    @Audit(action = "executeSql", resourceType = "DATABASE")
    public QueryExecutionResult runSql(@NotNull UUID databaseId, @NotNull SqlExecutionRequest request) {
        loadDatasource(databaseId);
        int timeoutMs = effectiveTimeoutMs(request.getTimeout());
        int maxRows = effectiveMaxRows(request.getMaxRows());
        log.info("SQL run on database {} by {} (timeout={}ms, maxRows={})",
                databaseId, currentUser(), timeoutMs, maxRows);
        return queryExecutorService.execute(
                databaseId,
                request.getSql().trim(),
                request.getParameters() != null ? request.getParameters() : Collections.emptyMap(),
                QueryExecutorService.toTimeoutSeconds(timeoutMs),
                "adhoc",
                maxRows);
    }

    /** Runs a saved query with the caller's arguments. */
    @Audit(action = "executeQuery", resourceType = "QUERY")
    public QueryExecutionResult runQuery(@NotNull UUID queryId, QueryExecutionRequest request) {
        QueryModel query = get(queryId);
        int maxRows = effectiveMaxRows(request != null ? request.getMaxRows() : null);
        log.info("Saved query {} run by {} (maxRows={})", queryId, currentUser(), maxRows);
        return executeSaved(query, request != null ? request.getParameters() : null, maxRows);
    }

    // ----- Execution from the DATABASE task ----- //

    public QueryExecutionResult executeSavedQuery(@NotNull UUID queryId, Map<String, Object> arguments) {
        return executeSaved(findById(queryId), arguments, 0);
    }

    public QueryExecutionResult executeTaskSql(@NotNull UUID datasourceId,
                                               @NotNull String sql,
                                               Map<String, Object> parameters,
                                               String name) {
        // Inline task SQL and parameters come from task input, which is already resolved
        // (env at schedule time, secrets before the task runs).
        return executeSql(datasourceId, sql, parameters, null, name);
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

    /** Lookup used by the task; throws {@link NoSuchElementException} when missing. */
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

    private QueryExecutionResult executeSaved(QueryModel query, Map<String, Object> arguments, int maxRows) {
        DatasourceModel datasource = loadDatasource(query.getDatasourceId());
        Map<String, Object> parameters = QueryParamTypeConverter.parseQueryParameters(
                arguments, query.getParameters(), datasource.getType());
        // Saved SQL is admin configuration and may use ${weaver.env...} / ${weaver.secrets...}.
        // Arguments are caller data and are bound as parameters, never resolved.
        return queryExecutorService.execute(
                datasource.getId(),
                resolveConfig(query.getSql()).trim(),
                parameters != null ? parameters : Collections.emptyMap(),
                QueryExecutorService.toTimeoutSeconds(query.getTimeout()),
                query.getName(),
                maxRows);
    }

    int effectiveMaxRows(Integer requested) {
        return requested == null ? maxRowsLimit : Math.min(Math.max(1, requested), maxRowsLimit);
    }

    int effectiveTimeoutMs(Integer requested) {
        long cap = maxTimeout != null && !maxTimeout.isNegative() && !maxTimeout.isZero()
                ? maxTimeout.toMillis() : Integer.MAX_VALUE;
        long wanted = requested == null ? DEFAULT_TIMEOUT_MS : Math.max(1, requested);
        return (int) Math.min(Math.min(wanted, cap), Integer.MAX_VALUE);
    }

    // ----- Helpers ----- //

    private static void validate(QueryModel payload) {
        List<String> errors = new ArrayList<>();
        if (payload.getName() == null || payload.getName().isBlank()) {
            errors.add("name is required");
        }
        if (payload.getSql() == null || payload.getSql().isBlank()) {
            errors.add("sql is required");
        }
        if (payload.getDatasourceId() == null) {
            errors.add("datasourceId is required");
        }
        if (payload.getTimeout() != null && payload.getTimeout() <= 0) {
            errors.add("timeout must be greater than 0");
        }
        if (!errors.isEmpty()) {
            throw ExceptionUtils.throwBadInputs("Invalid query", String.join("; ", errors));
        }
    }

    private void ensureUniqueName(String name, UUID datasourceId, UUID currentId) {
        queryDAO.findByNameAndDatasourceId(name, datasourceId)
                .filter(other -> !other.getId().equals(currentId))
                .ifPresent(other -> {
                    throw ExceptionUtils.throwAlreadyExist(
                            "A query named '" + name + "' already exists on this database");
                });
    }

    private DatasourceModel loadDatasource(UUID id) {
        return datasourceDAO.findById(id).orElseThrow(() -> ExceptionUtils.throwBusinessException(
                BusinessExceptionBuilder.builder()
                        .message("Database not found with id " + id)
                        .reason("No database found matching the provided id")
                        .code("DATASOURCE_NOT_FOUND")
                        .status(HttpStatus.NOT_FOUND)
                        .retryable(false)
                        .success(false)
                        .build()
        ));
    }

    private String resolveConfig(String sql) {
        return sql == null || placeholders == null ? sql : placeholders.resolveConfig(sql);
    }

    /** The fields of a query shown in audit changes. */
    private static Map<String, Object> auditFields(QueryModel query) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", query.getName());
        fields.put("description", query.getDescription());
        fields.put("sql", query.getSql());
        fields.put("timeout", query.getTimeout());
        fields.put("parameters", query.getParameters());
        fields.put("datasourceId", query.getDatasourceId());
        return fields;
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

    /**
     * A copy for API responses (cached queries are shared with the task, so they are never
     * changed), with the SQL only when asked and the users behind createdBy / updatedBy.
     */
    private QueryModel toResponse(QueryModel query, boolean includeSql) {
        return toResponses(List.of(query), includeSql).get(0);
    }

    /** Response copies, each with its database (id, name, type); every database is loaded once. */
    private List<QueryModel> toResponses(List<QueryModel> queries, boolean includeSql) {
        Map<UUID, DatasourceMinimal> databases = new HashMap<>();
        for (QueryModel query : queries) {
            UUID databaseId = query.getDatasourceId();
            if (databaseId != null && !databases.containsKey(databaseId)) {
                databases.put(databaseId, datasourceDAO.findById(databaseId)
                        .map(DatasourceMinimal::of)
                        .orElse(DatasourceMinimal.ofId(databaseId)));
            }
        }
        return queries.stream()
                .map(query -> copyForResponse(query, includeSql, databases.get(query.getDatasourceId())))
                .toList();
    }

    private QueryModel copyForResponse(QueryModel q, boolean includeSql, DatasourceMinimal database) {
        if (q == null) return null;
        QueryModel copy = QueryModel.builder()
                .id(q.getId())
                .name(q.getName())
                .description(q.getDescription())
                .sql(includeSql ? q.getSql() : null)
                .timeout(q.getTimeout())
                .parameters(q.getParameters())
                .datasourceId(q.getDatasourceId())
                .datasource(database)
                .createdAt(q.getCreatedAt())
                .updatedAt(q.getUpdatedAt())
                .createdBy(q.getCreatedBy())
                .updatedBy(q.getUpdatedBy())
                .build();
        if (userService != null) {
            userService.fillUsers(copy);
        }
        return copy;
    }

    /**
     * The caller as an id-only user: the token's subject is the Keycloak user id (user_entity.id).
     * Null when nobody is signed in (security disabled) or the subject is not a user id.
     */
    private UserMinimal currentUser() {
        if (auditSecurityHelper == null) {
            return null;
        }
        String actorId;
        try {
            var actor = auditSecurityHelper.resolveCurrentActor();
            actorId = actor != null ? actor.getActorId() : null;
        } catch (Exception e) {
            return null;
        }
        if (actorId == null || actorId.isBlank()) {
            return null;
        }
        try {
            return UserMinimal.ofId(UUID.fromString(actorId.trim()).toString());
        } catch (IllegalArgumentException e) {
            log.debug("Caller '{}' is not a Keycloak user id; createdBy/updatedBy left empty", actorId);
            return null;
        }
    }

    @PreDestroy
    public void close() {
        queryCache.invalidateAll();
    }
}
